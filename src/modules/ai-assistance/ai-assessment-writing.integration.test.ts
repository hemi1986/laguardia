import { randomBytes, randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  attachFileCommand,
  createMachineModelCommand,
  machineModelOfMachineForAi,
  registerMachineCommand,
} from "@/modules/collection";
import {
  defectDetails,
  linkProblemReportToDefectCommand,
  logWorkCommand,
  reportProblemAndTriageCommand,
  reportProblemCommand,
  resolveDefectCommand,
} from "@/modules/repair";
import { executeCommand } from "@/platform/command";
import { fixedClock } from "@/platform/clock";
import { memoryStorage, type MemoryStorage } from "@/platform/storage";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { anExistingTeamMember } from "@/test-support/team-members";
import { aiSettingsForm, changeAiSettingsCommand, requestAiAssessmentCommand } from ".";
import { aiAssessmentById, aiAssessmentBeingWritten } from "./ai-assessments";
import { aiAssessmentWork } from "./ai-assessment-work";
import type { AiAssessmentState } from "./ai-assessment";
import { runAiWork } from "./ai-work";
import { searchAiIndex, SEARCH_IMAGE_HITS, SEARCH_TEXT_HITS } from "./ai-index-search";
import { indexFileForAiCommand } from "./index-file-for-ai-command";
import { memoryAi, geminiEmbedding, geminiFlash } from "./ai-seam.test-support";
import { steppingClock } from "./ai-work-stand-in.test-support";
import { aJpeg, aPdfOfText } from "./file-indexing.test-support";

/**
 * ST-107: what an AI assessment sends the chat model and what comes back. Every scenario drives one run of the
 * background work directly – `runAiWork` with the real AI assessment kind, the injected clock, budget, in-memory AI and
 * storage – against a database of its own, as the story's Notes require.
 */
const isolated = isolatedTestDatabase("ai_assessment_writing");
let db: NodePgDatabase;
const clock = steppingClock("2026-11-03T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const environmentKey = randomBytes(32);
const KEY = "sk-or-v1-0123456789abcdef0123456789abcdefa1b2";
const EMBEDDING = geminiEmbedding.id;
const CHAT = geminiFlash.id;

let eightBall: string;
let otherModel: string;
let storage: MemoryStorage;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  eightBall = await machineModel("Eight Ball", "Bally", 1980);
  otherModel = await machineModel("Medieval Madness", "Williams", 1997);
});

afterAll(() => isolated.close());

beforeEach(async () => {
  await db.execute("DELETE FROM ai_work_hold");
  await db.execute("DELETE FROM ai_assessment");
  await db.execute("DELETE FROM ai_index_item");
  await db.execute("DELETE FROM ai_index_entry");
  await withoutMachines(db);
  clock.set("2026-11-03T10:00:00Z");
  storage = memoryStorage();
  await saveAiSettings();
});

async function machineModel(title: string, manufacturer: string, year: number) {
  const created = await executeCommand(
    createMachineModelCommand,
    { title, manufacturer, year: String(year), machineCategory: "pinball" },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  return created.result.machineModelId;
}

async function aMachine(model: string, museumNumber: string) {
  const registered = await executeCommand(
    registerMachineCommand,
    { machineModelId: model, museumNumber, serialNumber: undefined, location: "Hall 1", machineStatus: "playable" },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!registered.ok) throw new Error(registered.error);
  return registered.result.machineId;
}

async function saveAiSettings(ai = anAi()) {
  const dependencies = { ai, encryptionKey: () => environmentKey };
  const { version } = await aiSettingsForm(db, dependencies);
  const saved = await executeCommand(
    changeAiSettingsCommand(dependencies),
    { version, key: KEY, chatModel: CHAT, embeddingModel: EMBEDDING },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!saved.ok) throw new Error(saved.error);
}

function anAi(settings: Parameters<typeof memoryAi>[0] = {}) {
  return memoryAi({ acceptedKeys: [KEY], ...settings });
}

async function anOpenDefect(
  machineId: string,
  { title = "Left flipper weak", description = "Left flipper weak – first seen" } = {},
) {
  const reported = await executeCommand(
    reportProblemAndTriageCommand,
    {
      machineId,
      description,
      triage: {
        outcome: "defect-recorded",
        title,
        priority: undefined,
        suitableForHelpers: false,
        machineStatus: undefined,
        machineVersion: undefined,
      },
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!reported.ok || !reported.result.defectId) throw new Error("no defect recorded");
  return { defectId: reported.result.defectId, problemReportId: reported.result.problemReportId };
}

async function aPhoto(): Promise<string> {
  const name = `ai-assessments/${randomUUID()}.jpg`;
  await storage.write(name, await aJpeg(), "image/jpeg");
  return name;
}

async function attach({
  machineId,
  to = "machine",
  title,
  contentType,
  bytes,
}: {
  machineId: string;
  to?: "machine" | "machine-model";
  title: string;
  contentType: string;
  bytes: Uint8Array;
}): Promise<string> {
  const name = `files/${randomUUID()}`;
  await storage.write(name, bytes, contentType);
  const attached = await executeCommand(
    attachFileCommand,
    {
      machineId,
      attachTo: to,
      title,
      fileCategory: "manual",
      content: { name, size: bytes.length, contentType },
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!attached.ok) throw new Error(attached.error);
  return attached.result.fileId;
}

/** An AI index entry with one chunk per item – passages or pages/images, all with the same embedding. */
/** The embedding `memoryAi` returns for the seed of a request – so a test can make a hit the nearest of one search. */
function memoryEmbedding(seed: number): number[] {
  return Array.from(
    { length: geminiEmbedding.embeddingSize ?? 1536 },
    (_, index) => ((seed * 31 + index) % 1000) / 1000,
  );
}

async function index(
  fileId: string,
  items: { kind: "passage" | "page-image" | "image"; page?: number; text?: string; embedding?: number[] }[],
) {
  const indexed = await executeCommand(
    indexFileForAiCommand,
    {
      fileId,
      embeddingModel: EMBEDDING,
      result: {
        items: items.map((item) => ({
          kind: item.kind,
          ...(item.page !== undefined && { page: item.page }),
          ...(item.text !== undefined && { text: item.text }),
          embedding: item.embedding ?? memoryEmbedding(4),
        })),
        pagesIndexed: items.filter((item) => item.kind === "page-image").length,
        imagesIndexed: items.filter((item) => item.kind === "image" || item.kind === "page-image").length,
        cost: 0.0001,
      },
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!indexed.ok) throw new Error(indexed.error);
}

async function request(defectId: string, { note = "", photos = [] }: { note?: string; photos?: string[] } = {}) {
  const ai = anAi();
  const asked = await executeCommand(
    requestAiAssessmentCommand({ ai, encryptionKey: () => environmentKey }),
    { defectId, note, photos },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!asked.ok) throw new Error(asked.error);
  return asked.result.aiAssessmentId;
}

function run(ai = anAi()) {
  return runAiWork({
    db,
    clock,
    budgetSeconds: 250,
    ai: { ai, encryptionKey: () => environmentKey },
    storage,
    continueWork: async () => undefined,
    kinds: [aiAssessmentWork],
  });
}

async function assessment(id: string): Promise<AiAssessmentState> {
  const found = await aiAssessmentById(db, id);
  if (!found) throw new Error("no AI assessment");
  return found;
}

describe("what an AI assessment does", () => {
  it("ST-107: The chat model is sent what is known about the defect", async () => {
    const machineId = await aMachine(eightBall, "LG-042");
    const { defectId } = await anOpenDefect(machineId);
    // A problem report with a description and a photo, a work log entry, and a resolved defect on the same machine.
    const reportPhoto = await aPhoto();
    const linked = await executeCommand(
      reportProblemCommand,
      { machineId, description: "The coil gets hot after ten minutes", photo: reportPhoto },
      { actor: { kind: "visitor" }, db, clock, newId: randomUUID },
    );
    if (!linked.ok) throw new Error(linked.error);
    const link = await executeCommand(
      linkProblemReportToDefectCommand,
      { problemReportId: linked.result.problemReportId, version: 0, defectId },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!link.ok) throw new Error(link.error);
    const details = await defectDetails(db, defectId);
    if (!details) throw new Error("no defect");
    const logged = await executeCommand(
      logWorkCommand,
      { defectId, version: details.version, whatWasDone: "Checked the coil", partsUsed: "" },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!logged.ok) throw new Error(logged.error);
    const old = await anOpenDefect(machineId, { title: "Bumper dead", description: "Bumper stays dead" });
    const oldDetails = await defectDetails(db, old.defectId);
    if (!oldDetails) throw new Error("no old defect");
    const resolved = await executeCommand(
      resolveDefectCommand,
      { defectId: old.defectId, version: oldDetails.version, closingNote: "Replaced the bumper switch" },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!resolved.ok) throw new Error(resolved.error);
    // A PDF of the machine whose page the AI index found.
    const pdf = await attach({
      machineId,
      title: "Eight Ball Manual",
      contentType: "application/pdf",
      bytes: await aPdfOfText(["Coil assembly"]),
    });
    await index(pdf, [
      { kind: "page-image", page: 1 },
      { kind: "passage", page: 1, text: "Coil assembly" },
    ]);
    const requestPhoto = await aPhoto();
    const id = await request(defectId, { note: "Coil gets hot", photos: [requestPhoto] });
    expect(await aiAssessmentBeingWritten(db, defectId)).toBe(true);
    const ai = anAi({
      chatAnswer: {
        content: JSON.stringify({
          summary: "Die Spule wird heiß.",
          probableCauses: ["Die Spule ist zu schwach."],
          whatToCheckFirst: ["Die Spule prüfen."],
          references: [{ file: pdf, page: 1 }],
        }),
        cost: 0.04,
      },
    });

    await run(ai);

    const written = await assessment(id);
    expect(written.state).toBe("written");
    const chat = ai.chatRequests[0];
    expect(chat.text).toContain("Left flipper weak");
    expect(chat.text).toContain("normal");
    expect(chat.text).toContain("The coil gets hot after ten minutes");
    expect(chat.text).toContain("Checked the coil");
    expect(chat.text).toContain("Eight Ball");
    expect(chat.text).toContain("Bally");
    expect(chat.text).toContain("1980");
    expect(chat.text).toContain("Bumper dead");
    expect(chat.text).toContain("Replaced the bumper switch");
    expect(chat.text).toContain("Coil gets hot");
    // The found page and the photos are sent as images – the found page first (the prompt names them in that order).
    expect(chat.text).toContain('"bild": 1');
    expect(chat.images.length).toBe(3); // the found page, the problem report's photo, the request's photo
    expect(chat.images[0].bytes.length).toBeGreaterThan(0);
    expect(chat.images[0].contentType).toBe("image/jpeg");
    expect(written.references).toEqual([{ fileId: pdf, page: 1 }]);
  });

  it("ST-107: What is sent to the chat model is capped", async () => {
    const machineId = await aMachine(eightBall, "LG-042");
    const { defectId } = await anOpenDefect(machineId);
    // 14 problem reports with a photo each – only the 10 newest are sent.
    for (let number = 1; number <= 14; number++) {
      const photo = await aPhoto();
      const reported = await executeCommand(
        reportProblemAndTriageCommand,
        { machineId, description: `Meldung ${number}`, photo, triage: { outcome: "linked", defectId } },
        {
          actor: tom,
          db,
          clock: fixedClock(new Date(Date.parse("2026-11-03T09:00:00Z") + number * 60_000)),
          newId: randomUUID,
        },
      );
      if (!reported.ok) throw new Error(reported.error);
    }
    // 7 resolved defects – only the 5 latest are sent.
    for (let number = 1; number <= 7; number++) {
      const old = await anOpenDefect(machineId, { title: `Behoben ${number}`, description: `Behoben ${number}` });
      const details = await defectDetails(db, old.defectId);
      if (!details) throw new Error("no defect");
      await executeCommand(
        resolveDefectCommand,
        { defectId: old.defectId, version: details.version, closingNote: `Notiz ${number}` },
        { actor: tom, db, clock, newId: randomUUID },
      );
    }
    // More than 12 matching pages and images of the machine and its model.
    const pdf = await attach({
      machineId,
      title: "Eight Ball Manual",
      contentType: "application/pdf",
      bytes: await aPdfOfText(Array.from({ length: 14 }, (_, index) => `Seite ${index + 1}`)),
    });
    // The text search (the run's first embedding, seed 1) finds pages 1–4, the first photo's search (seed 2) pages 5–8,
    // the second photo's search (seed 3) pages 9–12 – merged they are 12 pages, each once. Pages 13–14 match no search best.
    await index(pdf, [
      ...[1, 2, 3].flatMap((seed) =>
        Array.from({ length: 4 }, (_, index) => ({
          kind: "page-image" as const,
          page: (seed - 1) * 4 + index + 1,
          embedding: memoryEmbedding(seed),
        })),
      ),
      ...Array.from({ length: 2 }, (_, index) => ({ kind: "page-image" as const, page: 13 + index })),
      ...Array.from({ length: 10 }, (_, index) => ({
        kind: "passage" as const,
        page: index + 1,
        text: `Textstelle ${index + 1}`,
      })),
    ]);
    const first = await aPhoto();
    const second = await aPhoto();
    const id = await request(defectId, { note: "Coil gets hot", photos: [first, second] });
    const ai = anAi();

    await run(ai);

    const written = await assessment(id);
    expect(written.state).toBe("written");
    const chat = ai.chatRequests[0];
    // The text and each photo of the request are one search each: one text search and two photo searches.
    expect(ai.requests.filter((request) => request.startsWith("embed:")).length).toBe(3);
    // The final merge sends never more than 12 found pages or images, each once.
    const listed = JSON.parse(
      chat.text
        .split("Gefundene Seiten und Bilder (als Bilder mitgeschickt, in dieser Reihenfolge):\n")[1]
        .split("\n\n")[0],
    ) as { datei: string; seite: number }[];
    expect(listed).toHaveLength(12);
    expect(new Set(listed.map((each) => `${each.datei}:${each.seite}`)).size).toBe(12);
    expect(chat.images.length).toBe(12 + 10 + 2);
    expect(chat.text).toContain("Fotos der Meldungen (als Bilder mitgeschickt, danach): 10");
    expect(chat.text).toContain("Fotos der Anfrage (als Bilder mitgeschickt, zuletzt): 2");
    expect(chat.text).toContain("Behoben 3");
    expect(chat.text).toContain("Behoben 7");
    expect(chat.text).not.toContain("Behoben 1");
    expect(chat.text).not.toContain("Behoben 2");
    // Each single search takes at most 8 text passages and 4 pages or images (checked at the query's own seam).
    const model = await machineModelOfMachineForAi(db, machineId);
    if (!model) throw new Error("no machine model");
    const query = Array.from({ length: geminiEmbedding.embeddingSize ?? 1536 }, () => 0.1);
    const scope = { machineId, machineModelId: model.id, embeddingModel: EMBEDDING };
    expect(await searchAiIndex(db, scope, query, "text")).toHaveLength(SEARCH_TEXT_HITS);
    expect(await searchAiIndex(db, scope, query, "image")).toHaveLength(SEARCH_IMAGE_HITS);
  });

  it("ST-107: Only the files of the defect's machine and its machine model are searched", async () => {
    const machineId = await aMachine(eightBall, "LG-042");
    const otherMachine = await aMachine(eightBall, "LG-043");
    const foreignMachine = await aMachine(otherModel, "LG-099");
    const { defectId } = await anOpenDefect(machineId);
    const own = await attach({
      machineId,
      title: "LG-042 Manual",
      contentType: "text/plain",
      bytes: new TextEncoder().encode("own"),
    });
    const sibling = await attach({
      machineId: otherMachine,
      title: "LG-043 Manual",
      contentType: "text/plain",
      bytes: new TextEncoder().encode("sibling"),
    });
    const model = await attach({
      machineId,
      to: "machine-model",
      title: "Eight Ball Manual",
      contentType: "text/plain",
      bytes: new TextEncoder().encode("model"),
    });
    const foreign = await attach({
      machineId: foreignMachine,
      title: "Medieval Manual",
      contentType: "text/plain",
      bytes: new TextEncoder().encode("foreign"),
    });
    await index(own, [{ kind: "passage", text: "Der eigene Text" }]);
    await index(sibling, [{ kind: "passage", text: "Der Text des anderen Geräts" }]);
    await index(model, [{ kind: "passage", text: "Der Text des Modells" }]);
    await index(foreign, [{ kind: "passage", text: "Der fremde Text" }]);
    const photo = await aPhoto();
    const id = await request(defectId, { note: "Coil gets hot", photos: [photo] });
    const ai = anAi();

    await run(ai);

    const chat = ai.chatRequests[0];
    expect(chat.text).toContain("Der eigene Text");
    expect(chat.text).toContain("Der Text des Modells");
    expect(chat.text).not.toContain("Der Text des anderen Geräts");
    expect(chat.text).not.toContain("Der fremde Text");
    const written = await assessment(id);
    expect(written.filesSearched?.sort()).toEqual([own, model].sort());
    expect(written.filesSearched).not.toContain(sibling);
    expect(written.filesSearched).not.toContain(foreign);
  });

  it("ST-107: A reference to a file outside the defect's machine and its machine model is dropped", async () => {
    const machineId = await aMachine(eightBall, "LG-042");
    const otherMachine = await aMachine(eightBall, "LG-043");
    const { defectId } = await anOpenDefect(machineId);
    const manual = await attach({
      machineId,
      title: "Eight Ball Manual",
      contentType: "application/pdf",
      bytes: await aPdfOfText(["Seite 12"]),
    });
    const foreign = await attach({
      machineId: otherMachine,
      title: "Manual of LG-043",
      contentType: "application/pdf",
      bytes: await aPdfOfText(["Andere Seite"]),
    });
    const id = await request(defectId);
    const ai = anAi({
      chatAnswer: {
        content: JSON.stringify({
          summary: "Die Spule ist schwach.",
          probableCauses: ["Die Spule ist verschlissen.", "Der Kontakt ist oxidiert."],
          whatToCheckFirst: ["Die Spule messen."],
          references: [
            { file: manual, page: 12 },
            { file: foreign, page: 3 },
          ],
        }),
        cost: 0.04,
      },
    });

    await run(ai);

    const written = await assessment(id);
    expect(written.state).toBe("written");
    expect(written.references).toEqual([{ fileId: manual, page: 12 }]);
    expect(written.summary).toBe("Die Spule ist schwach.");
    expect(written.probableCauses).toEqual(["Die Spule ist verschlissen.", "Der Kontakt ist oxidiert."]);
    expect(written.whatToCheckFirst).toEqual(["Die Spule messen."]);
  });
});

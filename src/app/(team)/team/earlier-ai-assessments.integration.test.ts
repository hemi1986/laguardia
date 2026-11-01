import { randomBytes, randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { attachFileCommand, createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { defectDetails, reportProblemAndTriageCommand, resolveDefectCommand } from "@/modules/repair";
import {
  aiSettingsForm,
  changeAiSettingsCommand,
  requestAiAssessmentCommand,
  type AiDependencies,
} from "@/modules/ai-assistance";
import { failAiAssessmentForTest, writeAiAssessmentForTest } from "@/modules/ai-assistance/ai-assessment.test-support";
import { memoryAi, geminiEmbedding, geminiFlash } from "@/modules/ai-assistance/ai-seam.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { memoryStorage } from "@/platform/storage";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { DefectDetailsView } from "./defects/[defectId]/defect-details";
import { loadDefectDetails } from "./defects/[defectId]/defect-details-data";
import { MachineRecordView } from "./machines/[museumNumber]/machine-record";
import { loadMachineRecord } from "./machines/[museumNumber]/machine-record-data";
import { RepairHistoryView } from "./machines/[museumNumber]/reparaturhistorie/repair-history";
import { loadRepairHistory } from "./machines/[museumNumber]/reparaturhistorie/repair-history-data";

/**
 * ST-111: the earlier AI assessments of a defect – on its page below the newest one, and under the defect in the
 * machine's repair history (the machine record's latest repairs and the repair history's own page), each a native fold
 * („KI-Einschätzung vom 31.10.2026“) that opens without JavaScript. The pages compose Repair, Collection, Team and AI
 * assistance and are rendered by their views – the seam the catalog names for a composed page. In a database of its
 * own, so the machine can be "LG-042".
 */
const isolated = isolatedTestDatabase("earlier_ai_assessments");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const tomViewer = { id: tom.teamMemberId, role: "technician" } as const;
const environmentKey = randomBytes(32);
const KEY = "sk-or-v1-0123456789abcdef0123456789abcdefa1b2";
const NOW = "2026-11-01T12:00:00Z";
let eightBall: string;
let storage: ReturnType<typeof memoryStorage>;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  const created = await executeCommand(
    createMachineModelCommand,
    { title: "Eight Ball", manufacturer: "Bally", year: "1980", machineCategory: "pinball" },
    { actor: tom, db, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  eightBall = created.result.machineModelId;
});

afterAll(() => isolated.close());

beforeEach(async () => {
  await withoutMachines(db);
  storage = memoryStorage();
  await changeAi({ key: KEY, chatModel: geminiFlash.id, embeddingModel: geminiEmbedding.id });
});

function ai(): AiDependencies {
  return { ai: memoryAi({ acceptedKeys: [KEY] }), encryptionKey: () => environmentKey };
}

async function changeAi(change: { key: string; chatModel?: string; embeddingModel?: string; removeKey?: true }) {
  const dependencies = ai();
  const { version } = await aiSettingsForm(db, dependencies);
  const changed = await executeCommand(
    changeAiSettingsCommand(dependencies),
    { version, ...change },
    { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
  );
  if (!changed.ok) throw new Error(changed.error);
}

async function aMachine(museumNumber: string) {
  const registered = await executeCommand(
    registerMachineCommand,
    { machineModelId: eightBall, museumNumber, serialNumber: undefined, location: "Hall 1", machineStatus: "playable" },
    { actor: tom, db, clock: fixedClock("2026-10-01T10:00:00Z"), newId: randomUUID },
  );
  if (!registered.ok) throw new Error(registered.error);
  return registered.result.machineId;
}

async function anOpenDefect(machineId: string, title: string) {
  const reported = await executeCommand(
    reportProblemAndTriageCommand,
    {
      machineId,
      description: `${title} – first seen`,
      triage: {
        outcome: "defect-recorded",
        title,
        priority: undefined,
        suitableForHelpers: false,
        machineStatus: undefined,
        machineVersion: undefined,
      },
    },
    { actor: tom, db, clock: fixedClock("2026-10-20T10:00:00Z"), newId: randomUUID },
  );
  if (!reported.ok || !reported.result.defectId) throw new Error("no defect recorded");
  return reported.result.defectId;
}

async function resolve(defectId: string) {
  const defect = await defectDetails(db, defectId);
  if (!defect) throw new Error("no defect");
  const resolved = await executeCommand(
    resolveDefectCommand,
    { defectId, version: defect.version, closingNote: "Spule getauscht." },
    { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
  );
  if (!resolved.ok) throw new Error(resolved.error);
}

async function request(defectId: string, at: string, note = "") {
  const asked = await executeCommand(
    requestAiAssessmentCommand(ai()),
    { defectId, note, photos: [] },
    { actor: tom, db, clock: fixedClock(at), newId: randomUUID },
  );
  if (!asked.ok) throw new Error(asked.error);
  return asked.result.aiAssessmentId;
}

async function attach(defectId: string, title: string) {
  const defect = await defectDetails(db, defectId);
  if (!defect) throw new Error("no defect");
  const bytes = new TextEncoder().encode("manual");
  const name = `files/${randomUUID()}`;
  await storage.write(name, bytes, "application/pdf");
  const attached = await executeCommand(
    attachFileCommand,
    {
      machineId: defect.machineId,
      attachTo: "machine",
      title,
      fileCategory: "manual",
      content: { name, size: bytes.length, contentType: "application/pdf" },
    },
    { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
  );
  if (!attached.ok) throw new Error(attached.error);
  return attached.result.fileId;
}

/** An AI assessment requested and written on that day (Berlin noon), with its summary and an optional reference. */
async function written(defectId: string, day: string, summary: string, reference?: { fileId: string; page: number }) {
  const id = await request(defectId, `${day}T11:00:00Z`);
  await writeAiAssessmentForTest(db, id, {
    summary,
    probableCauses: [`${summary} – Ursache`],
    whatToCheckFirst: [`${summary} – zuerst prüfen`],
    references: reference ? [reference] : [],
    embeddingModel: geminiEmbedding.id,
    cost: 0.04,
    at: fixedClock(`${day}T11:05:00Z`),
  });
  return id;
}

/** An AI assessment requested and failed on that day because the credit was used up. */
async function failed(defectId: string, day: string) {
  const id = await request(defectId, `${day}T11:00:00Z`);
  await failAiAssessmentForTest(db, id, { reason: "credit-used-up", at: fixedClock(`${day}T11:05:00Z`) });
  return id;
}

async function defectPage(defectId: string) {
  const data = await loadDefectDetails(db, fixedClock(NOW), defectId, { viewer: tomViewer, storage, ai: ai() });
  if (!data) throw new Error("no defect page");
  return renderToStaticMarkup(createElement(DefectDetailsView, { details: data }));
}

async function machineRecordPage(museumNumber: string) {
  const record = await loadMachineRecord(db, museumNumber, {
    clock: fixedClock(NOW),
    viewer: tomViewer,
    ai: ai(),
    storage,
  });
  return renderToStaticMarkup(createElement(MachineRecordView, { record, museumNumber }));
}

async function repairHistoryPage(museumNumber: string) {
  const data = await loadRepairHistory(db, museumNumber, "2026", { clock: fixedClock(NOW), storage, ai: ai() });
  return renderToStaticMarkup(createElement(RepairHistoryView, { data, museumNumber }));
}

/** The AI assessment folds of a piece of the page, in page order – whether open, their header and what they hold. */
function aiAssessmentFolds(html: string) {
  return [
    ...html.matchAll(/<details([^>]*)><summary[^>]*>(KI-Einschätzung vom [^<]*)<\/summary>(.*?)<\/details>/gs),
  ].map(([, attributes, header, body]) => ({ open: /\sopen/.test(attributes), header, body }));
}

/** The part of the page about one entry of the repair history: from its title to the end of its article. */
function entry(html: string, title: string): string {
  const start = html.indexOf(`>${title}<`);
  if (start < 0) return "";
  const end = html.indexOf("</article>", start);
  return html.slice(start, end < 0 ? undefined : end);
}

/** The section „KI-Einschätzungen“ of a defect page, up to the next section. */
function aiSection(html: string): string {
  const start = html.indexOf(">KI-Einschätzungen<");
  if (start < 0) return "";
  const next = html.indexOf("<section", start);
  return html.slice(start, next < 0 ? undefined : next);
}

describe("earlier AI assessments (ST-111)", () => {
  it("ST-111: The newest AI assessment is open and the older ones are folded", async () => {
    const machineId = await aMachine("LG-042");
    const defectId = await anOpenDefect(machineId, "Left flipper weak");
    await written(defectId, "2026-10-29", "Die Spule ist schwach.");
    await failed(defectId, "2026-10-30");
    await written(defectId, "2026-10-31", "Der Kontakt ist oxidiert.");

    const section = aiSection(await defectPage(defectId));

    // The newest is shown open, outside any fold, above the folds.
    const folds = aiAssessmentFolds(section);
    expect(section).toContain("Der Kontakt ist oxidiert.");
    expect(folds.some((fold) => fold.body.includes("Der Kontakt ist oxidiert."))).toBe(false);
    expect(section.indexOf("Der Kontakt ist oxidiert.")).toBeLessThan(section.indexOf("<details"));
    expect(folds.map(({ header, open }) => ({ header, open }))).toEqual([
      { header: "KI-Einschätzung vom 30.10.2026", open: false },
      { header: "KI-Einschätzung vom 29.10.2026", open: false },
    ]);
  });

  it("ST-111: An earlier AI assessment opens without JavaScript", async () => {
    const machineId = await aMachine("LG-042");
    const defectId = await anOpenDefect(machineId, "Left flipper weak");
    const manual = await attach(defectId, "Eight Ball Manual");
    await written(defectId, "2026-10-29", "Die Spule ist schwach.", { fileId: manual, page: 12 });
    await failed(defectId, "2026-10-30");
    await written(defectId, "2026-10-31", "Der Kontakt ist oxidiert.");

    // A native <details> holds its content in the page: the browser opens it without JavaScript.
    const [olderFailed, olderWritten] = aiAssessmentFolds(aiSection(await defectPage(defectId)));

    expect(olderWritten.body).toContain("Die Spule ist schwach.");
    expect(olderWritten.body).toContain("Wahrscheinliche Ursachen");
    expect(olderWritten.body).toContain("Die Spule ist schwach. – Ursache");
    expect(olderWritten.body).toContain("Zuerst prüfen");
    expect(olderWritten.body).toContain("Die Spule ist schwach. – zuerst prüfen");
    expect(olderWritten.body).toContain("Fundstellen");
    expect(olderWritten.body).toContain(`/team/dateien/${manual}`);
    expect(olderWritten.body).toContain("Eight Ball Manual, S. 12");
    expect(olderWritten.body).toContain(
      "KI-Einschätzung · Gemini 2.5 Flash · 29.10.2026, 12:05 · angefordert von Tom · 0,04 $",
    );
    expect(olderFailed.body).toContain("KI-Einschätzung fehlgeschlagen: Das Guthaben bei OpenRouter ist aufgebraucht.");
    // „Erneut versuchen“ belongs to the newest only – an older failed one is history.
    expect(olderFailed.body).not.toContain("Erneut versuchen");
  });

  it("ST-111: An AI assessment being written is on top and the newest written one is folded", async () => {
    const machineId = await aMachine("LG-042");
    const defectId = await anOpenDefect(machineId, "Left flipper weak");
    await written(defectId, "2026-10-31", "Die Spule ist schwach.");
    await request(defectId, NOW);

    const section = aiSection(await defectPage(defectId));

    expect(section).toContain("KI-Einschätzung läuft …");
    const folds = aiAssessmentFolds(section);
    expect(folds.map(({ header, open }) => ({ header, open }))).toEqual([
      { header: "KI-Einschätzung vom 31.10.2026", open: false },
    ]);
    expect(folds[0].body).toContain("Die Spule ist schwach.");
    expect(section.indexOf("KI-Einschätzung läuft …")).toBeLessThan(section.indexOf("<details"));
  });

  it("ST-111: The repair history shows each defect's AI assessments folded", async () => {
    const machineId = await aMachine("LG-042");
    const flipper = await anOpenDefect(machineId, "Left flipper weak");
    const display = await anOpenDefect(machineId, "Display flickers");
    await written(flipper, "2026-10-29", "Die Spule ist schwach.");
    await written(flipper, "2026-10-31", "Der Kontakt ist oxidiert.");
    await resolve(flipper);
    await resolve(display);

    for (const html of [await machineRecordPage("LG-042"), await repairHistoryPage("LG-042")]) {
      const folds = aiAssessmentFolds(entry(html, "Left flipper weak"));
      expect(folds.map(({ header, open }) => ({ header, open }))).toEqual([
        { header: "KI-Einschätzung vom 31.10.2026", open: false },
        { header: "KI-Einschätzung vom 29.10.2026", open: false },
      ]);
      expect(folds[0].body).toContain("Der Kontakt ist oxidiert.");
      expect(folds[1].body).toContain("Die Spule ist schwach.");
      expect(entry(html, "Display flickers")).not.toContain("KI-Einschätzung");
    }
  });

  it("ST-111: Earlier AI assessments stay readable while AI is off", async () => {
    const machineId = await aMachine("LG-042");
    const defectId = await anOpenDefect(machineId, "Left flipper weak");
    await written(defectId, "2026-10-29", "Die Spule ist schwach.");
    await written(defectId, "2026-10-31", "Der Kontakt ist oxidiert.");
    await changeAi({ key: "", removeKey: true });

    const defect = aiSection(await defectPage(defectId));
    expect(defect).toContain("Der Kontakt ist oxidiert.");
    const [older] = aiAssessmentFolds(defect);
    expect(older.header).toBe("KI-Einschätzung vom 29.10.2026");
    expect(older.body).toContain("Die Spule ist schwach.");
    expect(defect).not.toContain("KI-Einschätzung anfordern");

    const history = entry(await repairHistoryPage("LG-042"), "Left flipper weak");
    expect(aiAssessmentFolds(history).map(({ header }) => header)).toEqual([
      "KI-Einschätzung vom 31.10.2026",
      "KI-Einschätzung vom 29.10.2026",
    ]);
    expect(history).toContain("Der Kontakt ist oxidiert.");
    expect(history).toContain("Die Spule ist schwach.");
  });
});

import { randomBytes, randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { attachFileCommand, createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import {
  aiSettingsForm,
  aiWorkLeftUnfinished,
  changeAiSettingsCommand,
  fileIndexingWork,
  retryFileIndexingCommand,
  runAiWork,
  type AiDependencies,
} from "@/modules/ai-assistance";
import { formRunner } from "@/app/_actions/form-runner";
import type { Actor } from "@/platform/command";
import { post } from "@/test-support/forms";
import { geminiEmbedding, geminiFlash, memoryAi } from "@/modules/ai-assistance/ai-seam.test-support";
import { steppingClock } from "@/modules/ai-assistance/ai-work-stand-in.test-support";
import { executeCommand, journalOf } from "@/platform/command";
import { memoryStorage, type MemoryStorage } from "@/platform/storage";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadAiSettings, startAiWorkOnOpening } from "./ai-settings-data";
import { AiSettingsSection } from "./ai-settings-section";
import { loadMachineRecord } from "../machines/[museumNumber]/machine-record-data";
import { MachineRecordView } from "../machines/[museumNumber]/machine-record";
import { retriedLanding, retryFileIndexingForm } from "./retry-file-indexing-definition";

/**
 * ST-109: the overview „KI-Erfassung“ in the form „KI“ on „Einstellungen“, „Erneut versuchen“ on a failed file, and the
 * mark „Für die KI nicht lesbar“ on the machine record. Files are attached through Collection's command and indexed by
 * one run of the background work driven directly (`runAiWork` with the real file kind, the injected clock, in-memory AI
 * and storage – ADR 0015, the seam catalog's run seam); the pages are their data functions rendered by their views. In
 * a database of its own: the AI settings and the AI index are one set.
 */
const isolated = isolatedTestDatabase("ai_index_overview");
let db: NodePgDatabase;
const clock = steppingClock("2026-11-04T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const ben = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const environmentKey = randomBytes(32);
const KEY = "sk-or-v1-0123456789abcdef0123456789abcdefa1b2";
let eightBall: string;
let storage: MemoryStorage;

afterAll(() => isolated.close());

/**
 * Every test from an empty database: the journal is append-only, and the cost of indexing so far is summed from all of
 * it – a run of another test would count.
 */
beforeEach(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, eva, "Eva");
  await anExistingTeamMember(db, ben, "Ben");
  clock.set("2026-11-04T10:00:00Z");
  storage = memoryStorage();
  const created = await executeCommand(
    createMachineModelCommand,
    { title: "Eight Ball", manufacturer: "Bally", year: "1980", machineCategory: "pinball" },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  eightBall = created.result.machineModelId;
});

/** The AI seam – by default it accepts KEY, offers the Gemini models and charges what a test says per embedding. */
function ai(settings: Parameters<typeof memoryAi>[0] = {}): AiDependencies & { ai: ReturnType<typeof memoryAi> } {
  return { ai: memoryAi({ acceptedKeys: [KEY], ...settings }), encryptionKey: () => environmentKey };
}

/** AI turned on through CMD-ChangeAiSettings, the way a technician saves it. */
async function turnAiOn(): Promise<void> {
  const dependencies = ai();
  const { version } = await aiSettingsForm(db, dependencies);
  const saved = await executeCommand(
    changeAiSettingsCommand(dependencies),
    { version, key: KEY, chatModel: geminiFlash.id, embeddingModel: geminiEmbedding.id },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!saved.ok) throw new Error(saved.error);
}

/** The key removed through CMD-ChangeAiSettings – AI is off, the AI index is kept. */
async function removeTheKey(): Promise<void> {
  const dependencies = ai();
  const { version } = await aiSettingsForm(db, dependencies);
  const removed = await executeCommand(
    changeAiSettingsCommand(dependencies),
    { version, key: "", removeKey: true },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!removed.ok) throw new Error(removed.error);
}

async function aMachine(museumNumber: string): Promise<string> {
  const registered = await executeCommand(
    registerMachineCommand,
    { machineModelId: eightBall, museumNumber, serialNumber: undefined, location: "Hall 1", machineStatus: "playable" },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!registered.ok) throw new Error(registered.error);
  return registered.result.machineId;
}

const kinds = {
  text: { contentType: "text/plain", bytes: () => new TextEncoder().encode("The flipper coil and its fuse.") },
  video: { contentType: "video/mp4", bytes: () => new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]) },
} as const;

/** A file attached through CMD-AttachFile to the machine or to its machine model, its content already in the store. */
async function attach(
  machineId: string,
  title: string,
  { kind = "text", to = "machine" }: { kind?: keyof typeof kinds; to?: "machine" | "machine-model" } = {},
): Promise<string> {
  const { contentType, bytes } = kinds[kind];
  const content = bytes();
  const name = `files/${randomUUID()}`;
  await storage.write(name, content, contentType);
  const attached = await executeCommand(
    attachFileCommand,
    { machineId, attachTo: to, title, fileCategory: "other", content: { name, size: content.length, contentType } },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!attached.ok) throw new Error(attached.error);
  return attached.result.fileId;
}

/** One run of the background work with the real file kind. */
async function run(dependencies: AiDependencies = ai()): Promise<void> {
  await runAiWork({
    db,
    clock,
    budgetSeconds: 250,
    ai: dependencies,
    storage,
    continueWork: async () => {},
    kinds: [fileIndexingWork],
  });
}

/** „Einstellungen“ as Tom opens it – the section „KI“ rendered from its data. */
async function settingsPage(dependencies: AiDependencies = ai(), params: Record<string, string | undefined> = {}) {
  const data = await loadAiSettings(db, params, { dependencies, viewer: tom.teamMemberId });
  return { data, html: renderToStaticMarkup(createElement(AiSettingsSection, data)) };
}

/** The machine record as a team member opens it – the whole team sees the mark. */
async function machineRecord(museumNumber: string, viewer: Actor & { kind: "team-member" } = ben, dependencies = ai()) {
  const record = await loadMachineRecord(db, museumNumber, {
    clock,
    viewer: { id: viewer.teamMemberId, role: viewer.role },
    ai: dependencies,
  });
  return { record, html: renderToStaticMarkup(createElement(MachineRecordView, { record, museumNumber })) };
}

/** The list item of a file on the machine record. */
function fileItem(html: string, title: string): string {
  const at = html.indexOf(`>${title}</a>`);
  if (at < 0) throw new Error(`${title} is not listed`);
  return html.slice(html.lastIndexOf("<li", at), html.indexOf("</li>", at));
}

/** What „Erneut versuchen“ did: where it landed and how many runs it started after the response. */
type Retried = { landed: string | undefined; starts: number };

/** „Erneut versuchen“ posted through the real Server Action runner as this person, with these fields. */
async function retry(fields: { fileId: string; version: number }, actor: Actor = tom, dependencies = ai()) {
  const retried: Retried = { landed: undefined, starts: 0 };
  const action = formRunner({ currentPerson: async () => actor, db, clock, newId: randomUUID })(
    retryFileIndexingCommand(dependencies),
    retryFileIndexingForm(async ({ fileId }) => {
      retried.starts += 1;
      retried.landed = retriedLanding(fileId);
    }),
  );
  const state = await action(null, post({ fileId: fields.fileId, version: String(fields.version) }));
  return { state, ...retried };
}

/** What the journal holds of a file – its AI index entry shares the file's ID. */
const journalOfFile = (fileId: string) => journalOf(db, { aggregateId: fileId });

/** The failed file of this title as the overview lists it – what its „Erneut versuchen“ posts. */
async function failedOnPage(title: string) {
  const { data } = await settingsPage();
  const failed = data.overview?.failed.find((file) => file.title === title);
  if (!failed) throw new Error(`${title} is not listed as failed`);
  return { fileId: failed.fileId, version: failed.version };
}

describe("the overview „KI-Erfassung“ (ST-109)", () => {
  it("ST-109: The overview shows how far the AI index got and what it cost", async () => {
    await turnAiOn();
    const machineId = await aMachine("LG-042");
    for (let number = 1; number <= 12; number++) await attach(machineId, `Notes ${number}`);
    await attach(machineId, "Attract mode.mp4", { kind: "video" });
    await attach(machineId, "Intro.mp4", { kind: "video" });
    // Every text file is one passage, so one embedding request each: 12 × 0.1025 $ = 1.23 $.
    await run(ai({ embeddingCost: 0.1025 }));
    // Attached after the run – no run has reached them yet.
    for (const title of ["Wiring notes", "Coil list", "Fuse list"]) await attach(machineId, title);

    const { html } = await settingsPage();

    expect(html).toContain("KI-Erfassung");
    expect(html).toContain("12 Dateien für die KI erfasst · 3 warten auf KI-Erfassung · 2 für die KI nicht lesbar");
    expect(html).toContain("Kosten der KI-Erfassung bisher: 1,23 $");
  });

  it("ST-109: Failed files are listed with what they belong to and why", async () => {
    await turnAiOn();
    const machineId = await aMachine("LG-042");
    const attract = await attach(machineId, "Attract mode.mp4", { kind: "video" });
    await run();
    const schematic = await attach(machineId, "Eight Ball Schematic", { to: "machine-model" });
    await run(ai({ unreachable: true }));

    const { data, html } = await settingsPage();

    expect(data.overview?.failed).toEqual([
      { fileId: attract, owner: "LG-042", title: "Attract mode.mp4", reason: "format not indexed", version: 0 },
      {
        fileId: schematic,
        owner: "Eight Ball",
        title: "Eight Ball Schematic",
        reason: "OpenRouter not reachable",
        version: 0,
      },
    ]);
    expect(html).toContain("LG-042 · Attract mode.mp4 – Dateiformat wird nicht erfasst");
    expect(html).toContain("Eight Ball · Eight Ball Schematic – OpenRouter war nicht erreichbar");
    expect(html.match(/Erneut versuchen/g)).toHaveLength(2);
  });

  it("ST-109: Nothing indexed yet", async () => {
    await turnAiOn();

    const { data, html } = await settingsPage();

    expect(data.overview).toMatchObject({ indexed: 0, waiting: 0, failed: [] });
    expect(html).toContain("Noch keine Datei für die KI erfasst.");
    expect(html).not.toContain("Erneut versuchen");
  });

  it("ST-109: A technician tries a failed file again", async () => {
    await turnAiOn();
    await aMachine("LG-042");
    const schematic = await attach(await aMachine("LG-043"), "Eight Ball Schematic", { to: "machine-model" });
    await run(ai({ unreachable: true }));

    const retried = await retry(await failedOnPage("Eight Ball Schematic"));

    expect(retried).toEqual({ state: null, landed: `/team/museum-settings?retried=${schematic}`, starts: 1 });
    const landed = await settingsPage(ai(), { retried: schematic });
    expect(landed.html).toContain("Eight Ball Schematic wird erneut für die KI erfasst.");
    // Waiting until the run started after the response has indexed it.
    expect(landed.data.overview).toMatchObject({ indexed: 0, waiting: 1, failed: [] });

    // OpenRouter answers this time.
    await run();

    const { data, html } = await settingsPage();
    expect(data.overview).toMatchObject({ indexed: 1, waiting: 0, failed: [] });
    expect(html).toContain("1 Datei für die KI erfasst · 0 warten auf KI-Erfassung · 0 für die KI nicht lesbar");
    expect(html).not.toContain("Erneut versuchen");
  });

  it("ST-109: Only a failed file can be tried again", async () => {
    await turnAiOn();
    const manual = await attach(await aMachine("LG-042"), "Eight Ball Manual", { to: "machine-model" });
    await run(ai({ unreachable: true }));
    // Tom's page was opened while the manual had failed; Eva tried it again meanwhile and it was indexed.
    const tomsPage = await failedOnPage("Eight Ball Manual");
    expect((await retry(tomsPage, eva)).state).toBeNull();
    await run();
    const journalBefore = await journalOfFile(manual);
    const openRouter = ai();

    const retried = await retry(tomsPage, tom, openRouter);
    await run(openRouter);

    expect(retried).toEqual({
      state: { error: "file-indexing-not-failed", values: { fileId: manual, version: String(tomsPage.version) } },
      landed: undefined,
      starts: 0,
    });
    expect(openRouter.ai.requests.filter((request) => request.startsWith("embed:"))).toEqual([]);
    expect(await journalOfFile(manual)).toEqual(journalBefore);
    const { data } = await settingsPage();
    expect(data.overview).toMatchObject({ indexed: 1, waiting: 0, failed: [] });
  });

  it("ST-109: An indexing that broke off shows as failed and can be tried again by hand", async () => {
    await turnAiOn();
    await attach(await aMachine("LG-042"), "Eight Ball Manual", { to: "machine-model" });
    // The run indexing the manual is cut off while it asks for an embedding – a crash, a deployment, the time limit.
    let embedding!: () => void;
    const embeddingStarted = new Promise<void>((resolve) => (embedding = resolve));
    const never = new Promise<never>(() => {});
    void run(
      ai({
        beforeEmbed: async () => {
          embedding();
          await never;
        },
      }),
    );
    await embeddingStarted;
    const starts: string[] = [];
    // What „Einstellungen“ does when it is opened – the page's own decision, with a start the test counts.
    const openingStartsARun = async () =>
      startAiWorkOnOpening((await settingsPage()).data, {
        leftUnfinished: (kind, pieceIds) => aiWorkLeftUnfinished(db, clock, kind, pieceIds),
        start: () => starts.push("run"),
      });
    // Until the hold has run out the manual is waiting, and opening the page starts nothing.
    expect(await openingStartsARun()).toBe(false);
    expect((await settingsPage()).data.overview).toMatchObject({ waiting: 1, failed: [] });

    // The hold – twice the budget of 250 s – has run out without a result, and no other run has started since.
    clock.set("2026-11-04T10:08:21Z");
    expect(await openingStartsARun()).toBe(true);
    expect(starts).toEqual(["run"]);
    const started = ai();
    await run(started);

    expect(started.ai.requests.filter((request) => request.startsWith("embed:"))).toEqual([]);
    const { html } = await settingsPage();
    expect(html).toContain("Eight Ball · Eight Ball Manual – Erfassung abgebrochen");
    expect(html).toContain("Erneut versuchen");

    // No later run indexes it again until a technician taps „Erneut versuchen“.
    const later = ai();
    clock.set("2026-11-04T10:20:00Z");
    await run(later);
    expect(later.ai.requests.filter((request) => request.startsWith("embed:"))).toEqual([]);
    expect((await settingsPage()).data.overview?.failed).toMatchObject([
      { title: "Eight Ball Manual", reason: "broken off" },
    ]);
    // Opening „Einstellungen“ again starts no run: no hold has run out.
    expect(await openingStartsARun()).toBe(false);
    expect(starts).toEqual(["run"]);
  });
});

describe("the mark on the machine record (ST-109)", () => {
  it("ST-109: The machine record marks only files the AI cannot read", async () => {
    await turnAiOn();
    const machineId = await aMachine("LG-042");
    await attach(machineId, "Eight Ball Manual");
    await attach(machineId, "Attract mode.mp4", { kind: "video" });
    await run();
    await attach(machineId, "Wiring notes");

    const { html } = await machineRecord("LG-042");

    expect(fileItem(html, "Attract mode.mp4")).toContain("Für die KI nicht lesbar");
    expect(fileItem(html, "Eight Ball Manual")).not.toContain("Für die KI nicht lesbar");
    expect(fileItem(html, "Wiring notes")).not.toContain("Für die KI nicht lesbar");
    expect(html.match(/Für die KI nicht lesbar/g)).toHaveLength(1);
  });

  it("ST-109: While AI is off neither the overview nor the mark is shown", async () => {
    await turnAiOn();
    const machineId = await aMachine("LG-042");
    for (let number = 1; number <= 12; number++) await attach(machineId, `Notes ${number}`);
    const attract = await attach(machineId, "Attract mode.mp4", { kind: "video" });
    await run();
    const failed = await failedOnPage("Attract mode.mp4");
    await removeTheKey();

    const settings = await settingsPage();
    const record = await machineRecord("LG-042");

    expect(settings.data.overview).toBeUndefined();
    const starts: string[] = [];
    const opened = await startAiWorkOnOpening(settings.data, {
      leftUnfinished: async () => true,
      start: () => starts.push("run"),
    });
    expect({ opened, starts }).toEqual({ opened: false, starts: [] });
    expect(settings.html).not.toContain("KI-Erfassung");
    expect(settings.html).not.toContain("Erneut versuchen");
    expect(record.html).not.toContain("Für die KI nicht lesbar");
    const openRouter = ai();
    const retried = await retry(failed, tom, openRouter);
    await run(openRouter);
    expect(retried).toMatchObject({ state: { error: "file-indexing-ai-off" }, starts: 0 });
    expect(openRouter.ai.requests.filter((request) => request.startsWith("embed:"))).toEqual([]);

    // AI on again: both come back as before.
    await turnAiOn();
    const again = await settingsPage();
    expect(again.data.overview).toMatchObject({ indexed: 12, waiting: 0 });
    expect(again.data.overview?.failed).toMatchObject([{ fileId: attract, reason: "format not indexed" }]);
    expect(fileItem((await machineRecord("LG-042")).html, "Attract mode.mp4")).toContain("Für die KI nicht lesbar");
  });
});

describe("helpers (ST-109)", () => {
  it("ST-109: Helpers cannot try a failed file again", async () => {
    await turnAiOn();
    await attach(await aMachine("LG-042"), "Eight Ball Schematic", { to: "machine-model" });
    await run(ai({ unreachable: true }));
    const failed = await failedOnPage("Eight Ball Schematic");
    const openRouter = ai();

    const retried = await retry(failed, ben, openRouter);
    await run(openRouter);

    expect(retried).toMatchObject({ state: { error: "not-authorized" }, starts: 0 });
    expect(openRouter.ai.requests.filter((request) => request.startsWith("embed:"))).toEqual([]);
    expect((await settingsPage()).data.overview?.failed).toMatchObject([{ title: "Eight Ball Schematic" }]);
    // The overview is on „Einstellungen“, which helpers do not reach: the page and its action check
    // `requireTechnician()` – the browser test „ST-104: Helpers do not get the AI settings“ shows it.
  });

  it("a forged „Erneut versuchen“ with a file that is no ID is answered, not thrown", async () => {
    await turnAiOn();

    const retried = await retry({ fileId: "../../etc/passwd", version: 0 });

    expect(retried).toMatchObject({ state: { error: "not-found" }, starts: 0 });
  });
});

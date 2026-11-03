import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  addFileCommand,
  createMachineModelCommand,
  registerMachineCommand,
  removeFileCommand,
} from "@/modules/collection";
import { retireMachineCommand } from "@/modules/repair";
import { makesAiWork } from "@/modules/ai-assistance/ai-work-events";
import { retryFileIndexingCommand, fileIndexingWork, type AiDependencies } from "@/modules/ai-assistance";
import { aiScenario } from "@/modules/ai-assistance/ai-scenario.test-support";
import { steppingClock } from "@/modules/ai-assistance/ai-work-stand-in.test-support";
import { formRunner } from "@/app/_actions/form-runner";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { memoryStorage, type MemoryStorage } from "@/platform/storage";
import { post } from "@/test-support/forms";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadAiSettings } from "../../../museum-settings/ai-settings-data";
import { AiSettingsSection } from "../../../museum-settings/ai-settings-section";
import { retryFileIndexingForm } from "../../../museum-settings/retry-file-indexing-definition";
import { loadMachineRecord } from "../../../machines/[museumNumber]/machine-record-data";
import { MachineRecordView } from "../../../machines/[museumNumber]/machine-record";
import { loadFileDetails } from "./file-details-data";
import { FileDetailsView } from "./file-details-view";
import { fileDetailsAddress } from "./file-origin";

/**
 * ST-114: the file details page – Collection's file, AI assistance's state and Team's name composed by the page data
 * function and rendered by its view; the entry points are the machine record's and the form „KI“'s own pages, rendered
 * from their data. Files are added through Collection's command (attachments set up with CMD-AddFile, since CMD-AttachFile
 * arrives with ST-115) and indexed by one run of the background work driven directly (ADR 0015). In a database of its
 * own: the AI settings and the AI index are one set.
 */
const isolated = isolatedTestDatabase("file_details");
let db: NodePgDatabase;
let storage: MemoryStorage;
const clock = steppingClock("2026-11-02T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const ben = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
let medievalMadness: string;

afterAll(() => isolated.close());

beforeEach(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, ben, "Ben");
  clock.set("2026-11-02T10:00:00Z");
  storage = memoryStorage();
  const created = await executeCommand(
    createMachineModelCommand,
    { title: "Medieval Madness", manufacturer: "Williams", year: "1997", machineCategory: "pinball" },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  medievalMadness = created.result.machineModelId;
});

const scenario = aiScenario({ db: () => db, storage: () => storage, clock, technician: tom });
const { ai, turnAiOn, removeTheKey } = scenario;

async function aMachine(museumNumber: string): Promise<string> {
  const registered = await executeCommand(
    registerMachineCommand,
    {
      machineModelId: medievalMadness,
      museumNumber,
      serialNumber: undefined,
      location: "Hall 1",
      machineStatus: "playable",
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!registered.ok) throw new Error(registered.error);
  return registered.result.machineId;
}

const kinds = {
  text: { contentType: "text/plain", bytes: () => new TextEncoder().encode("The flipper coil and its fuse.") },
  video: { contentType: "video/mp4", bytes: () => new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]) },
} as const;

/** A file attached to the machine by the scenario – a text file by default. */
function attach(machineId: string, title: string, kind: keyof typeof kinds = "text"): Promise<string> {
  const { contentType, bytes } = kinds[kind];
  return scenario.attachFile(machineId, { title, bytes: bytes(), contentType, fileCategory: "other" });
}

const run = (dependencies: AiDependencies = ai()) => scenario.run({ kinds: [fileIndexingWork], with: dependencies });

type Viewer = Actor & { kind: "team-member" };
const viewerOf = (person: Viewer) => ({ id: person.teamMemberId, role: person.role });

/** The file details as a team member opens them – params are the address's query. */
async function details(
  fileId: string,
  {
    params = {},
    person = tom,
    dependencies = ai(),
  }: { params?: Record<string, string>; person?: Viewer; dependencies?: AiDependencies } = {},
) {
  const file = await loadFileDetails(db, fileId, { params, viewer: viewerOf(person), ai: dependencies });
  if (!file) return { file, html: "" };
  const html = renderToStaticMarkup(createElement(FileDetailsView, { file, retry: async () => null }));
  return { file, html };
}

/** The query of an address a page offered – what the person's next request carries. */
const queryOf = (href: string) => Object.fromEntries(new URL(href, "http://museum.test").searchParams);

/** The machine record as a team member opens it. */
async function machineRecord(museumNumber: string, person: Viewer = ben) {
  const record = await loadMachineRecord(db, museumNumber, { clock, viewer: viewerOf(person), ai: ai() });
  return renderToStaticMarkup(createElement(MachineRecordView, { record, museumNumber }));
}

/** „Einstellungen“ as Tom opens it. */
async function settingsPage() {
  const data = await loadAiSettings(db, {}, { dependencies: ai(), viewer: tom.teamMemberId });
  return renderToStaticMarkup(createElement(AiSettingsSection, data));
}

/** The address of the link with this accessible name or text in the markup. */
function hrefOf(html: string, linkText: string): string {
  const at = html.indexOf(`>${linkText}</a>`);
  if (at < 0) throw new Error(`No link „${linkText}“`);
  const start = html.lastIndexOf("<a ", at);
  return /href="([^"]+)"/.exec(html.slice(start, at))![1].replaceAll("&amp;", "&");
}

const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

/** What „Erneut versuchen“ did: where it landed and how many runs it started after the response. */
async function retry(
  fields: { fileId: string; version: number },
  person: Viewer,
  from: string | undefined,
  dependencies = ai(),
) {
  const result = { landed: undefined as string | undefined, starts: 0 };
  const action = formRunner({
    currentPerson: async () => person,
    db,
    clock,
    newId: randomUUID,
    afterCommit: (events) => {
      if (makesAiWork(events)) result.starts += 1;
    },
  })(
    retryFileIndexingCommand(dependencies),
    retryFileIndexingForm(async ({ fileId }) => {
      result.landed = fileDetailsAddress(fileId, from, { retried: true });
    }),
  );
  const state = await action(null, post({ fileId: fields.fileId, version: String(fields.version) }));
  return { state, ...result };
}

/** A file added with several attachments at once – the way a test sets them up before CMD-AttachFile. */
async function aFileAttachedTo(
  { machines = [], models = [] }: { machines?: string[]; models?: string[] },
  title: string,
  size = 4_200_000,
): Promise<string> {
  const added = await executeCommand(
    addFileCommand,
    {
      title,
      fileCategory: "manual",
      originalFileName: undefined,
      machineIds: machines,
      machineModelIds: models,
      content: { name: `files/${randomUUID()}`, size, contentType: "application/pdf" },
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!added.ok) throw new Error(added.error);
  return added.result.fileId;
}

describe("the file details (ST-114)", () => {
  it("ST-114: A team member opens a file's details from the machine record", async () => {
    const machineId = await aMachine("LG-042");
    const manual = await aFileAttachedTo(
      { models: [medievalMadness] },
      "MM Operations Manual",
      Math.round(12.4 * 1024 * 1024),
    );

    const record = await machineRecord("LG-042", ben);
    const address = hrefOf(record, "Details");
    const page = await details(manual, { params: queryOf(address), person: ben });

    expect(machineId).toBeDefined();
    expect(address.startsWith(`/team/dateien/${manual}/details`)).toBe(true);
    expect(page.html).toContain("<h1");
    expect(page.html).toContain("MM Operations Manual</h1>");
    expect(page.html).toContain("Handbuch · PDF · 12,4 MB");
    expect(page.html).toContain("Hinzugefügt von Tom am 02.11.2026");
    // „Datei öffnen“ goes to the file's address, which opens the file as it does today (ST-037).
    expect(hrefOf(page.html, "Datei öffnen")).toBe(`/team/dateien/${manual}`);
  });

  it("ST-114: „Angehängt an“ names every machine and machine model", async () => {
    const current = await aMachine("LG-042");
    const retiredOne = await aMachine("LG-041");
    const manual = await aFileAttachedTo(
      { machines: [current, retiredOne], models: [medievalMadness] },
      "MM Operations Manual",
    );
    const retired = await executeCommand(
      retireMachineCommand,
      { machineId: retiredOne, version: 0, reason: "Sold" },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!retired.ok) throw new Error(retired.error);

    const { html } = await details(manual);

    const lines = [...html.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map((match) => match[1].replace(/<[^>]+>/g, ""));
    expect(lines).toEqual([
      "LG-042 · Medieval Madness",
      "LG-041 · Ausgemustert",
      "Alle Geräte des Modells Medieval Madness",
    ]);
    expect(hrefOf(html, "LG-041 · Ausgemustert")).toBe("/team/machines/LG-041");
  });

  it("ST-114: „KI-Erfassung“ says how far the AI index got", async () => {
    await turnAiOn();
    const machineId = await aMachine("LG-042");
    const indexed = await attach(machineId, "Indexed manual");
    const failed = await attach(machineId, "MM Operations Manual", "video");
    await run();
    // Attached after the run: no entry for the current model yet.
    const waiting = await attach(machineId, "Waiting manual");
    const examples = [
      [indexed, "Für die KI erfasst"],
      [waiting, "Wartet auf KI-Erfassung"],
      [failed, "Für die KI nicht lesbar: Dateiformat wird nicht erfasst"],
    ] as const;
    const openRouter = ai();
    const journalOfFiles = async () =>
      Promise.all([indexed, waiting, failed].map((id) => journalOf(db, { aggregateId: id })));
    const journalBefore = await journalOfFiles();

    for (const [fileId, text] of examples) {
      const { html } = await details(fileId, { dependencies: openRouter });
      expect(html).toContain("KI-Erfassung");
      expect(html).toContain(text);
    }

    // Opening a page started no run: nothing was asked of OpenRouter and nothing was recorded.
    expect(openRouter.ai.requests).toEqual([]);
    expect(await journalOfFiles()).toEqual(journalBefore);
  });

  it("ST-114: A technician tries a failed file again from its details", async () => {
    await turnAiOn();
    const machineId = await aMachine("LG-042");
    const schematic = await attach(machineId, "Eight Ball Schematic");
    await run(ai({ unreachable: true }));
    // A forged `retried` confirms nothing: the journal says nobody tried the file again yet.
    expect((await details(schematic, { params: { retried: "1" } })).html).not.toContain(
      "wird erneut für die KI erfasst",
    );
    const before = await details(schematic, { params: { from: "settings" } });
    expect(before.html).toContain("Für die KI nicht lesbar: OpenRouter war nicht erreichbar");
    expect(before.html).toContain("Erneut versuchen");
    expect(before.file?.ai).toMatchObject({ state: "failed" });
    const version = before.file!.ai!.state === "failed" ? before.file!.ai!.version : -1;

    const retried = await retry({ fileId: schematic, version }, tom, "settings");

    expect(retried).toEqual({
      state: null,
      landed: `/team/dateien/${schematic}/details?from=settings&retried=1`,
      starts: 1,
    });
    const after = await details(schematic, { params: queryOf(retried.landed!) });
    expect(after.html).toContain("Eight Ball Schematic wird erneut für die KI erfasst.");
    expect(after.html).toContain("Wartet auf KI-Erfassung");
    expect(after.html).not.toContain("Erneut versuchen");
    // Nothing on the page refreshes it: the state is what the next load shows.
    expect(after.html).not.toMatch(/refresh/i);
    // The origin is kept.
    expect(after.html).toContain("Zurück zu den Einstellungen");
    // The next load shows the state by then.
    await run();
    expect((await details(schematic)).html).toContain("Für die KI erfasst");
  });

  it("ST-114: While AI is off there is no section „KI-Erfassung“", async () => {
    await turnAiOn();
    const attract = await attach(await aMachine("LG-042"), "Attract mode.mp4", "video");
    await run();
    const version = (await details(attract)).file!.ai!.state === "failed" ? 0 : -1;
    await removeTheKey();

    const { file, html } = await details(attract);

    expect(file?.ai).toBeUndefined();
    expect(html).not.toContain("KI-Erfassung");
    expect(html).not.toContain("Erneut versuchen");
    const openRouter = ai();
    const journalBefore = await journalOf(db, { aggregateId: attract });
    const sentAnyway = await retry({ fileId: attract, version }, tom, undefined, openRouter);
    await run(openRouter);
    expect(sentAnyway).toMatchObject({ state: { error: "file-indexing-ai-off" }, starts: 0 });
    expect(openRouter.ai.requests.filter((request) => request.startsWith("embed:"))).toEqual([]);
    expect(await journalOf(db, { aggregateId: attract })).toEqual(journalBefore);
  });

  it("ST-114: A helper sees the details but cannot try a failed file again", async () => {
    await turnAiOn();
    const attract = await attach(await aMachine("LG-042"), "Attract mode.mp4", "video");
    await run();

    const { html } = await details(attract, { person: ben });

    expect(html).toContain("Für die KI nicht lesbar");
    expect(html).not.toContain("Erneut versuchen");
    const openRouter = ai();
    const journalBefore = await journalOf(db, { aggregateId: attract });
    const sentAnyway = await retry({ fileId: attract, version: 0 }, ben, undefined, openRouter);
    await run(openRouter);
    expect(sentAnyway).toMatchObject({ state: { error: "not-authorized" }, starts: 0 });
    expect(await journalOf(db, { aggregateId: attract })).toEqual(journalBefore);
  });

  it("ST-114: A removed file has no details page, and nobody outside the team reaches one", async () => {
    const machineId = await aMachine("LG-042");
    const wrong = await attach(machineId, "MM Manual (wrong edition)");
    const manual = await attach(machineId, "MM Operations Manual");
    const removed = await executeCommand(
      removeFileCommand,
      { fileId: wrong, version: 0 },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!removed.ok) throw new Error(removed.error);

    // The page answers not found for what this returns nothing for – a removed file, an unknown one and a forged address.
    expect((await details(wrong)).file).toBeUndefined();
    expect((await details(randomUUID())).file).toBeUndefined();
    expect((await details("../../etc/passwd")).file).toBeUndefined();
    expect((await details(manual)).file).toBeDefined();
    // Someone not logged in is sent to the login before any of this is read: the page's first step is
    // `requireTeamMember()`, which the browser test (`e2e/file-details.spec.ts`) shows with a real request.
  });

  it("ST-114: A failed file on the form „KI“ leads to its details", async () => {
    await turnAiOn();
    const machineId = await aMachine("LG-042");
    const attract = await attach(machineId, "Attract mode.mp4", "video");
    await run();

    const settings = await settingsPage();
    const address = hrefOf(settings, "Attract mode.mp4");
    const page = await details(attract, { params: queryOf(address) });

    expect(address).toBe(`/team/dateien/${attract}/details?from=settings`);
    expect(settings).toContain("LG-042 · <a");
    expect(page.html).toContain("LG-042 · Medieval Madness");
    expect(page.html).toContain("Für die KI nicht lesbar: Dateiformat wird nicht erfasst");
  });

  it("ST-114: The way back leads to where the person came from", async () => {
    await turnAiOn();
    const attract = await attach(await aMachine("LG-042"), "Attract mode.mp4", "video");
    await run();
    const places = [
      [await machineRecord("LG-042", tom), "Zurück zum Gerät", "/team/machines/LG-042"],
      [await settingsPage(), "Zurück zu den Einstellungen", "/team/museum-settings"],
    ] as const;

    for (const [where, wayBack, leadsTo] of places) {
      const page = await details(attract, {
        params: queryOf(hrefOf(where, where.includes("Details") ? "Details" : "Attract mode.mp4")),
      });

      expect(hrefOf(page.html, wayBack)).toBe(leadsTo);
    }
    // A helper does not reach „Einstellungen“: their way back from an address naming it is the default (G11).
    const helper = await details(attract, { params: { from: "settings" }, person: ben });
    expect(hrefOf(helper.html, "Zurück zu den Geräten")).toBe("/team/machines");
  });

  it("ST-114: Without a known origin the way back leads to the machines", async () => {
    await aMachine("LG-042");
    const manual = await attach(await aMachine("LG-043"), "MM Operations Manual");
    const origins: Record<string, string>[] = [
      {},
      { from: "https://evil.example/phish" },
      { from: "//evil.example" },
      { from: "machine:XX-999" },
      { from: "machine:https://evil.example" },
    ];

    for (const params of origins) {
      const { html } = await details(manual, { params });

      expect(hrefOf(html, "Zurück zu den Geräten")).toBe("/team/machines");
      // No link leads anywhere the address named.
      const named = Object.values(params).join(" ");
      expect(hrefs(html).filter((href) => named.includes(href) && href !== "/team/machines")).toEqual([]);
      expect(html).not.toContain("evil.example");
      expect(html).not.toContain("XX-999");
    }
  });
});

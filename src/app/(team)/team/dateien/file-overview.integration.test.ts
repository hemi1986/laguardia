import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  addFileCommand,
  correctMachineModelCommand,
  createMachineModelCommand,
  registerMachineCommand,
  removeFileCommand,
  type FileCategory,
} from "@/modules/collection";
import { fileIndexingWork, removeFileCommandWithAiIndex, type AiDependencies } from "@/modules/ai-assistance";
import { aiIndexOf, anIndexedFile } from "@/modules/ai-assistance/ai-index.test-support";
import { aiScenario } from "@/modules/ai-assistance/ai-scenario.test-support";
import { geminiEmbedding } from "@/modules/ai-assistance/ai-seam.test-support";
import { steppingClock } from "@/modules/ai-assistance/ai-work-stand-in.test-support";
import { executeCommand } from "@/platform/command";
import { hrefOf, queryOf, selectedOf, textOf } from "@/test-support/html";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadFileDetails } from "./[fileId]/details/file-details-data";
import { FileDetailsView } from "./[fileId]/details/file-details-view";
import { removalLanding } from "./[fileId]/details/file-origin";
import { loadRemoveFile } from "./[fileId]/details/entfernen/remove-file-data";
import { FileOverviewView } from "./file-overview";
import { loadFileOverview } from "./file-overview-data";

/**
 * ST-117: the file overview „Dateien“ – Collection's files, AI assistance's index state and Team's viewer composed by the
 * page data function and rendered by its view. Files are added through the commands; the AI index state through the
 * background work or CMD-IndexFileForAi. In a database of its own: "every file" is the whole set.
 */
const isolated = isolatedTestDatabase("file_overview_page");
let db: NodePgDatabase;
const clock = steppingClock("2026-11-02T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const ben = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
type Viewer = typeof tom | typeof ben;
const viewerOf = (person: Viewer) => ({ id: person.teamMemberId, role: person.role });
let medievalMadness: string;
let machineId: string;

afterAll(() => isolated.close());

const scenario = aiScenario({ db: () => db, clock, technician: tom });
const { ai, turnAiOn, removeTheKey } = scenario;
/** AI dependencies whose OpenRouter records its requests. */
const scenarioAi = () => ai();
const run = (dependencies: AiDependencies = ai()) => scenario.run({ kinds: [fileIndexingWork], with: dependencies });

beforeEach(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, ben, "Ben");
  clock.set("2026-11-02T10:00:00Z");
  const created = await executeCommand(
    createMachineModelCommand,
    { title: "Medieval Madness", manufacturer: "Williams", year: "1997", machineCategory: "pinball" },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  medievalMadness = created.result.machineModelId;
  const registered = await executeCommand(
    registerMachineCommand,
    {
      machineModelId: medievalMadness,
      museumNumber: "LG-042",
      serialNumber: undefined,
      location: "Hall 1",
      machineStatus: "playable",
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!registered.ok) throw new Error(registered.error);
  machineId = registered.result.machineId;
});

/** A file added through CMD-AddFile at the clock's time – attached to nothing unless said. */
async function aFile(
  title: string,
  {
    fileCategory = "manual",
    size = 4_200_000,
    contentType = "application/pdf",
    machines = [],
    machineModels = [],
    originalFileName = undefined,
  }: {
    fileCategory?: FileCategory;
    size?: number;
    contentType?: string;
    machines?: string[];
    machineModels?: string[];
    originalFileName?: string;
  } = {},
): Promise<string> {
  const added = await executeCommand(
    addFileCommand,
    {
      title,
      fileCategory,
      originalFileName,
      machineIds: machines,
      machineModelIds: machineModels,
      content: { name: `files/${randomUUID()}`, size, contentType },
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!added.ok) throw new Error(added.error);
  return added.result.fileId;
}

/** `count` files, one per minute, so the order is the order of their titles. */
async function manyFiles(prefix: string, count: number, fileCategory: FileCategory): Promise<string[]> {
  const ids: string[] = [];
  for (let n = 1; n <= count; n++) {
    clock.set(`2026-10-15T10:${String(n).padStart(2, "0")}:00Z`);
    ids.push(await aFile(`${prefix} ${String(n).padStart(2, "0")}`, { fileCategory }));
  }
  return ids;
}

/** „Dateien“ as a team member opens it – `params` are the address's query. */
async function overview(
  params: Record<string, string> = {},
  { person = ben, dependencies = ai() }: { person?: Viewer; dependencies?: AiDependencies } = {},
) {
  const data = await loadFileOverview(db, { params, viewer: viewerOf(person), ai: dependencies });
  const html = renderToStaticMarkup(createElement(FileOverviewView, { overview: data }));
  return { data, html, text: textOf(html) };
}

/** The text of the entries – after the filters, whose options name machines and states of their own. */
const entriesText = (text: string) => text.slice(text.indexOf("Filtern") + "Filtern".length);

/** The titles of the entries, in the order the page lists them. */
const listed = (html: string) =>
  [...html.matchAll(/<li[^>]*><a [^>]*href="\/team\/dateien\/[^"]+\/details[^"]*"[^>]*>([^<]*)<\/a>/g)].map(
    (match) => match[1],
  );

describe("the file overview (ST-117)", () => {
  it("ST-117: A helper finds every file in the overview", async () => {
    await turnAiOn();
    clock.set("2026-11-01T10:00:00Z");
    const old = await aFile("Old manual");
    await aFile("Wiring notes", { fileCategory: "schematic" });
    clock.set("2026-11-02T10:00:00Z");
    const manual = await aFile("MM Operations Manual", {
      size: Math.round(12.4 * 1024 * 1024),
      machines: [machineId],
    });
    await anIndexedFile(db, clock, manual, { embeddingModel: geminiEmbedding.id, pages: 3 });
    const removed = await executeCommand(
      removeFileCommand,
      { fileId: old, version: 0 },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!removed.ok) throw new Error(removed.error);

    const { html, text } = await overview({}, { person: ben });

    expect(text).toContain("2 Dateien");
    expect(listed(html)).toEqual(["MM Operations Manual", "Wiring notes"]);
    expect(text).toContain("Handbuch · PDF · 12,4 MB · Für die KI erfasst");
    // What a file is attached to is on its details, not here (G18); the entry's title is its one action.
    expect(entriesText(text)).not.toContain("LG-042");
    expect(entriesText(text)).not.toContain("Medieval Madness");
    expect(hrefOf(html, "MM Operations Manual")).toBe(`/team/dateien/${manual}/details?from=files`);
    expect(text).not.toContain("Old manual");
    expect(text).not.toMatch(/Seite \d+ von/);
  });

  it("ST-117: A long list is paged and keeps its filters", async () => {
    await manyFiles("Manual", 30, "manual");
    await manyFiles("Photo", 30, "photo");

    const second = await overview({ fileCategory: "manual", page: "2" });

    expect(second.text).toContain("30 Dateien · Seite 2 von 2");
    // The 5 oldest manuals, newest of them first.
    expect(listed(second.html)).toEqual(["Manual 05", "Manual 04", "Manual 03", "Manual 02", "Manual 01"]);
    expect(second.text).toContain("Zurück");
    expect(second.text).not.toContain("Weiter");
    const back = hrefOf(second.html, "Zurück");
    expect(back).toBe("/team/dateien?fileCategory=manual");
    const first = await overview(queryOf(back));
    expect(first.text).toContain("30 Dateien · Seite 1 von 2");
    expect(listed(first.html)).toHaveLength(25);
    expect(listed(first.html)[0]).toBe("Manual 30");
    expect(first.text).not.toContain("Zurück");
    expect(hrefOf(first.html, "Weiter")).toBe("/team/dateien?fileCategory=manual&page=2");
    // A page past the end shows the last page.
    expect((await overview({ fileCategory: "manual", page: "9" })).text).toContain("30 Dateien · Seite 2 von 2");
    expect(listed((await overview({ fileCategory: "manual", page: "9" })).html)).toHaveLength(5);
    // A page that is no number is the first.
    expect((await overview({ fileCategory: "manual", page: "abc" })).text).toContain("Seite 1 von 2");
  });

  it("ST-117: The file details lead back to the overview as it was", async () => {
    const manuals = await manyFiles("Manual", 27, "manual");
    const params = { fileCategory: "manual", page: "2" };

    const page = await overview(params, { person: tom });
    const entry = listed(page.html)[0];
    const address = hrefOf(page.html, entry);
    const fileId = address.match(/dateien\/([^/]+)\/details/)![1];
    expect(manuals).toContain(fileId);

    const detailsOf = async (query: Record<string, string>) => {
      const file = (await loadFileDetails(db, fileId, { params: query, viewer: viewerOf(tom), ai: ai() }))!;
      const html = renderToStaticMarkup(
        createElement(FileDetailsView, { file, retry: async () => null, detach: async () => null }),
      );
      return { file, html };
    };
    const known = await detailsOf(queryOf(address));
    expect(hrefOf(known.html, "Zurück zu den Dateien")).toBe("/team/dateien?fileCategory=manual&page=2");

    // Removing the file lands there, with its confirmation.
    const question = (await loadRemoveFile(db, fileId, { params: queryOf(address), viewer: viewerOf(tom) }))!;
    const removed = await executeCommand(
      removeFileCommandWithAiIndex,
      { fileId, version: question.version },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!removed.ok) throw new Error(removed.error);
    const landing = removalLanding(question.origin, fileId);
    expect(landing).toBe(`/team/dateien?fileCategory=manual&page=2&fileRemoved=${fileId}`);
    const landed = await overview(queryOf(landing), { person: tom });
    expect(landed.text).toContain(`„${entry}“ entfernt.`);
    expect(landed.text).toContain("26 Dateien · Seite 2 von 2");

    // Without a known origin – a foreign web address or a foreign filter value included – the way back is the first page.
    const other = manuals.find((id) => id !== fileId)!;
    const foreign = [
      {},
      { from: "https://evil.example/phish" },
      { from: "//evil.example" },
      { from: "files:fileCategory=evil" },
      { from: "files:fileCategory=manual&page=2&next=https%3A%2F%2Fevil.example" },
      { from: "files:attachedTo=machine:https://evil.example" },
      { from: "files:fileCategory=manual&fileCategory=photo" },
      { from: "machine:XX-999" },
      { from: "machine:https://evil.example" },
    ];
    for (const query of foreign) {
      const file = (await loadFileDetails(db, other, { params: query, viewer: viewerOf(tom), ai: ai() }))!;
      const html = renderToStaticMarkup(
        createElement(FileDetailsView, { file, retry: async () => null, detach: async () => null }),
      );
      expect(hrefOf(html, "Zurück zu den Dateien")).toBe("/team/dateien");
      expect(html).not.toContain("evil.example");
      expect(html).not.toContain("XX-999");
      const asked = (await loadRemoveFile(db, other, { params: query, viewer: viewerOf(tom) }))!;
      expect(removalLanding(asked.origin, other)).toBe(`/team/dateien?fileRemoved=${other}`);
    }
  });

  it("ST-117: Filtering by file category", async () => {
    await aFile("MM Operations Manual", { fileCategory: "manual" });
    await aFile("MM Wiring", { fileCategory: "schematic" });
    await aFile("MM Backglass", { fileCategory: "photo" });

    const schematic = await overview({ fileCategory: "schematic" });

    expect(listed(schematic.html)).toEqual(["MM Wiring"]);
    expect(schematic.text).toContain("1 Datei");
    expect(selectedOf(schematic.html, "fileCategory")).toBe("schematic");
  });

  it("ST-117: Filtering by how far the AI index got", async () => {
    await turnAiOn();
    await scenario.attachFile(machineId, {
      title: "A",
      bytes: new TextEncoder().encode("The flipper coil and its fuse."),
      contentType: "text/plain",
    });
    await scenario.attachFile(machineId, {
      title: "C",
      bytes: new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]),
      contentType: "video/mp4",
    });
    await run();
    await scenario.attachFile(machineId, {
      title: "B",
      bytes: new TextEncoder().encode("Waiting for its turn."),
      contentType: "text/plain",
    });

    const all = await overview();
    expect(entriesText(all.text)).toContain("Für die KI erfasst");
    expect(entriesText(all.text)).toContain("Wartet auf KI-Erfassung");
    expect(entriesText(all.text)).toContain("Für die KI nicht lesbar");

    const failed = await overview({ aiIndex: "failed" });

    expect(listed(failed.html)).toEqual(["C"]);
    expect(failed.text).toContain("1 Datei");
    expect(failed.text).toContain("Für die KI nicht lesbar");
    expect(entriesText(failed.text)).not.toContain("Für die KI erfasst");
    expect(selectedOf(failed.html, "aiIndex")).toBe("failed");
    expect(listed((await overview({ aiIndex: "waiting" })).html)).toEqual(["B"]);
    expect(listed((await overview({ aiIndex: "indexed" })).html)).toEqual(["A"]);
  });

  it("ST-117: While AI is off neither the state nor its filter is shown", async () => {
    await turnAiOn();
    await scenario.attachFile(machineId, {
      title: "A",
      bytes: new TextEncoder().encode("The flipper coil and its fuse."),
      contentType: "text/plain",
    });
    await scenario.attachFile(machineId, {
      title: "C",
      bytes: new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]),
      contentType: "video/mp4",
    });
    await run();
    await removeTheKey();

    const off = await overview({ aiIndex: "failed" });

    expect(listed(off.html).sort()).toEqual(["A", "C"]);
    expect(entriesText(off.text)).not.toContain("KI");
    expect(off.html).not.toContain('name="aiIndex"');
    expect(off.data.query.aiIndex).toBeUndefined();

    await turnAiOn();
    const on = await overview({ aiIndex: "failed" });
    expect(listed(on.html)).toEqual(["C"]);
    expect(on.html).toContain('name="aiIndex"');
    expect(entriesText((await overview()).text)).toContain("Für die KI erfasst");
  });

  it("ST-117: No match says so and keeps the filters", async () => {
    await aFile("MM Operations Manual");
    await aFile("MM Rulesheet");

    const none = await overview({ fileCategory: "photo" });

    expect(none.text).toContain("Keine Datei passt zu diesen Filtern.");
    expect(hrefOf(none.html, "Alle Dateien anzeigen")).toBe("/team/dateien");
    expect(selectedOf(none.html, "fileCategory")).toBe("photo");
    expect(none.text).not.toContain("Noch keine Dateien");
    expect(listed(none.html)).toEqual([]);
  });

  it("offers the machines and machine models to narrow to, and keeps what was chosen", async () => {
    await aFile("Own notes", { machines: [machineId] });

    const page = await overview({ attachedTo: `machine:${machineId}` });

    expect(page.html).toContain("LG-042 · Medieval Madness");
    expect(page.html).toContain('<optgroup label="Geräte">');
    expect(page.html).toContain('<optgroup label="Modelle">');
    expect(page.html).toContain("Nirgends angehängt");
    expect(page.html).toContain("Alle Dateikategorien");
    expect(selectedOf(page.html, "attachedTo")).toBe(`machine:${machineId}`);
    expect(listed(page.html)).toEqual(["Own notes"]);
    // An unknown machine in the address narrows to nothing: it is left out, like any value that is not ours.
    const unknown = await overview({ attachedTo: `machine:${randomUUID()}` });
    expect(listed(unknown.html)).toEqual(["Own notes"]);
    expect(unknown.data.query.attachedTo).toBeUndefined();
  });
});

/**
 * ST-118: searching the file overview. Collection's files with how well their own text matches each word, AI assistance's
 * files with the word in a passage, merged by the page. Passages come from `anIndexedFile` – the way the background work
 * stores them – or from a real indexing run; the search reads their words and nothing else, so no request goes to OpenRouter.
 */
describe("searching the file overview (ST-118)", () => {
  const embedding = geminiEmbedding.id;
  let eightBallMachineId: string;
  let eightBall: string;

  beforeEach(async () => {
    const created = await executeCommand(
      createMachineModelCommand,
      { title: "Eight Ball", manufacturer: "Bally", year: "1977", machineCategory: "pinball" },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!created.ok) throw new Error(created.error);
    eightBall = created.result.machineModelId;
    const registered = await executeCommand(
      registerMachineCommand,
      {
        machineModelId: eightBall,
        museumNumber: "LG-050",
        serialNumber: undefined,
        location: "Hall 2",
        machineStatus: "playable",
      },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!registered.ok) throw new Error(registered.error);
    eightBallMachineId = registered.result.machineId;
  });

  /** An indexed file whose one passage holds `text`. */
  const indexed = (fileId: string, text: string, embeddingModel = embedding) =>
    anIndexedFile(db, clock, fileId, { embeddingModel, pages: 12, page: 12, text });

  it("ST-118: A file is found by its own data and by what it is attached to", async () => {
    await aFile("MM Operations Manual", { machines: [machineId], originalFileName: "medieval_manual-v2.pdf" });
    await aFile("Eight Ball Notes", { machines: [eightBallMachineId] });

    for (const words of ["Operations", "medieval_manual", "LG-042", "Medieval Madness"]) {
      expect(listed((await overview({ search: words })).html), words).toEqual(["MM Operations Manual"]);
    }
  });

  it("ST-118: A file is found by the content of its indexed passages", async () => {
    const ai = scenarioAi();
    const backbox = await aFile("Backbox schematic", { fileCategory: "schematic" });
    await aFile("Unrelated notes");
    await indexed(backbox, "Auf Seite 12 sitzen die Spulen der Flipper.");
    const before = await aiIndexOf(db, [backbox]);

    const found = await overview({ search: "Spule" }, { dependencies: ai });

    expect(listed(found.html)).toEqual(["Backbox schematic"]);
    expect(await aiIndexOf(db, [backbox])).toEqual(before);
    expect(ai.ai.requests).toEqual([]);
  });

  it("ST-118: Every word must be found, not all in the same place", async () => {
    const service = await aFile("Service guide", { machineModels: [medievalMadness] });
    const other = await aFile("Other guide", { machineModels: [eightBall] });
    await indexed(service, "Die Spulen sind vorne.");
    await indexed(other, "Die Spulen sind hinten.");

    const found = await overview({ search: "Medieval Spule" });

    expect(listed(found.html)).toEqual(["Service guide"]);
  });

  it("ST-118: A word in a file's own data comes before the same word in the content only", async () => {
    clock.set("2026-10-01T10:00:00Z");
    const chart = await aFile("Coil chart");
    clock.set("2026-11-01T10:00:00Z");
    const guide = await aFile("Service guide");
    await indexed(guide, "The coils are on page 340.");

    const found = await overview({ search: "coil" });

    expect(listed(found.html)).toEqual(["Coil chart", "Service guide"]);
    expect(chart).not.toBe(guide);
  });

  it("ST-118: The page says that only the content of indexed files is searched", async () => {
    await turnAiOn();
    await scenario.attachFile(machineId, {
      title: "A",
      bytes: new TextEncoder().encode("Das Relais klemmt."),
      contentType: "text/plain",
    });
    await scenario.attachFile(machineId, {
      title: "C",
      bytes: new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]),
      contentType: "video/mp4",
    });
    await run();
    await scenario.attachFile(machineId, {
      title: "B",
      bytes: new TextEncoder().encode("Das Relais ist neu."),
      contentType: "text/plain",
    });

    const found = await overview({ search: "Relais" });

    expect(listed(found.html)).toEqual(["A"]);
    expect(found.text).toContain("nur bei Dateien, die für die KI erfasst sind");
    expect(found.text).toContain("Sucht im Titel, im ursprünglichen Dateinamen");
  });

  it("ST-118: A scanned PDF is not found by its content", async () => {
    const scanned = await aFile("Scanned schematic", { fileCategory: "schematic" });
    // Its pages are images without a text layer: the only passage is another page's text.
    await indexed(scanned, "Seite 1 hat eine Textebene.");

    expect(listed((await overview({ search: "Netzteil" })).html)).toEqual([]);
    expect(listed((await overview({ search: "Scanned" })).html)).toEqual(["Scanned schematic"]);
  });

  it("ST-118: Content stays searchable while AI is off", async () => {
    await turnAiOn();
    const backbox = await aFile("Backbox schematic");
    await indexed(backbox, "Die Spulen im Backbox.");
    await removeTheKey();
    const off = scenarioAi();

    const found = await overview({ search: "Spule" }, { dependencies: off });

    expect(listed(found.html)).toEqual(["Backbox schematic"]);
    expect(found.text).not.toContain("Für die KI erfasst");
    expect(off.ai.requests).toEqual([]);

    // AI on, the file indexed again with another embedding model: its passages are still the ones searched.
    await turnAiOn();
    const again = await aFile("Rulesheet");
    await indexed(again, "Die Spulen im Regelwerk.", "another/embedding-model");
    const on = scenarioAi();
    expect(listed((await overview({ search: "Spule" }, { dependencies: on })).html).sort()).toEqual([
      "Backbox schematic",
      "Rulesheet",
    ]);
    expect(on.ai.requests).toEqual([]);
  });

  it("ST-118: Search, filters and pages work together", async () => {
    const files: string[] = [];
    for (let n = 1; n <= 30; n++) {
      clock.set(`2026-10-01T10:${String(n).padStart(2, "0")}:00Z`);
      files.push(await aFile(`Manual ${String(n).padStart(2, "0")}`));
    }
    for (let n = 1; n <= 5; n++) {
      clock.set(`2026-10-02T10:${String(n).padStart(2, "0")}:00Z`);
      files.push(await aFile(`Plan ${n}`, { fileCategory: "schematic" }));
    }
    for (let n = 1; n <= 10; n++) {
      clock.set(`2026-10-03T10:${String(n).padStart(2, "0")}:00Z`);
      await aFile(`Other manual ${n}`);
    }
    for (const id of files) await indexed(id, "Das Relais ist das Herz.");

    const first = await overview({ search: "Relais", fileCategory: "manual" });
    expect(first.text).toContain("30 Dateien · Seite 1 von 2");
    const next = hrefOf(first.html, "Weiter");
    expect(next).toBe("/team/dateien?search=Relais&fileCategory=manual&page=2");

    const second = await overview(queryOf(next));

    expect(second.text).toContain("30 Dateien · Seite 2 von 2");
    expect(listed(second.html)).toHaveLength(5);
    expect(hrefOf(second.html, "Zurück")).toBe("/team/dateien?search=Relais&fileCategory=manual");
    // Each form keeps the other's values and starts at page 1.
    expect(selectedOf(second.html, "fileCategory")).toBe("manual");
    expect(second.html).toMatch(/<input[^>]*name="search"[^>]*value="Relais"/);
    expect(second.html).toMatch(/<input[^>]*type="hidden"[^>]*name="fileCategory"[^>]*value="manual"/);
    expect(second.html).not.toContain('name="page"');
    expect(second.data.query).toEqual({ search: "Relais", fileCategory: "manual", page: 2 });
  });

  it("ST-118: A corrected name is found at once and a removed file no longer", async () => {
    await aFile("Own notes", { machines: [machineId] });
    const old = await aFile("Old manual");
    await indexed(old, "Die Spulen.");
    expect(listed((await overview({ search: "Spule" })).html)).toEqual(["Old manual"]);

    const corrected = await executeCommand(
      correctMachineModelCommand,
      {
        machineModelId: medievalMadness,
        version: 0,
        title: "Medieval Madness Remake",
        manufacturer: "Williams",
        year: "1997",
        machineCategory: "pinball",
      },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!corrected.ok) throw new Error(corrected.error);
    const question = (await loadRemoveFile(db, old, { params: {}, viewer: viewerOf(tom) }))!;
    const removed = await executeCommand(
      removeFileCommandWithAiIndex,
      { fileId: old, version: question.version },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!removed.ok) throw new Error(removed.error);

    expect(listed((await overview({ search: "Remake" })).html)).toEqual(["Own notes"]);
    expect(listed((await overview({ search: "Spule" })).html)).toEqual([]);
  });

  it("ST-118: Nothing found says so and keeps the words", async () => {
    await aFile("MM Operations Manual");

    const none = await overview({ search: "Zylinderkopf" });

    expect(none.text).toContain("Keine Datei passt zu dieser Suche.");
    expect(hrefOf(none.html, "Alle Dateien anzeigen")).toBe("/team/dateien");
    expect(none.html).toMatch(/<input[^>]*name="search"[^>]*value="Zylinderkopf"/);
    expect(none.text).not.toContain("Noch keine Dateien");
  });

  it("an empty search, or one of punctuation only, is no search", async () => {
    await aFile("MM Operations Manual");
    await aFile("MM Rulesheet");

    for (const search of ["", "   ", "-- ..", "„“"]) {
      const all = await overview({ search });
      expect(listed(all.html), search).toHaveLength(2);
      expect(all.data.query.search).toBeUndefined();
    }
  });
});

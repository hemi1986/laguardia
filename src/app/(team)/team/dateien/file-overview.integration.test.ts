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
  type FileCategory,
} from "@/modules/collection";
import { fileIndexingWork, removeFileCommandWithAiIndex, type AiDependencies } from "@/modules/ai-assistance";
import { anIndexedFile } from "@/modules/ai-assistance/ai-index.test-support";
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
  }: { fileCategory?: FileCategory; size?: number; contentType?: string; machines?: string[] } = {},
): Promise<string> {
  const added = await executeCommand(
    addFileCommand,
    {
      title,
      fileCategory,
      originalFileName: undefined,
      machineIds: machines,
      machineModelIds: [],
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
    expect(text).not.toContain("Seite");
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
    expect(off.text).not.toContain("KI");
    expect(off.html).not.toContain('name="aiIndex"');
    expect(off.data.query.aiIndex).toBeUndefined();

    await turnAiOn();
    const on = await overview({ aiIndex: "failed" });
    expect(listed(on.html)).toEqual(["C"]);
    expect(on.html).toContain('name="aiIndex"');
    expect(entriesText((await overview()).text)).toContain("Für die KI erfasst");
  });

  it("ST-117: No file yet says what to do", async () => {
    const empty = await overview();
    expect(empty.text).toContain(
      "Noch keine Dateien. Eine Datei kommt über „Datei anhängen“ auf der Seite eines Geräts dazu.",
    );
    expect(hrefOf(empty.html, "Geräte")).toBe("/team/machines");
    expect(listed(empty.html)).toEqual([]);
    expect(empty.text).not.toContain("Zurück");
    expect(empty.text).not.toContain("Weiter");

    // Only removed ones count as none.
    const gone = await aFile("Old manual");
    const removed = await executeCommand(
      removeFileCommand,
      { fileId: gone, version: 0 },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!removed.ok) throw new Error(removed.error);
    expect((await overview()).text).toContain("Noch keine Dateien.");
    // Also through an address that holds filters – the museum has no file at all.
    expect((await overview({ fileCategory: "photo" })).text).toContain("Noch keine Dateien.");
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

import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  acceptAiModelProposalCommand,
  aiModelProposalPage,
  aiModelProposalWork,
  proposedDocumentWork,
  proposedDocumentPieceId,
} from "@/modules/ai-assistance";
import { fileDetails } from "@/modules/collection";
import { memoryWeb, type MemoryWeb } from "@/platform/web-fetch";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { memoryStorage } from "@/platform/storage";
import { aiScenario } from "@/modules/ai-assistance/ai-scenario.test-support";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { SavedAiModelProposal } from "./saved-proposal";

/**
 * ST-129: the chosen links of a saved proposal are loaded as files (CMD-LoadProposedDocument, ADR 0019). The background
 * work is driven directly (`runAiWork` through the scenario) with the web as a stand-in – nothing reaches the internet –,
 * and the proposal's page is read from the same database afterwards.
 */
const isolated = isolatedTestDatabase("ai_proposed_documents");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const clock = fixedClock("2026-11-07T12:00:00Z");
const texts = teamMessages.aiModelProposals;
const storage = memoryStorage();
const scenario = aiScenario({ db: () => db, storage: () => storage, clock, technician: tom });

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
});

afterAll(() => isolated.close());

beforeEach(async () => {
  for (const table of [
    "ai_work_hold",
    "ai_model_proposal",
    "ai_index_item",
    "ai_index_entry",
    "file_attachment",
    "file",
  ])
    await db.execute(`DELETE FROM ${table}`);
  for (const name of storage.names()) await storage.delete(name);
  await scenario.turnAiOn();
});

const MB = 1024 * 1024;
const pdf = (size: number) => {
  const bytes = new Uint8Array(size);
  bytes.set(new TextEncoder().encode("%PDF-1.7\n"));
  return bytes;
};
const link = (address: string, title: string, fileCategory = "manual") => ({ link: address, title, fileCategory });

/** A proposal the AI wrote with these links, saved by the technician with these ticked (all by default) – its ID. */
async function aSavedProposal(links: ReturnType<typeof link>[], ticked?: number[]) {
  const openRouter = scenario.openRouter({
    chatAnswer: {
      content: JSON.stringify({
        title: "High Speed",
        manufacturer: "Williams",
        year: "1986",
        machineCategory: "pinball",
        technology: "solid-state",
        sources: [],
        documents: links,
      }),
      cost: 0.04,
    },
  });
  const id = await scenario.requestAiModelProposal("Flipper High Speed Williams");
  await scenario.run({ kinds: [aiModelProposalWork], with: openRouter });
  const proposal = (await aiModelProposalPage(db, id))!;
  const saved = await executeCommand(
    acceptAiModelProposalCommand,
    {
      aiModelProposalId: id,
      version: proposal.version!,
      machineModel: {
        title: "High Speed",
        manufacturer: "Williams",
        year: "1986",
        machineCategory: "pinball",
        technology: "solid-state",
      },
      chosen: (ticked ?? links.map((_, index) => index)).map((index) => ({ index })),
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!saved.ok) throw new Error(saved.error);
  return { id, machineModelId: saved.result.machineModelId };
}

/** One run of the background work that loads what waits. */
function load(web: MemoryWeb) {
  return scenario.run({ kinds: [proposedDocumentWork(web)] });
}

const savedPage = async (id: string) =>
  renderToStaticMarkup(createElement(SavedAiModelProposal, { proposal: (await aiModelProposalPage(db, id))! }));

describe("loading the chosen links of a saved proposal", () => {
  it("ST-129: A link becomes a file of the machine model", async () => {
    const { id, machineModelId } = await aSavedProposal([
      link("https://example.org/high-speed-manual.pdf", "High Speed Manual"),
    ]);
    // Saved, the link waits.
    expect(await savedPage(id)).toContain(texts.loading);
    const web = memoryWeb({
      "https://example.org/high-speed-manual.pdf": { contentType: "application/pdf", bytes: pdf(3 * MB) },
    });

    await load(web);

    // The file exists with the title and file category the technician saw, attached to the machine model …
    const page = await aiModelProposalPage(db, id);
    const [document] = page!.documents!;
    expect(document).toMatchObject({ kind: "link", loading: "loaded" });
    const fileId = (document as { fileId: string }).fileId;
    const file = await fileDetails(db, fileId);
    expect(file).toMatchObject({ title: "High Speed Manual", fileCategory: "manual" });
    expect(file?.attachedTo).toEqual([expect.objectContaining({ kind: "machine-model", machineModelId })]);
    // … its content is in the store, as the web gave it …
    expect(storage.names()).toHaveLength(1);
    expect(storage.read(storage.names()[0])).toMatchObject({ contentType: "application/pdf" });
    expect(storage.read(storage.names()[0])?.bytes).toHaveLength(3 * MB);
    expect(file?.size).toBe(3 * MB);
    expect(file?.originalFileName).toBe("high-speed-manual.pdf");
    // … and the proposal's page shows the link as loaded, with the file to open.
    const html = await savedPage(id);
    expect(html).toContain(texts.loaded);
    expect(html).not.toContain(texts.loading);
    expect(html).toContain(`/team/dateien/${fileId}`);
    // The journal: the file was added by the technician who asked, the link loaded by the system – references only.
    const added = (await journalOf(db, { aggregateId: fileId })).map((entry) => [entry.type, entry.actor]);
    expect(added).toEqual([
      ["EVT-FileAdded", tom],
      ["EVT-FileAttached", tom],
    ]);
    const loaded = (await journalOf(db, { aggregateId: id })).find(
      (entry) => entry.type === "EVT-ProposedDocumentLoaded",
    );
    expect(loaded?.actor).toEqual({ kind: "system" });
    expect(loaded?.data).toEqual({ documentIndex: 0, fileId });
  });

  it("ST-129: A link that cannot be reached fails alone", async () => {
    const { id, machineModelId } = await aSavedProposal([
      link("https://example.org/gone.pdf", "Gone manual"),
      link("https://example.org/schematic.pdf", "High Speed schematic", "schematic"),
    ]);
    const web = memoryWeb({
      "https://example.org/gone.pdf": "unreachable",
      "https://example.org/schematic.pdf": { contentType: "application/pdf", bytes: pdf(1000) },
    });

    await load(web);

    const page = await aiModelProposalPage(db, id);
    expect(page?.documents).toEqual([
      expect.objectContaining({ title: "Gone manual", loading: "failed", reason: "not-reachable" }),
      expect.objectContaining({ title: "High Speed schematic", loading: "loaded" }),
    ]);
    // The other one became a file and the machine model stays.
    const fileId = (page!.documents![1] as { fileId: string }).fileId;
    expect(await fileDetails(db, fileId)).toMatchObject({ title: "High Speed schematic", fileCategory: "schematic" });
    expect(page?.state).toBe("accepted");
    expect(page?.machineModel).toEqual({ id: machineModelId, title: "High Speed" });
    const html = await savedPage(id);
    expect(html).toContain(texts.documentFailures["not-reachable"]);
    expect(texts.documentFailures["not-reachable"]).toBe("nicht erreichbar");
  });

  it("ST-129: An address that is not allowed", async () => {
    const { id } = await aSavedProposal([link("https://192.168.0.5/manual.pdf", "Manual in the museum's network")]);
    // The write keeps https links only; a link of an older shape with http is refused the same way.
    await db.execute("UPDATE ai_model_proposal SET documents = replace(documents::text, 'https://', 'http://')::jsonb");
    const web = memoryWeb({
      "http://192.168.0.5/manual.pdf": { contentType: "application/pdf", bytes: pdf(1000) },
      "https://192.168.0.5/manual.pdf": { contentType: "application/pdf", bytes: pdf(1000) },
    });

    await load(web);

    const page = await aiModelProposalPage(db, id);
    expect(page?.documents?.[0]).toMatchObject({ loading: "failed", reason: "address-not-allowed" });
    expect(web.served()).toEqual([]);
    expect(storage.names()).toEqual([]);
    expect(await savedPage(id)).toContain("Adresse nicht erlaubt");
  });

  it("ST-129: Content that is too large or not a PDF or text", async () => {
    const { id } = await aSavedProposal([
      link("https://example.org/huge.pdf", "Huge manual"),
      link("https://example.org/archive.zip", "Archive"),
    ]);
    const web = memoryWeb({
      "https://example.org/huge.pdf": { contentType: "application/pdf", bytes: pdf(1000), size: 150 * MB },
      "https://example.org/archive.zip": { contentType: "application/zip", bytes: new Uint8Array([0x50, 0x4b, 3, 4]) },
    });

    await load(web);

    const page = await aiModelProposalPage(db, id);
    expect(page?.documents).toEqual([
      expect.objectContaining({ loading: "failed", reason: "too-large" }),
      expect.objectContaining({ loading: "failed", reason: "not-pdf-or-text" }),
    ]);
    expect(storage.names()).toEqual([]);
    const html = await savedPage(id);
    expect(html).toContain("zu groß");
    expect(html).toContain("kein PDF oder Text");
  });

  it("a web page is stored as the text of the page, a text or Markdown document as it is", async () => {
    const { id } = await aSavedProposal(
      [
        link("https://example.org/wiki/high-speed", "High Speed on the wiki", "other"),
        link("https://example.org/notes.md", "Notes", "other"),
        link("https://example.org/download", "A PDF served as a stream"),
      ],
      [0, 1, 2],
    );
    const html =
      "<html><head><title>High Speed</title><style>p { color: red }</style><script>alert(1)</script></head>" +
      "<body><h1>High Speed</h1><p>Williams, 1986 &amp; more</p></body></html>";
    const web = memoryWeb({
      "https://example.org/wiki/high-speed": {
        contentType: "text/html; charset=utf-8",
        bytes: new TextEncoder().encode(html),
      },
      "https://example.org/notes.md": { contentType: "text/markdown", bytes: new TextEncoder().encode("# Notes") },
      "https://example.org/download": { contentType: "application/octet-stream", bytes: pdf(500) },
    });

    await load(web);

    const documents = (await aiModelProposalPage(db, id))!.documents as { fileId: string }[];
    const stored = await Promise.all(
      documents.map(async ({ fileId }) => {
        const file = await fileDetails(db, fileId);
        const name = storage.names().find((candidate) => file && storage.read(candidate)?.bytes.length === file.size);
        return { mediaType: file?.mediaType, content: name && new TextDecoder().decode(storage.read(name)!.bytes) };
      }),
    );
    expect(stored[0].mediaType).toBe("text");
    expect(stored[0].content).toContain("High Speed");
    expect(stored[0].content).toContain("Williams, 1986 & more");
    // Nothing of the page's code is kept.
    expect(stored[0].content).not.toContain("alert");
    expect(stored[0].content).not.toContain("<");
    expect(stored[1]).toEqual({ mediaType: "markdown", content: "# Notes" });
    expect(stored[2].mediaType).toBe("pdf");
  });

  it("works while AI is off", async () => {
    const { id } = await aSavedProposal([link("https://example.org/a.pdf", "A manual")]);
    await scenario.removeTheKey();

    await load(memoryWeb({ "https://example.org/a.pdf": { contentType: "application/pdf", bytes: pdf(100) } }));

    expect((await aiModelProposalPage(db, id))?.documents?.[0]).toMatchObject({ loading: "loaded" });
  });

  it("a link broken off is failed as „abgebrochen“ and a late result records nothing", async () => {
    const { id } = await aSavedProposal([link("https://example.org/a.pdf", "A manual")]);
    const web = memoryWeb({ "https://example.org/a.pdf": { contentType: "application/pdf", bytes: pdf(100) } });
    const kind = proposedDocumentWork(web);

    // The next run fails what broke off (POL-UnfinishedAiWorkFails).
    await db.transaction((tx) =>
      kind.recordBrokenOff(
        tx,
        proposedDocumentPieceId(id, 0),
        { db, clock, ai: { encryptionKey: () => Buffer.alloc(32) }, storage },
        0,
      ),
    );
    expect((await aiModelProposalPage(db, id))?.documents?.[0]).toMatchObject({
      loading: "failed",
      reason: "broken-off",
    });
    expect(await savedPage(id)).toContain("abgebrochen");

    // A late result: nothing waits any more, so nothing is fetched or stored.
    await load(web);
    expect(web.served()).toEqual([]);
    expect(storage.names()).toEqual([]);
    expect((await aiModelProposalPage(db, id))?.documents?.[0]).toMatchObject({
      loading: "failed",
      reason: "broken-off",
    });
  });
});

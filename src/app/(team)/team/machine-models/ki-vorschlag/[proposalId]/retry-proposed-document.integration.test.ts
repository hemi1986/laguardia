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
  retryProposedDocumentCommand,
} from "@/modules/ai-assistance";
import { makesAiWork } from "@/modules/ai-assistance/ai-work-events";
import { fileDetails } from "@/modules/collection";
import { memoryWeb, type MemoryWeb } from "@/platform/web-fetch";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type CommittedEvent } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { memoryStorage } from "@/platform/storage";
import { aiScenario } from "@/modules/ai-assistance/ai-scenario.test-support";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { SavedAiModelProposal } from "./saved-proposal";

/**
 * ST-130: a failed link of a saved proposal is retried (CMD-RetryProposedDocument, ADR 0019) and loaded as in ST-129. The background
 * work is driven directly (`runAiWork` through the scenario) with the web as a stand-in – nothing reaches the internet –,
 * and the proposal's page is read from the same database afterwards.
 */
const isolated = isolatedTestDatabase("ai_retry_proposed_document");
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

function load(web: MemoryWeb) {
  return scenario.run({ kinds: [proposedDocumentWork(web)] });
}

/** What the retries committed – what the Server Action runner is told to start the AI work. */
const committed: CommittedEvent[] = [];

/** The retry as the technician sends it: at the version the proposal's page shows. */
const retry = async (aiModelProposalId: string, index = 0) => {
  const { version } = (await aiModelProposalPage(db, aiModelProposalId))!;
  return executeCommand(
    retryProposedDocumentCommand,
    { aiModelProposalId, index, version: version! },
    { actor: tom, db, clock, newId: randomUUID, afterCommit: (events) => committed.push(...events) },
  );
};

const savedPage = async (id: string) =>
  renderToStaticMarkup(createElement(SavedAiModelProposal, { proposal: (await aiModelProposalPage(db, id))! }));

const fileCount = async () =>
  ((await db.execute("SELECT count(*)::int AS n FROM file")) as { rows: { n: number }[] }).rows[0].n;

describe("retrying a failed link of a saved proposal", () => {
  it("ST-130: A failed link is retried and loaded", async () => {
    const { id, machineModelId } = await aSavedProposal([
      link("https://example.org/high-speed-manual.pdf", "High Speed Manual"),
    ]);
    await load(memoryWeb({ "https://example.org/high-speed-manual.pdf": "unreachable" }));
    expect((await aiModelProposalPage(db, id))?.documents?.[0]).toMatchObject({
      loading: "failed",
      reason: "not-reachable",
    });
    expect(await fileCount()).toBe(0);
    // „Nochmal versuchen“ is offered beside the failed link.
    expect(await savedPage(id)).toContain(texts.tryAgain);

    committed.length = 0;
    const retried = await retry(id);

    // The link is waiting again, and the retry makes AI work (the runner starts it after the response).
    expect(retried.ok).toBe(true);
    expect(makesAiWork(committed)).toBe(true);
    const waiting = (await aiModelProposalPage(db, id))!.documents![0];
    expect(waiting).toMatchObject({ loading: "waiting" });
    expect(waiting).not.toHaveProperty("reason");
    expect(await savedPage(id)).not.toContain(texts.tryAgain);

    // The site answers now.
    await load(
      memoryWeb({
        "https://example.org/high-speed-manual.pdf": { contentType: "application/pdf", bytes: pdf(2 * MB) },
      }),
    );

    const [document] = (await aiModelProposalPage(db, id))!.documents!;
    expect(document).toMatchObject({ kind: "link", loading: "loaded" });
    const file = await fileDetails(db, (document as { fileId: string }).fileId);
    expect(file).toMatchObject({ title: "High Speed Manual", fileCategory: "manual", size: 2 * MB });
    expect(file?.attachedTo).toEqual([expect.objectContaining({ kind: "machine-model", machineModelId })]);
    // The journal: the technician retried, the system loaded; no title or address in it.
    const entries = await journalOf(db, { aggregateId: id });
    const retriedEntry = entries.find((entry) => entry.type === "EVT-ProposedDocumentLoadingRetried");
    expect(retriedEntry?.actor).toEqual(tom);
    expect(retriedEntry?.data).toEqual({ documentIndex: 0 });
  });

  it("ST-130: A link that is not failed cannot be retried", async () => {
    const { id } = await aSavedProposal([link("https://example.org/high-speed-manual.pdf", "High Speed Manual")]);
    await load(
      memoryWeb({
        "https://example.org/high-speed-manual.pdf": { contentType: "application/pdf", bytes: pdf(1000) },
      }),
    );
    expect(await fileCount()).toBe(1);
    // For a loaded link „Nochmal versuchen“ is not offered (G11).
    expect(await savedPage(id)).not.toContain(texts.tryAgain);

    const retried = await retry(id);

    expect(retried).toMatchObject({ ok: false, error: "ai-model-proposal-document-not-failed" });
    expect(teamMessages.commandErrors["ai-model-proposal-document-not-failed"]).toBe(
      "Dieses Dokument ist nicht fehlgeschlagen – es wird nicht erneut geladen.",
    );
    expect(await fileCount()).toBe(1);
    expect((await aiModelProposalPage(db, id))!.documents![0]).toMatchObject({ loading: "loaded" });
  });

  it("a waiting link or a place that names no link cannot be retried", async () => {
    const { id } = await aSavedProposal([link("https://example.org/a.pdf", "A")]);
    expect(await retry(id)).toMatchObject({ ok: false, error: "ai-model-proposal-document-not-failed" });
    expect(await retry(id, 5)).toMatchObject({ ok: false, error: "ai-model-proposal-document-not-failed" });
    expect(await retry(id, -1)).toMatchObject({ ok: false, error: "ai-model-proposal-document-not-failed" });
  });

  it("a proposal that is not saved has no link to retry", async () => {
    const openRouter = scenario.openRouter({
      chatAnswer: {
        content: JSON.stringify({
          title: "High Speed",
          manufacturer: "Williams",
          sources: [],
          documents: [link("https://example.org/a.pdf", "A")],
        }),
        cost: 0.04,
      },
    });
    const id = await scenario.requestAiModelProposal("Flipper High Speed Williams");
    await scenario.run({ kinds: [aiModelProposalWork], with: openRouter });
    expect(await retry(id)).toMatchObject({ ok: false, error: "ai-model-proposal-document-not-failed" });
  });

  it("the link tapped is the link retried, also when an earlier document was not ticked", async () => {
    const { id } = await aSavedProposal(
      [
        link("https://example.org/x.pdf", "X"),
        link("https://example.org/a.pdf", "A"),
        link("https://example.org/b.pdf", "B"),
      ],
      [1, 2],
    );
    await load(memoryWeb({}));
    const page = await aiModelProposalPage(db, id);
    // The page names the places as written: A is 1, B is 2 (X was left unticked).
    expect(page!.documents!.map((document) => [document.kind === "link" && document.title, document.index])).toEqual([
      ["A", 1],
      ["B", 2],
    ]);

    expect((await retry(id, 2)).ok).toBe(true);

    const after = (await aiModelProposalPage(db, id))!.documents!;
    expect(after.map((document) => document.kind === "link" && document.loading)).toEqual(["failed", "waiting"]);
    expect(await savedPage(id)).toContain('name="index" value="1"');
  });

  it("a link that failed for a reason that cannot change fails with the same reason again", async () => {
    const { id } = await aSavedProposal([link("https://example.org/archive.zip", "Archive")]);
    const web = memoryWeb({
      "https://example.org/archive.zip": { contentType: "application/zip", bytes: new Uint8Array([0x50, 0x4b, 3, 4]) },
    });
    await load(web);
    expect((await retry(id)).ok).toBe(true);
    await load(web);
    expect((await aiModelProposalPage(db, id))!.documents![0]).toMatchObject({
      loading: "failed",
      reason: "not-pdf-or-text",
    });
  });
});

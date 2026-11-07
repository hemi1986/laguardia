import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { aiModelProposalPage, aiModelProposalWork, removeFileCommandWithAiIndex } from "@/modules/ai-assistance";
import { anIndexedFile } from "@/modules/ai-assistance/ai-index.test-support";
import { aiScenario } from "@/modules/ai-assistance/ai-scenario.test-support";
import { geminiEmbedding } from "@/modules/ai-assistance/ai-seam.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { WrittenAiModelProposal } from "./written-proposal";

/**
 * ST-125: after the fields are completed, the AI index is searched with them among all files, and the files it finds
 * are offered on the proposal's page above the links from the web (CMD-WriteAiModelProposal, ADR 0018). One run of the
 * real kind against the in-memory OpenRouter; the page is the proposal's view.
 */
const isolated = isolatedTestDatabase("ai_model_proposal_existing_files");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const NOW = "2026-11-07T12:00:00Z";
const clock = fixedClock(NOW);
const texts = teamMessages.aiModelProposals;
const scenario = aiScenario({ db: () => db, clock, technician: tom });

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
  await scenario.turnAiOn();
});

const highSpeed = {
  title: "High Speed",
  manufacturer: "Williams",
  year: 1986,
  machineCategory: "pinball",
  technology: "solid-state",
  sources: [],
  documents: [
    { title: "High Speed – Manual", fileCategory: "manual", link: "https://www.ipdb.org/files/1203/manual.pdf" },
  ],
};

/** A file the museum has, with an AI index entry of the current embedding model. */
async function anIndexedFileOfTheMuseum(title: string, to: "machine-model" | "nothing", fileCategory = "manual") {
  const machineId = await aRegisteredMachine(db);
  const fileId = await scenario.attachFile(machineId, {
    title,
    bytes: new Uint8Array([1, 2, 3]),
    contentType: "application/pdf",
    to,
    fileCategory: fileCategory as "manual",
  });
  await anIndexedFile(db, clock, fileId, { embeddingModel: geminiEmbedding.id, pages: 1, text: title });
  return fileId;
}

/** Requests a proposal for the description and runs the background work once – the proposal's page, rendered. */
async function theWrittenProposal(answer: unknown) {
  const openRouter = scenario.openRouter({ chatAnswer: { content: JSON.stringify(answer), cost: 0.04 } });
  const id = await scenario.requestAiModelProposal("Flipper High Speed Williams");
  await scenario.run({ kinds: [aiModelProposalWork], with: openRouter });
  const proposal = await aiModelProposalPage(db, id);
  if (!proposal) throw new Error("no page");
  return {
    id,
    proposal,
    html: renderToStaticMarkup(createElement(WrittenAiModelProposal, { proposal })),
    openRouter,
  };
}

describe("existing files in an AI model proposal", () => {
  it("ST-125: A file the museum already has is offered", async () => {
    const wiki = await anIndexedFileOfTheMuseum("Pinball wiki – System 11", "machine-model", "other");

    const { id, html, openRouter } = await theWrittenProposal(highSpeed);

    // The journal says which embedding model searched and that the embedding was paid with the chat model's answer.
    const written = (await journalOf(db, { aggregateId: id })).find((e) => e.type === "EVT-AiModelProposalWritten");
    expect(written?.data).toMatchObject({ embeddingModel: geminiEmbedding.id });
    expect(written?.data.cost).toBeCloseTo(0.04 + 0.0001, 6);
    // The index was searched with the completed fields.
    expect(openRouter.embedInputs[0]).toMatchObject({ kind: "text" });
    expect(openRouter.embedInputs[0]).toHaveProperty("text", expect.stringContaining("High Speed"));
    // The group stands above the links from the web; the file is ticked, with its category and a link to its details.
    const existing = html.indexOf(texts.alreadyInTheMuseum);
    expect(existing).toBeGreaterThan(-1);
    expect(existing).toBeLessThan(html.indexOf(texts.loadFromTheWeb));
    const group = html.slice(existing, html.indexOf(texts.loadFromTheWeb));
    expect(group).toContain("Pinball wiki – System 11");
    expect(group).toContain(texts.fileCategories.other);
    expect(group).toMatch(/<input[^>]*name="document"[^>]*checked[^>]*value="0"/);
    expect(group).toContain(`href="/team/dateien/${wiki}/details"`);
  });

  it("ST-125: A file attached to nothing is found too", async () => {
    await anIndexedFileOfTheMuseum("High Speed Operations Manual", "nothing");

    const { proposal, html } = await theWrittenProposal(highSpeed);

    expect(proposal.documents?.[0]).toMatchObject({ kind: "file", title: "High Speed Operations Manual" });
    // The existing file counts first, then the link the AI found on the web.
    expect(proposal.documents?.map((document) => document.kind)).toEqual(["file", "link"]);
    expect(html).toContain(texts.alreadyInTheMuseum);
    expect(html).toContain("High Speed Operations Manual");
  });

  it("ST-125: Nothing found in the museum", async () => {
    // A file without an AI index entry cannot be found.
    const machineId = await aRegisteredMachine(db);
    await scenario.attachFile(machineId, {
      title: "Not indexed",
      bytes: new Uint8Array([1]),
      contentType: "application/pdf",
    });

    const { proposal, html } = await theWrittenProposal(highSpeed);

    expect(proposal.documents?.map((document) => document.kind)).toEqual(["link"]);
    expect(html).not.toContain(texts.alreadyInTheMuseum);
    expect(html).toContain(texts.loadFromTheWeb);
  });

  it("offers only files that are not removed and indexed with the current embedding model are found", async () => {
    const removed = await anIndexedFileOfTheMuseum("Removed manual", "nothing");
    const removing = await executeCommand(
      removeFileCommandWithAiIndex,
      { fileId: removed, version: 0 },
      { actor: tom, db, clock },
    );
    if (!removing.ok) throw new Error(removing.error);
    const machineId = await aRegisteredMachine(db);
    const older = await scenario.attachFile(machineId, {
      title: "Indexed with an older model",
      bytes: new Uint8Array([1]),
      contentType: "application/pdf",
    });
    await anIndexedFile(db, clock, older, { embeddingModel: "some/older-embedding-model", pages: 1 });

    const { proposal } = await theWrittenProposal(highSpeed);

    expect(proposal.documents?.map((document) => document.kind)).toEqual(["link"]);
  });
});

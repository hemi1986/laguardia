import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { aiModelProposalPage, aiModelProposalWork } from "@/modules/ai-assistance";
import { aiScenario } from "@/modules/ai-assistance/ai-scenario.test-support";
import { fixedClock } from "@/platform/clock";
import { journalOf } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { field, optionOf, selectedOf, textOf } from "@/test-support/html";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { WrittenAiModelProposal } from "./written-proposal";

/**
 * ST-124: the AI model proposal is written by the background work (POL-RequestedAiModelProposalIsWritten, ADR 0015,
 * ADR 0020) – one run of the real kind against the in-memory OpenRouter, whose chat model answers like the one in the
 * spike – and the proposal's page shows what was written. Nothing is loaded from the web: the links are only proposals.
 */
const isolated = isolatedTestDatabase("ai_model_proposal_write");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const NOW = "2026-11-07T12:00:00Z";
const texts = teamMessages.aiModelProposals;
const scenario = aiScenario({ db: () => db, clock: fixedClock(NOW), technician: tom });

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
});

afterAll(() => isolated.close());

beforeEach(async () => {
  await db.execute("DELETE FROM ai_model_proposal");
  await scenario.turnAiOn();
});

const highSpeed = {
  title: "High Speed",
  manufacturer: "Williams",
  year: 1986,
  machineCategory: "pinball",
  technology: "solid-state",
  sources: ["https://www.ipdb.org/machine.cgi?id=1203"],
  documents: [
    { title: "High Speed – Manual", fileCategory: "manual", link: "https://www.ipdb.org/files/1203/manual.pdf" },
  ],
};

/** The chat model's answer, as a JSON object like the spike's runs; `cost` is what OpenRouter reports. */
const answering = (answer: unknown, cost = 0.0412) =>
  scenario.openRouter({ chatAnswer: { content: JSON.stringify(answer), cost }, embeddingCost: 0 });

/** Requests a proposal and runs the background work once – returns the proposal's page, rendered. */
async function theWrittenProposal(description: string, openRouter: ReturnType<typeof answering>) {
  const id = await scenario.requestAiModelProposal(description);
  await scenario.run({ kinds: [aiModelProposalWork], with: openRouter });
  const proposal = await aiModelProposalPage(db, id);
  if (!proposal) throw new Error("no page");
  return { id, proposal, html: renderToStaticMarkup(createElement(WrittenAiModelProposal, { proposal })) };
}

describe("writing an AI model proposal", () => {
  it("ST-124: Fields and documents from the web are proposed", async () => {
    const openRouter = answering(highSpeed);

    const { id, proposal, html } = await theWrittenProposal("Flipper High Speed Williams", openRouter);

    // The AI was asked with the web tools, for the description and the chat model of the request.
    expect(openRouter.chatRequests).toHaveLength(1);
    expect(openRouter.chatRequests[0]).toMatchObject({ model: "google/gemini-2.5-flash", webTools: true });
    expect(openRouter.chatRequests[0].text).toContain("Flipper High Speed Williams");
    // The proposal page shows the fields filled in …
    expect(proposal.state).toBe("written");
    expect(field(html, "title")).toContain('value="High Speed"');
    expect(field(html, "manufacturer")).toContain('value="Williams"');
    expect(field(html, "year")).toContain('value="1986"');
    expect(selectedOf(html, "machineCategory")).toBe("pinball");
    expect(selectedOf(html, "technology")).toBe("solid-state");
    expect(textOf(html)).not.toContain(texts.notFound);
    // … and the sources …
    expect(textOf(html)).toContain(texts.sources);
    expect(html).toContain('href="https://www.ipdb.org/machine.cgi?id=1203"');
    // … and the manual under „Aus dem Netz laden“, file category Handbuch, ticked.
    expect(textOf(html)).toContain(texts.loadFromTheWeb);
    expect(field(html, "documentTitle-0")).toContain('value="High Speed – Manual"');
    expect(selectedOf(html, "documentFileCategory-0")).toBe("manual");
    expect(texts.fileCategories.manual).toBe("Handbuch");
    expect(html).toMatch(
      /<input[^>]*name="document"[^>]*checked=""[^>]*>|<input[^>]*checked=""[^>]*name="document"[^>]*>/,
    );
    expect(html).toContain('href="https://www.ipdb.org/files/1203/manual.pdf"');
    expect(textOf(html)).not.toContain(texts.noDocuments);
    // The journal says that it was written and what it cost – not what it says.
    const [, entry] = await journalOf(db, { aggregateId: id });
    expect(entry).toMatchObject({
      type: "EVT-AiModelProposalWritten",
      data: { chatModel: "google/gemini-2.5-flash", cost: 0.0412 },
    });
    expect(JSON.stringify(entry.data)).not.toContain("Williams");
  });

  it("ST-124: A value that is not valid is left empty", async () => {
    const { proposal, html } = await theWrittenProposal(
      "Flipper High Speed Williams",
      answering({ ...highSpeed, year: "ca. 1986", technology: "crt" }),
    );

    // Neither repaired nor guessed: the year and the technology are empty and say so …
    expect(proposal.fields).toEqual({ title: "High Speed", manufacturer: "Williams", machineCategory: "pinball" });
    expect(field(html, "year")).toContain('value=""');
    expect(optionOf(html, "technology", "")).toContain('selected=""');
    expect(textOf(html).split(texts.notFound)).toHaveLength(3);
    // … the other fields are filled in.
    expect(field(html, "title")).toContain('value="High Speed"');
    expect(field(html, "manufacturer")).toContain('value="Williams"');
    expect(selectedOf(html, "machineCategory")).toBe("pinball");
  });

  it("ST-124: No documents found", async () => {
    const { html } = await theWrittenProposal(
      "Flipper High Speed Williams",
      answering({ ...highSpeed, documents: [] }),
    );

    expect(textOf(html)).toContain("Keine Dokumente gefunden.");
    expect(texts.noDocuments).toBe("Keine Dokumente gefunden.");
    expect(html).not.toContain('name="document"');
    expect(field(html, "title")).toContain('value="High Speed"');
    expect(field(html, "manufacturer")).toContain('value="Williams"');
  });

  it("ST-124: At most ten documents", async () => {
    const twelve = Array.from({ length: 12 }, (_, index) => ({
      title: `Dokument ${index + 1}`,
      fileCategory: "other",
      link: `https://example.org/documents/${index + 1}.pdf`,
    }));

    const { proposal, html } = await theWrittenProposal(
      "Flipper High Speed Williams",
      answering({ ...highSpeed, documents: twelve }),
    );

    expect(proposal.documents).toHaveLength(10);
    expect(html.match(/name="document"/g)).toHaveLength(10);
    // The first ten, in the order the AI named them.
    expect(proposal.documents?.map(({ title }) => title)).toEqual(twelve.slice(0, 10).map(({ title }) => title));
  });
});

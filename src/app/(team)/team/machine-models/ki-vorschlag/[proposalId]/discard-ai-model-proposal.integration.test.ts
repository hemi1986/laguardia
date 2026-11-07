import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  acceptAiModelProposalCommand,
  aiModelProposalDiscardedIn,
  aiModelProposalPage,
  aiModelProposalWork,
  discardAiModelProposalCommand,
  openAiModelProposals,
  type AiModelProposalPage,
} from "@/modules/ai-assistance";
import { aiScenario } from "@/modules/ai-assistance/ai-scenario.test-support";
import { machineModelsToChooseFrom } from "@/modules/collection";
import { fixedClock } from "@/platform/clock";
import { journalOf, lastCommandBy } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { formRunner } from "@/app/_actions/form-runner";
import { acceptAiModelProposalForm } from "./accept-ai-model-proposal-definition";
import { discardAiModelProposalForm } from "./discard-ai-model-proposal-definition";
import { FailedAiModelProposal } from "./failed-proposal";
import { SavedAiModelProposal } from "./saved-proposal";
import { WrittenAiModelProposal } from "./written-proposal";

/**
 * ST-127: „Verwerfen“ on a written or failed proposal's page – CMD-DiscardAiModelProposal through the Server Action
 * runner as the acting technician, the proposal's page and the section „KI-Vorschläge“ read from the same database.
 */
const isolated = isolatedTestDatabase("ai_model_proposal_discard");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const clock = fixedClock("2026-11-07T12:00:00Z");
const texts = teamMessages.aiModelProposals;
const scenario = aiScenario({ db: () => db, clock, technician: tom });

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
});

afterAll(() => isolated.close());

beforeEach(async () => {
  for (const table of ["ai_work_hold", "ai_model_proposal"]) await db.execute(`DELETE FROM ${table}`);
  await db.execute(
    "DELETE FROM machine_model_category_change WHERE machine_model_id NOT IN (SELECT machine_model_id FROM machine)",
  );
  await db.execute("DELETE FROM machine_model WHERE id NOT IN (SELECT machine_model_id FROM machine)");
  await scenario.turnAiOn();
});

const highSpeed = {
  title: "High Speed",
  manufacturer: "Williams",
  year: "1986",
  machineCategory: "pinball",
  technology: "solid-state",
  sources: [],
  documents: [],
};

async function aWrittenProposal() {
  const openRouter = scenario.openRouter({ chatAnswer: { content: JSON.stringify(highSpeed), cost: 0.04 } });
  const id = await scenario.requestAiModelProposal("Flipper High Speed Williams");
  await scenario.run({ kinds: [aiModelProposalWork], with: openRouter });
  return id;
}

async function aFailedProposal() {
  const id = await scenario.requestAiModelProposal("asdf");
  await scenario.run({
    kinds: [aiModelProposalWork],
    with: scenario.openRouter({ chatAnswer: { content: "not json at all", cost: 0.01 } }),
  });
  return id;
}

const pageOf = async (id: string): Promise<AiModelProposalPage> => {
  const page = await aiModelProposalPage(db, id);
  if (!page) throw new Error("no page");
  return page;
};

/** The form as the page shows it: which proposal at which version. */
async function posted(id: string): Promise<FormData> {
  const form = new FormData();
  form.append("aiModelProposalId", id);
  form.append("version", String((await pageOf(id)).version ?? -1));
  return form;
}

const discarding = (onLanded: () => void = () => undefined) =>
  formRunner({ currentPerson: async () => tom, db, clock, newId: randomUUID })(
    discardAiModelProposalCommand,
    discardAiModelProposalForm({ onSuccess: async () => onLanded() }),
  );

const listed = async (id: string) =>
  (await openAiModelProposals(db, scenario.ai())).proposals.some((proposal) => proposal.id === id);

describe("discarding an AI model proposal (ST-127)", () => {
  it("ST-127: A written AI model proposal is discarded", async () => {
    const id = await aWrittenProposal();
    // The written page offers „Verwerfen“, and the proposal is listed.
    expect(renderToStaticMarkup(createElement(WrittenAiModelProposal, { proposal: await pageOf(id) }))).toContain(
      texts.discard,
    );
    expect(await listed(id)).toBe(true);
    let landed = false;

    const state = await discarding(() => (landed = true))(null, await posted(id));

    expect(state).toBeNull();
    expect(landed).toBe(true);
    // It is no longer listed under „KI-Vorschläge“ and no machine model was created.
    expect(await listed(id)).toBe(false);
    expect((await pageOf(id)).state).toBe("discarded");
    expect((await machineModelsToChooseFrom(db)).filter((model) => model.title === "High Speed")).toEqual([]);
    // The journal names who discarded it – nothing else; the confirmation after the redirect comes from it (G3).
    const entry = (await journalOf(db, { aggregateId: id })).at(-1);
    expect(entry).toMatchObject({ type: "EVT-AiModelProposalDiscarded", data: {}, actor: tom });
    expect(aiModelProposalDiscardedIn((await lastCommandBy(db, { aggregateId: id }, tom.teamMemberId))!, id)).toBe(
      true,
    );
  });

  it("a proposal still being written is not discarded", async () => {
    const id = await scenario.requestAiModelProposal("Flipper High Speed Williams");
    const form = new FormData();
    form.append("aiModelProposalId", id);
    form.append("version", "0");

    expect((await discarding()(null, form))?.error).toBe("ai-model-proposal-not-discardable");
    expect((await pageOf(id)).state).toBe("requested");
  });

  it("ST-127: A failed AI model proposal is discarded", async () => {
    const id = await aFailedProposal();
    expect(renderToStaticMarkup(createElement(FailedAiModelProposal, { proposal: await pageOf(id) }))).toContain(
      texts.discard,
    );
    expect(await listed(id)).toBe(true);

    expect(await discarding()(null, await posted(id))).toBeNull();

    expect(await listed(id)).toBe(false);
    // A second discarding of the same proposal is refused: it is final.
    const again = await discarding()(null, await posted(id));
    expect(again?.error).toBe("ai-model-proposal-not-discardable");
    expect(teamMessages.commandErrors["ai-model-proposal-not-discardable"]).toBe(
      "Dieser KI-Vorschlag lässt sich nicht verwerfen.",
    );
  });

  it("ST-127: An AI model proposal that was saved meanwhile cannot be discarded", async () => {
    const id = await aWrittenProposal();
    // „Verwerfen“ was opened before the other technician saved the proposal a moment ago.
    const stale = await posted(id);
    const save = new FormData();
    save.append("aiModelProposalId", id);
    save.append("version", String((await pageOf(id)).version));
    for (const [name, value] of [
      ["title", "High Speed"],
      ["manufacturer", "Williams"],
      ["year", "1986"],
      ["machineCategory", "pinball"],
      ["technology", "solid-state"],
    ])
      save.append(name, value);
    const saved = await formRunner({ currentPerson: async () => tom, db, clock, newId: randomUUID })(
      acceptAiModelProposalCommand,
      acceptAiModelProposalForm({ onSuccess: async () => undefined }),
    )(null, save);
    expect(saved).toBeNull();

    const state = await discarding()(null, stale);

    expect(state?.error).toBe("ai-model-proposal-already-accepted");
    expect(teamMessages.commandErrors["ai-model-proposal-already-accepted"]).toBe(
      "Dieser KI-Vorschlag wurde schon gespeichert.",
    );
    // The page shows the machine model that was created, and the proposal is not discarded.
    const page = await pageOf(id);
    expect(page.state).toBe("accepted");
    const html = renderToStaticMarkup(createElement(SavedAiModelProposal, { proposal: page }));
    expect(html).toContain(`href="/team/machine-models/${page.machineModel?.id}"`);
    expect(html).toContain("High Speed");
    const types = (await journalOf(db, { aggregateId: id })).map((entry) => entry.type);
    expect(types).not.toContain("EVT-AiModelProposalDiscarded");
  });
});

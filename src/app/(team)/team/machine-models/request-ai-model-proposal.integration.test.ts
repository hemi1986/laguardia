import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { aiModelProposalPage, openAiModelProposals } from "@/modules/ai-assistance";
import { aiScenario } from "@/modules/ai-assistance/ai-scenario.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { formRunner } from "@/app/_actions/form-runner";
import { requestAiModelProposalCommand } from "@/modules/ai-assistance";
import { AiModelProposalsSection } from "./ai-model-proposals-section";
import {
  aiModelProposalAddress,
  requestAiModelProposalForm,
} from "./mit-ki-erstellen/request-ai-model-proposal-definition";
import { teamMessages } from "@/platform/messages";

/**
 * ST-123: asking for an AI model proposal through its form and the Server Action runner (G8, G8a, G35, G37) – the
 * runner is tested here with the acting person `currentPerson()` would give. The machine models page's section and the
 * proposal's page are read from the same database afterwards, so "lands on the proposal's page" and "listed under
 * „KI-Vorschläge“" are checks of what the technician sees.
 */
const isolated = isolatedTestDatabase("ai_model_proposal_request");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const NOW = "2026-11-07T12:00:00Z";
const texts = teamMessages.aiModelProposals;

const scenario = aiScenario({ db: () => db, clock: fixedClock(NOW), technician: tom });
const ai = () => scenario.ai();

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
});

afterAll(() => isolated.close());

beforeEach(async () => {
  await db.execute("DELETE FROM ai_model_proposal");
  await scenario.turnAiOn();
});

function theForm(onLanded: (address: string) => void = () => undefined) {
  return formRunner({ currentPerson: async () => tom, db, clock: fixedClock(NOW), newId: randomUUID })(
    requestAiModelProposalCommand(ai()),
    requestAiModelProposalForm({
      onSuccess: async ({ aiModelProposalId }) => onLanded(aiModelProposalAddress(aiModelProposalId)),
    }),
  );
}

async function posted(description: string): Promise<FormData> {
  const form = new FormData();
  form.append("description", description);
  return form;
}

async function machineModelsSection() {
  return renderToStaticMarkup(createElement(AiModelProposalsSection, { data: await openAiModelProposals(db, ai()) }));
}

describe("asking for an AI model proposal", () => {
  it("ST-123: A technician requests an AI model proposal", async () => {
    let landed = "";

    const state = await theForm((address) => (landed = address))(null, await posted("  Flipper High Speed Williams "));

    expect(state).toBeNull();
    // The technician lands on the page of the new proposal …
    const [open] = (await openAiModelProposals(db, ai())).proposals;
    expect(landed).toBe(aiModelProposalAddress(open.id));
    // … which says it is being created and keeps itself up to date (a meta refresh needs no JavaScript, G35).
    expect(await aiModelProposalPage(db, open.id)).toEqual({
      id: open.id,
      description: "Flipper High Speed Williams",
      state: "requested",
    });
    // The machine models page lists it under „KI-Vorschläge“.
    const html = await machineModelsSection();
    expect(html).toContain(texts.section);
    expect(html).toContain("Flipper High Speed Williams");
    expect(html).toContain(texts.states.requested);
    expect(html).toContain(landed);
    // The journal names who asked and the model – the typed text stays out of it.
    const [entry] = await journalOf(db, { aggregateId: open.id });
    expect(entry).toMatchObject({
      type: "EVT-AiModelProposalRequested",
      data: { requestedBy: tom.teamMemberId },
    });
    expect(JSON.stringify(entry.data)).not.toContain("Williams");
  });

  it("ST-123: An empty description is rejected", async () => {
    const state = await theForm()(null, await posted("   "));

    expect(state?.error).toBe("ai-model-proposal-description-required");
    expect(teamMessages.commandErrors["ai-model-proposal-description-required"]).toBe("Bitte beschreibe das Gerät.");
    expect((await openAiModelProposals(db, ai())).proposals).toEqual([]);
  });

  it("ST-123: No second AI model proposal while one is being written", async () => {
    const first = await scenario.requestAiModelProposal("Flipper Medieval Madness Williams");
    // The offer stays: the request is rejected with the reason instead of hiding the button.
    expect(await machineModelsSection()).toContain(texts.create);

    // A form opened before, with a description typed: its post is rejected and the description stays (G8a).
    const state = await theForm()(null, await posted("Flipper High Speed Williams"));

    expect(state?.error).toBe("ai-model-proposal-being-written");
    expect(state?.values.description).toBe("Flipper High Speed Williams");
    // Still only the first one.
    expect((await openAiModelProposals(db, ai())).proposals.map(({ id }) => id)).toEqual([first]);
  });

  it("ST-123: Nobody requests while AI is off", async () => {
    await scenario.removeTheKey();

    // The button is not there – absent, not disabled (G37).
    const html = await machineModelsSection();
    expect(html).not.toContain(texts.create);
    expect(html).not.toContain("disabled");
    // A request sent anyway is rejected with the reason that AI is off.
    const asked = await executeCommand(
      requestAiModelProposalCommand(ai()),
      { description: "Flipper High Speed Williams" },
      { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
    );
    expect(asked).toEqual({ ok: false, error: "ai-model-proposal-ai-off" });
    expect(teamMessages.commandErrors["ai-model-proposal-ai-off"]).toBe("Die KI ist ausgeschaltet.");
    expect((await openAiModelProposals(db, ai())).proposals).toEqual([]);
  });
});

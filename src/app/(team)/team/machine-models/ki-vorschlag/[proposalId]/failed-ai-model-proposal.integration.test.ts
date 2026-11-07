import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  aiModelProposalLeftUnfinished,
  aiModelProposalPage,
  aiModelProposalWork,
  type AiModelProposalPage,
} from "@/modules/ai-assistance";
import { aiScenario } from "@/modules/ai-assistance/ai-scenario.test-support";
import { steppingClock } from "@/modules/ai-assistance/ai-work-stand-in.test-support";
import { journalOf } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { field } from "@/test-support/html";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { RequestAiModelProposalForm } from "../../mit-ki-erstellen/request-form";
import { descriptionToTryAgain } from "../../mit-ki-erstellen/description-to-try-again";
import { FailedAiModelProposal } from "./failed-proposal";

/**
 * ST-126: an AI model proposal that fails or breaks off says why and can be tried again. Every scenario drives one run
 * of the background work with the real AI model proposal kind against the in-memory OpenRouter and a database of its
 * own, then reads the proposal's page and the page „Mit KI erstellen“ from the same database (ADR 0015, the seam
 * catalog's run and page seams). No test waits for a real background run.
 */
const isolated = isolatedTestDatabase("ai_model_proposal_failure");
let db: NodePgDatabase;
const clock = steppingClock("2026-11-07T12:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const texts = teamMessages.aiModelProposals;
const scenario = aiScenario({ db: () => db, clock, technician: tom });

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
});

afterAll(() => isolated.close());

beforeEach(async () => {
  await db.execute("DELETE FROM ai_work_hold");
  await db.execute("DELETE FROM ai_model_proposal");
  clock.set("2026-11-07T12:00:00Z");
  await scenario.turnAiOn();
});

const answering = (answer: unknown, cost = 0.0412) =>
  scenario.openRouter({ chatAnswer: { content: JSON.stringify(answer), cost }, embeddingCost: 0 });

/** One run of the real AI model proposal kind – the background work as the worker route starts it. */
const run = (openRouter: ReturnType<typeof scenario.openRouter>) =>
  scenario.run({ kinds: [aiModelProposalWork], with: openRouter });

async function pageOf(id: string): Promise<AiModelProposalPage> {
  const proposal = await aiModelProposalPage(db, id);
  if (!proposal) throw new Error("no page");
  return proposal;
}

const failedHtml = (proposal: AiModelProposalPage) =>
  renderToStaticMarkup(createElement(FailedAiModelProposal, { proposal }));

describe("an AI model proposal that failed or broke off (ST-126)", () => {
  it("ST-126: A device that is not recognised", async () => {
    const id = await scenario.requestAiModelProposal("asdf");
    // The AI found no machine for the description: every field empty.
    const openRouter = answering({ title: null, manufacturer: null, year: null, sources: [], documents: [] });

    await run(openRouter);

    // Nothing was searched for in the AI index: no embedding was paid for.
    expect(openRouter.embeddingRequests).toBe(0);
    const proposal = await pageOf(id);
    expect(proposal).toMatchObject({ state: "failed", description: "asdf", failureReason: "device-not-recognised" });
    const html = failedHtml(proposal);
    expect(html).toContain("Das Gerät wurde nicht erkannt.");
    expect(texts.failureReasons["device-not-recognised"]).toBe("Das Gerät wurde nicht erkannt.");
    const [, entry] = await journalOf(db, { aggregateId: id });
    expect(entry).toMatchObject({ type: "EVT-AiModelProposalFailed", data: { reason: "device-not-recognised" } });
    expect(JSON.stringify(entry.data)).not.toContain("asdf");
  });

  it("ST-126: Try again keeps the description", async () => {
    const id = await scenario.requestAiModelProposal("Flipper High Speed Williams");
    await run(scenario.openRouter({ chatAnswer: { content: "not json at all", cost: 0.01 } }));
    const proposal = await pageOf(id);
    expect(proposal).toMatchObject({ state: "failed", failureReason: "answer-unusable" });
    const html = failedHtml(proposal);
    expect(html).toContain("Die Antwort der KI war nicht brauchbar.");

    // The technician taps „Nochmal versuchen“ – a link to the page „Mit KI erstellen“, not a command.
    const link = html.match(/<a[^>]*href="([^"]+)"[^>]*>\s*Nochmal versuchen\s*<\/a>/);
    expect(link?.[1]).toBeDefined();
    const address = new URL(link![1].replaceAll("&amp;", "&"), "https://museum.example");
    expect(address.pathname).toBe("/team/machine-models/mit-ki-erstellen");
    // The description is read on the server from the failed proposal – it is not in the address.
    expect(address.toString()).not.toContain("Williams");
    const query = Object.fromEntries(address.searchParams);
    const typedIn = await descriptionToTryAgain(db, query);

    const form = renderToStaticMarkup(
      createElement(RequestAiModelProposalForm, {
        action: async () => null,
        whyNot: undefined,
        initialDescription: typedIn,
      }),
    );
    expect(field(form, "description")).toContain('value="Flipper High Speed Williams"');
    // The failed proposal stays; nothing was requested or written again.
    expect(await pageOf(id)).toMatchObject({ state: "failed" });
    // A foreign or unknown address types nothing in: only a failed proposal's description is offered.
    expect(await descriptionToTryAgain(db, { retry: randomUUID() })).toBeUndefined();
    expect(await descriptionToTryAgain(db, {})).toBeUndefined();
    expect(await descriptionToTryAgain(db, { retry: "-".repeat(36) })).toBeUndefined();
    expect(await descriptionToTryAgain(db, { retry: ["a", "b"] })).toBeUndefined();
  });

  it("ST-126: A write that breaks off", async () => {
    const id = await scenario.requestAiModelProposal("Flipper High Speed Williams");
    // A run is cut off while it writes – it never ends (a crash, a deployment, the time limit).
    let writing!: () => void;
    const writingStarted = new Promise<void>((resolve) => (writing = resolve));
    let finish!: () => void;
    const finishes = new Promise<void>((resolve) => (finish = resolve));
    const lateAi = scenario.openRouter({
      chatAnswer: {
        content: JSON.stringify({ title: "High Speed", manufacturer: "Williams", sources: [], documents: [] }),
        cost: 0.05,
      },
      embeddingCost: 0,
      beforeChat: async () => {
        writing();
        await finishes;
      },
    });
    const lateRun = run(lateAi);
    await writingStarted;

    // A refresh of the page before the hold ran out starts no run; after it, the page's refresh does.
    expect(await aiModelProposalLeftUnfinished(db, clock, id)).toBe(false);
    clock.set("2026-11-07T12:08:21Z");
    expect(await aiModelProposalLeftUnfinished(db, clock, id)).toBe(true);

    // When the next run of the background work starts, it records the break-off – reading and sending nothing.
    const next = scenario.openRouter();
    await run(next);

    expect(next.requests).toEqual([]);
    const proposal = await pageOf(id);
    expect(proposal).toMatchObject({ state: "failed", failureReason: "broken-off" });
    expect(failedHtml(proposal)).toContain("Abgebrochen");
    expect(texts.failureReasons["broken-off"]).toBe("Abgebrochen");
    expect(await aiModelProposalLeftUnfinished(db, clock, id)).toBe(false);

    // The earlier run finishes afterwards – a late result records nothing.
    finish();
    await lateRun;
    const late = await pageOf(id);
    expect(late).toMatchObject({ state: "failed", failureReason: "broken-off" });
    expect(late.fields).toBeUndefined();
    const entries = await journalOf(db, { aggregateId: id });
    expect(entries.map((entry) => entry.type)).toEqual(["EVT-AiModelProposalRequested", "EVT-AiModelProposalFailed"]);

    // No later run writes it again.
    clock.set("2026-11-07T12:20:00Z");
    const later = scenario.openRouter();
    await run(later);
    expect(later.chatRequests).toEqual([]);
  });

  it("ST-126: AI is turned off while a proposal is written", async () => {
    const id = await scenario.requestAiModelProposal("Flipper High Speed Williams");
    // A technician removes the key before the writing has started.
    await scenario.removeTheKey();
    const off = scenario.openRouter();

    await run(off);

    // Nothing was sent to OpenRouter.
    expect(off.requests).toEqual([]);
    expect(off.chatRequests).toEqual([]);
    const proposal = await pageOf(id);
    expect(proposal).toMatchObject({ state: "failed", failureReason: "ai-off" });
    expect(failedHtml(proposal)).toContain("Die KI ist ausgeschaltet.");
    expect(texts.failureReasons["ai-off"]).toBe("Die KI ist ausgeschaltet.");
  });
});

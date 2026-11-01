import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { defectDetails, reportProblemAndTriageCommand, resolveDefectCommand } from "@/modules/repair";
import {
  AI_ASSESSMENT_KIND,
  aiAssessmentRetryRequest,
  aiAssessmentWork,
  aiAssessmentsOfDefect,
  aiWorkLeftUnfinished,
  removeFileCommandWithAiIndex,
  requestAiAssessmentCommand,
  type AiDependencies,
} from "@/modules/ai-assistance";
import { startWhenLeftUnfinished } from "@/app/ai-work-when-left-unfinished";
import { writeAiAssessmentForTest } from "@/modules/ai-assistance/ai-assessment.test-support";
import { aiScenario, type ScenarioOpenRouter } from "@/modules/ai-assistance/ai-scenario.test-support";
import { steppingClock } from "@/modules/ai-assistance/ai-work-stand-in.test-support";
import { aPdfOfText } from "@/modules/ai-assistance/file-indexing.test-support";
import { memoryAi, geminiEmbedding, geminiFlash } from "@/modules/ai-assistance/ai-seam.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { memoryStorage } from "@/platform/storage";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { anExistingTeamMember } from "@/test-support/team-members";
import { formRunner } from "@/app/_actions/form-runner";
import { DefectDetailsView } from "./defect-details";
import { loadDefectDetails } from "./defect-details-data";
import { aiAssessmentLanding } from "./ki-einschaetzung/request-ai-assessment-definition";
import { retryAiAssessmentForm } from "./ki-einschaetzung/retry-ai-assessment-definition";

/**
 * ST-108: an AI assessment that fails or breaks off says why and can be tried again. Every scenario drives one run of
 * the background work directly – `runAiWork` with the real AI assessment kind, the injected clock, budget, in-memory AI
 * and storage – against a database of its own, then renders the defect page from the same database (ADR 0015, the
 * seam catalog's page and run seams). No test waits for a real background run.
 */
const isolated = isolatedTestDatabase("ai_assessment_failure");
let db: NodePgDatabase;
const clock = steppingClock("2026-11-03T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const ben = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const tomViewer = { id: tom.teamMemberId, role: "technician" } as const;
const benViewer = { id: ben.teamMemberId, role: "helper" } as const;
const EMBEDDING = geminiEmbedding.id;
const CHAT = geminiFlash.id;
const NOW = "2026-11-03T10:00:00Z";
let eightBall: string;
let storage: ReturnType<typeof memoryStorage>;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, ben, "Ben");
  const created = await executeCommand(
    createMachineModelCommand,
    { title: "Eight Ball", manufacturer: "Bally", year: "1980", machineCategory: "pinball" },
    { actor: tom, db, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  eightBall = created.result.machineModelId;
});

afterAll(() => isolated.close());

beforeEach(async () => {
  await db.execute("DELETE FROM ai_work_hold");
  await db.execute("DELETE FROM ai_assessment");
  await withoutMachines(db);
  clock.set(NOW);
  storage = memoryStorage();
  await saveAiSettings();
});

const scenario = aiScenario({ db: () => db, storage: () => storage, clock, technician: tom });
const { ai, openRouter, removeTheKey, aPhoto } = scenario;
const saveAiSettings = () => scenario.turnAiOn({ chatModel: CHAT, embeddingModel: EMBEDDING });

async function aMachine(museumNumber: string) {
  const registered = await executeCommand(
    registerMachineCommand,
    { machineModelId: eightBall, museumNumber, serialNumber: undefined, location: "Hall 1", machineStatus: "playable" },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!registered.ok) throw new Error(registered.error);
  return registered.result.machineId;
}

async function anOpenDefect(machineId: string, suitableForHelpers = false) {
  const reported = await executeCommand(
    reportProblemAndTriageCommand,
    {
      machineId,
      description: "Left flipper weak – first seen",
      triage: {
        outcome: "defect-recorded",
        title: "Left flipper weak",
        priority: undefined,
        suitableForHelpers,
        machineStatus: undefined,
        machineVersion: undefined,
      },
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!reported.ok || !reported.result.defectId) throw new Error("no defect recorded");
  return reported.result.defectId;
}

const attach = (machineId: string, title: string, bytes: Uint8Array) =>
  scenario.attachFile(machineId, { title, bytes, contentType: "application/pdf" });

const request = (defectId: string, note = "", photos: string[] = []) =>
  scenario.requestAiAssessment(defectId, { note, photos });

/** One run of the real AI assessment kind – the background work as the worker route starts it. */
const runWith = (dependencies: AiDependencies | ScenarioOpenRouter) =>
  scenario.run({ kinds: [aiAssessmentWork], with: dependencies });
const run = (settings: Parameters<typeof memoryAi>[0] = {}) => runWith(ai(settings));

async function page(defectId: string, viewer: { id: string; role: "helper" | "technician" } = tomViewer) {
  const details = await loadDefectDetails(db, fixedClock(NOW), defectId, { viewer, storage, ai: ai() });
  if (!details) throw new Error("no defect page");
  const retryAiAssessmentAction = async () => null;
  return {
    details,
    html: renderToStaticMarkup(createElement(DefectDetailsView, { details, retryAiAssessmentAction })),
  };
}

/** An AI assessment of the defect failed with the reason the run's chat answer gives. */
async function failedAssessment(
  defectId: string,
  settings: Parameters<typeof memoryAi>[0],
  note = "",
  photos: string[] = [],
) {
  const id = await request(defectId, note, photos);
  await run(settings);
  return id;
}

describe("an AI assessment that failed or broke off (ST-108)", () => {
  it("ST-108: „Erneut versuchen“ asks for a new AI assessment with the same note and photos", async () => {
    const machineId = await aMachine("LG-042");
    const defectId = await anOpenDefect(machineId);
    const photos = [await aPhoto(), await aPhoto()];
    const failedId = await failedAssessment(
      defectId,
      { chatAnswer: { failure: "credit-used-up" } },
      "Coil gets hot",
      photos,
    );
    const failed = (await aiAssessmentsOfDefect(db, defectId)).find((each) => each.id === failedId);
    expect(failed).toMatchObject({ state: "failed", failureReason: "credit-used-up" });

    const technician = await page(defectId);
    expect(technician.html).toContain("Erneut versuchen");
    const helper = await page(defectId, benViewer);
    expect(helper.details.aiAssessments.mayRequest).toBe(false);
    expect(helper.html).not.toContain("Erneut versuchen");

    // One tap: the failed one's note and photos are read on the server and asked for again – no form in between.
    const input = await aiAssessmentRetryRequest(db, defectId);
    expect(input).toMatchObject({ defectId, note: "Coil gets hot" });
    expect(input?.photos).toEqual(photos);
    clock.advance(60); // the team member taps a moment later – the new AI assessment is the newest.
    // A forged post cannot choose the input: the form has no fields; the note and photos come from the failed one.
    const otherDefect = await anOpenDefect(await aMachine("LG-043"));
    const forged = new FormData();
    forged.append("defectId", otherDefect);
    forged.append("note", "forged note");
    forged.append("photos", "forged/photo.jpg");
    let landed = "";
    const retry = formRunner({ currentPerson: async () => tom, db, clock, newId: randomUUID, storage })(
      requestAiAssessmentCommand(ai()),
      retryAiAssessmentForm({
        input: input!,
        onSuccess: async () => {
          landed = aiAssessmentLanding(defectId);
        },
      }),
    );
    const state = await retry(null, forged);

    expect(state).toBeNull();
    expect(landed).toBe(`/team/defects/${defectId}`);
    const retried = await page(defectId);
    expect(retried.details.aiAssessments.current).toMatchObject({
      state: "requested",
      note: "Coil gets hot",
    });
    expect(retried.details.aiAssessments.current?.photos).toHaveLength(2);
    // The failed one stays as it is; the defect has two AI assessments now.
    const all = await aiAssessmentsOfDefect(db, defectId);
    expect(all).toHaveLength(2);
    expect(all.find((each) => each.id === failedId)).toMatchObject({
      state: "failed",
      failureReason: "credit-used-up",
    });
  });

  it("ST-108: A failed AI assessment says why in German and offers „Erneut versuchen“", async () => {
    const examples: {
      what: string;
      settings: Parameters<typeof memoryAi>[0];
      reason: string;
      /** A text of OpenRouter's answer that must never reach the page. */
      raw?: string;
    }[] = [
      {
        what: "OpenRouter refusing the key",
        settings: { acceptedKeys: [] },
        reason: "OpenRouter hat den API-Schlüssel abgelehnt. Techniker:innen können ihn unter Einstellungen ersetzen.",
      },
      {
        what: "OpenRouter saying the credit is used up",
        settings: { chatAnswer: { failure: "credit-used-up" } },
        reason: "Das Guthaben bei OpenRouter ist aufgebraucht.",
      },
      {
        what: "OpenRouter having no provider for the model",
        settings: { chatAnswer: { failure: "model-not-available" } },
        reason:
          "Das Chat-Modell ist bei OpenRouter gerade nicht verfügbar. Bei einem kostenlosen Modell die Datenschutz-Einstellungen des OpenRouter-Kontos prüfen.",
      },
      {
        what: "OpenRouter reachable but not answering in time",
        settings: { chatAnswer: { failure: "timed-out" } },
        reason: "Die KI hat nicht rechtzeitig geantwortet.",
      },
      {
        what: "OpenRouter not answering, because it cannot be reached",
        settings: { unreachable: true },
        reason: "OpenRouter war nicht erreichbar.",
      },
      {
        what: "an empty answer of the chat model",
        settings: { chatAnswer: { content: "", cost: 0 } },
        reason: "Die Antwort der KI war unbrauchbar.",
      },
      {
        what: "an answer of the chat model that has no usable summary",
        settings: {
          chatAnswer: {
            content: JSON.stringify({ summary: "", probableCauses: ["Das ist keine Einschätzung"] }),
            cost: 0,
          },
        },
        reason: "Die Antwort der KI war unbrauchbar.",
        raw: "Das ist keine Einschätzung",
      },
    ];

    for (const [index, example] of examples.entries()) {
      const machineId = await aMachine(`LG-${100 + index}`);
      const defectId = await anOpenDefect(machineId);
      const id = await request(defectId);
      await run(example.settings);

      const failed = (await aiAssessmentsOfDefect(db, defectId)).find((each) => each.id === id);
      expect(failed?.state, example.what).toBe("failed");
      const { html } = await page(defectId);
      expect(html, example.what).toContain(`KI-Einschätzung fehlgeschlagen: ${example.reason}`);
      expect(html, example.what).toContain("Erneut versuchen");
      // Never OpenRouter's own words – the anti-corruption layer turns every answer into one of the fixed reasons.
      if (example.raw) expect(html, example.what).not.toContain(example.raw);
    }
  });

  it("ST-108: AI turned off meanwhile fails the AI assessment without sending anything", async () => {
    const machineId = await aMachine("LG-042");
    const defectId = await anOpenDefect(machineId);
    const id = await request(defectId);
    // A technician removes the key before the writing has started.
    await removeTheKey();
    const off = openRouter();

    await runWith(off);

    expect(off.requests).toEqual([]);
    expect(off.chatRequests).toEqual([]);
    expect((await aiAssessmentsOfDefect(db, defectId)).find((each) => each.id === id)).toMatchObject({
      state: "failed",
      failureReason: "ai-off",
    });
    const { details, html } = await page(defectId);
    expect(details.aiAssessments.mayRequest).toBe(false);
    expect(html).toContain("KI-Einschätzung fehlgeschlagen: Die KI wurde inzwischen ausgeschaltet.");
    expect(html).not.toContain("Erneut versuchen");
  });

  it("ST-108: A write whose hold ran out without a result fails as broken off and is not written again", async () => {
    const machineId = await aMachine("LG-042");
    const defectId = await anOpenDefect(machineId);
    const id = await request(defectId);
    // A run is cut off while it writes the AI assessment – it never ends (a crash, a deployment, the time limit).
    let writing!: () => void;
    const writingStarted = new Promise<void>((resolve) => (writing = resolve));
    const never = new Promise<never>(() => {});
    const cutOff = openRouter({
      beforeChat: async () => {
        writing();
        await never;
      },
    });
    void runWith(cutOff);
    await writingStarted;

    // A refresh of the page before the hold ran out starts no run.
    const starts: string[] = [];
    const pageStartsARun = () =>
      startWhenLeftUnfinished(
        {
          leftUnfinished: (kind, pieceIds) => aiWorkLeftUnfinished(db, clock, kind, pieceIds),
          start: () => starts.push("run"),
        },
        AI_ASSESSMENT_KIND,
        [id],
      );
    expect(await pageStartsARun()).toBe(false);
    expect(starts).toEqual([]);

    // The hold has run out: the page's refresh starts the run that records the break-off.
    clock.set("2026-11-03T10:08:21Z");
    expect(await pageStartsARun()).toBe(true);
    expect(starts).toEqual(["run"]);
    const recording = openRouter();
    await runWith(recording);

    expect(recording.requests).toEqual([]);
    expect(recording.chatRequests).toEqual([]);
    const { html } = await page(defectId);
    expect(html).toContain("KI-Einschätzung fehlgeschlagen: Die Arbeit daran wurde abgebrochen, bevor sie fertig war.");
    expect(html).toContain("Erneut versuchen");

    // No later run writes that AI assessment again.
    const later = openRouter();
    clock.set("2026-11-03T10:20:00Z");
    await runWith(later);

    expect(later.chatRequests).toEqual([]);
    expect((await aiAssessmentsOfDefect(db, defectId)).find((each) => each.id === id)).toMatchObject({
      state: "failed",
      failureReason: "broken-off",
    });
  });

  it("ST-108: A late result after a break-off is not stored", async () => {
    const machineId = await aMachine("LG-042");
    const defectId = await anOpenDefect(machineId);
    const id = await request(defectId);
    // The run that took the AI assessment is still writing it when its hold runs out.
    let writing!: () => void;
    const writingStarted = new Promise<void>((resolve) => (writing = resolve));
    let finish!: () => void;
    const finishes = new Promise<void>((resolve) => (finish = resolve));
    const lateAi = openRouter({
      beforeChat: async () => {
        writing();
        await finishes;
      },
    });
    const lateRun = runWith(lateAi);
    await writingStarted;

    clock.set("2026-11-03T10:08:21Z");
    await runWith(openRouter());
    expect((await aiAssessmentsOfDefect(db, defectId)).find((each) => each.id === id)).toMatchObject({
      state: "failed",
      failureReason: "broken-off",
    });

    // That run finishes its AI assessment afterwards – a late result records nothing.
    finish();
    await lateRun;

    const late = (await aiAssessmentsOfDefect(db, defectId)).find((each) => each.id === id);
    expect(late).toMatchObject({ state: "failed", failureReason: "broken-off" });
    expect(late?.summary).toBeUndefined();
    expect(late?.cost).toBeUndefined();
  });

  it("ST-108: A defect resolved meanwhile does not stop the AI assessment", async () => {
    const machineId = await aMachine("LG-042");
    const defectId = await anOpenDefect(machineId);
    const id = await request(defectId);
    const before = await defectDetails(db, defectId);
    if (!before) throw new Error("no defect");
    const resolved = await executeCommand(
      resolveDefectCommand,
      { defectId, version: before.version, closingNote: "Coil replaced" },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!resolved.ok) throw new Error(resolved.error);

    await run();

    expect((await aiAssessmentsOfDefect(db, defectId)).find((each) => each.id === id)?.state).toBe("written");
    expect((await defectDetails(db, defectId))?.state).toBe("resolved");
    const { html } = await page(defectId);
    expect(html).toContain("Der linke Flipperfinger wird schwach.");
  });

  it("ST-108: A referenced file removed later stays a reference without a link", async () => {
    const machineId = await aMachine("LG-042");
    const defectId = await anOpenDefect(machineId);
    const manual = await attach(machineId, "Eight Ball Manual", await aPdfOfText(["Page 12"]));
    const id = await request(defectId);
    await writeAiAssessmentForTest(db, id, {
      summary: "Die Spule ist schwach.",
      references: [{ fileId: manual, page: 12 }],
      embeddingModel: EMBEDDING,
      at: clock,
    });

    const removed = await executeCommand(
      removeFileCommandWithAiIndex,
      { fileId: manual, version: 0 },
      { actor: tom, db, clock },
    );
    if (!removed.ok) throw new Error(removed.error);

    const { html } = await page(defectId);
    expect(html).toContain("Eight Ball Manual, S. 12");
    expect(html).not.toContain(`/team/dateien/${manual}`);
  });
});

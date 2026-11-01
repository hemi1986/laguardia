import { randomBytes, randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { reportProblemAndTriageCommand } from "@/modules/repair";
import {
  aiAssessmentRetryRequest,
  aiAssessmentWork,
  aiAssessmentsOfDefect,
  aiSettingsForm,
  changeAiSettingsCommand,
  requestAiAssessmentCommand,
  runAiWork,
  type AiDependencies,
} from "@/modules/ai-assistance";
import { steppingClock } from "@/modules/ai-assistance/ai-work-stand-in.test-support";
import { aJpeg } from "@/modules/ai-assistance/file-indexing.test-support";
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
const environmentKey = randomBytes(32);
const KEY = "sk-or-v1-0123456789abcdef0123456789abcdefa1b2";
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

function ai(settings: Parameters<typeof memoryAi>[0] = {}): AiDependencies {
  return { ai: memoryAi({ acceptedKeys: [KEY], ...settings }), encryptionKey: () => environmentKey };
}

async function saveAiSettings() {
  const dependencies = ai();
  const { version } = await aiSettingsForm(db, dependencies);
  const saved = await executeCommand(
    changeAiSettingsCommand(dependencies),
    { version, key: KEY, chatModel: CHAT, embeddingModel: EMBEDDING },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!saved.ok) throw new Error(saved.error);
}

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

async function aPhoto(): Promise<string> {
  const name = `ai-assessments/${randomUUID()}.jpg`;
  await storage.write(name, Uint8Array.from(await aJpeg()), "image/jpeg");
  return name;
}

async function request(defectId: string, note = "", photos: string[] = []) {
  const asked = await executeCommand(
    requestAiAssessmentCommand(ai()),
    { defectId, note, photos },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!asked.ok) throw new Error(asked.error);
  return asked.result.aiAssessmentId;
}

/** One run of the real AI assessment kind – the background work as the worker route starts it. */
function run(settings: Parameters<typeof memoryAi>[0] = {}) {
  return runAiWork({
    db,
    clock,
    budgetSeconds: 250,
    ai: ai(settings),
    storage,
    continueWork: async () => undefined,
    kinds: [aiAssessmentWork],
  });
}

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
    const state = await retry(null, new FormData());

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
        what: "no provider that neither keeps nor trains on the data has the model",
        settings: { chatAnswer: { failure: "model-not-available" } },
        reason: "Das Chat-Modell ist bei OpenRouter gerade nicht ohne Datenspeicherung verfügbar.",
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
});

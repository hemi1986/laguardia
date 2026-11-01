import { randomBytes, randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { defectDetails, reportProblemAndTriageCommand } from "@/modules/repair";
import {
  aiSettingsForm,
  changeAiSettingsCommand,
  defectAiAssessments,
  requestAiAssessmentCommand,
  type AiDependencies,
} from "@/modules/ai-assistance";
import { memoryAi, geminiEmbedding, geminiFlash } from "@/modules/ai-assistance/ai-seam.test-support";
import { aJpeg } from "@/modules/ai-assistance/file-indexing.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { memoryStorage } from "@/platform/storage";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { anExistingTeamMember } from "@/test-support/team-members";
import { DefectDetailsView } from "../(team)/team/defects/[defectId]/defect-details";
import { loadDefectDetails } from "../(team)/team/defects/[defectId]/defect-details-data";
import {
  aiAssessmentLanding,
  requestAiAssessmentForm,
  type RequestAiAssessmentField,
  type RequestAiAssessmentFormError,
} from "../(team)/team/defects/[defectId]/ki-einschaetzung/request-ai-assessment-definition";
import { formRunner } from "./form-runner";

/**
 * ST-107: asking for an AI assessment through its form and the Server Action runner (G8, G8a, G35) – the runner is
 * tested here, where it lives, with the acting person `currentPerson()` would give. The page is rendered afterwards
 * from the same database, so "back on the defect page" and "the page carries an automatic refresh" are checks of what
 * the team member sees.
 */
const isolated = isolatedTestDatabase("ai_assessment_request");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const environmentKey = randomBytes(32);
const KEY = "sk-or-v1-0123456789abcdef0123456789abcdefa1b2";
const EMBEDDING = geminiEmbedding.id;
const CHAT = geminiFlash.id;
const NOW = "2026-11-03T12:00:00Z";
let eightBall: string;
let storage: ReturnType<typeof memoryStorage>;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
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
  await withoutMachines(db);
  storage = memoryStorage();
  await saveAiSettings();
});

function ai(): AiDependencies {
  return { ai: memoryAi({ acceptedKeys: [KEY] }), encryptionKey: () => environmentKey };
}

async function saveAiSettings() {
  const dependencies = ai();
  const { version } = await aiSettingsForm(db, dependencies);
  const saved = await executeCommand(
    changeAiSettingsCommand(dependencies),
    { version, key: KEY, chatModel: CHAT, embeddingModel: EMBEDDING },
    { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
  );
  if (!saved.ok) throw new Error(saved.error);
}

async function anOpenDefect(): Promise<string> {
  const registered = await executeCommand(
    registerMachineCommand,
    {
      machineModelId: eightBall,
      museumNumber: "LG-042",
      serialNumber: undefined,
      location: "Hall 1",
      machineStatus: "playable",
    },
    { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
  );
  if (!registered.ok) throw new Error(registered.error);
  const reported = await executeCommand(
    reportProblemAndTriageCommand,
    {
      machineId: registered.result.machineId,
      description: "Left flipper weak – first seen",
      triage: {
        outcome: "defect-recorded",
        title: "Left flipper weak",
        priority: undefined,
        suitableForHelpers: false,
        machineStatus: undefined,
        machineVersion: undefined,
      },
    },
    { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
  );
  if (!reported.ok || !reported.result.defectId) throw new Error("no defect recorded");
  return reported.result.defectId;
}

function theForm(defectId: string, onLanded: (address: string) => void = () => undefined) {
  return formRunner({ currentPerson: async () => tom, db, clock: fixedClock(NOW), newId: randomUUID, storage })(
    requestAiAssessmentCommand(ai()),
    requestAiAssessmentForm({
      defectId,
      onSuccess: async () => onLanded(aiAssessmentLanding(defectId)),
    }),
  );
}

async function posted(note: string, photos: number): Promise<FormData> {
  const form = new FormData();
  form.append("note", note);
  for (let number = 1; number <= photos; number++) {
    form.append("photos", new File([Uint8Array.from(await aJpeg())], `photo-${number}.jpg`, { type: "image/jpeg" }));
  }
  return form;
}

async function page(defectId: string) {
  const details = await loadDefectDetails(db, fixedClock(NOW), defectId, {
    viewer: { id: tom.teamMemberId, role: "technician" },
    storage,
    ai: ai(),
  });
  if (!details) throw new Error("no defect page");
  return { details, html: renderToStaticMarkup(createElement(DefectDetailsView, { details })) };
}

describe("asking for an AI assessment", () => {
  it("ST-107: A technician asks for an AI assessment with a note and photos", async () => {
    const defectId = await anOpenDefect();
    const before = await defectDetails(db, defectId);
    if (!before) throw new Error("no defect");
    let landed = "";

    const state = await theForm(defectId, (address) => (landed = address))(
      null,
      await posted("Coil gets hot after 10 minutes", 2),
    );

    expect(state).toBeNull();
    expect(landed).toBe(`/team/defects/${defectId}`);
    const after = await defectDetails(db, defectId);
    expect(after?.version).toBe(before.version);
    expect(after).toMatchObject({ state: "open", title: "Left flipper weak" });
    const { details, html } = await page(defectId);
    expect(details.aiAssessments.current).toMatchObject({
      state: "requested",
      note: "Coil gets hot after 10 minutes",
    });
    expect(details.aiAssessments.current?.photos).toHaveLength(2);
    expect(html).toContain("KI-Einschätzung läuft …");
    // The page refreshes itself, and a meta refresh works without JavaScript.
    expect(html).toContain('http-equiv="refresh"');
  });

  it("ST-107: A second request while one is being written is rejected", async () => {
    const defectId = await anOpenDefect();
    const asked = await executeCommand(
      requestAiAssessmentCommand(ai()),
      { defectId, note: "", photos: [] },
      { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
    );
    if (!asked.ok) throw new Error(asked.error);
    const { details, html } = await page(defectId);
    expect(details.aiAssessments.mayRequest).toBe(false);
    expect(html).not.toContain("KI-Einschätzung anfordern");

    // A form opened before, with a note typed: its post is rejected and the note stays.
    const state: { error: RequestAiAssessmentFormError; values: Record<RequestAiAssessmentField, string> } | null =
      await theForm(defectId)(null, await posted("Coil gets hot", 0));

    expect(state?.error).toBe("ai-assessment-being-written");
    expect(state?.values.note).toBe("Coil gets hot");
    // Still only the one AI assessment, and still being written.
    const after = await defectAiAssessments(db, { defectId, viewer: tom, dependencies: ai() });
    expect(after.mayRequest).toBe(false);
    expect(after.current?.id).toBe(asked.result.aiAssessmentId);
    expect(after.current?.state).toBe("requested");
  });
});

import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMachineModelCommand, machineForTeamForm, registerMachineCommand } from "@/modules/collection";
import {
  defectDetails,
  putDefectOnHoldCommand,
  reportProblemAndTriageCommand,
  resolveDefectCommand,
  retireMachineCommand,
} from "@/modules/repair";
import { defectAiAssessments, requestAiAssessmentCommand } from "@/modules/ai-assistance";
import { writeAiAssessmentForTest } from "@/modules/ai-assistance/ai-assessment.test-support";
import { geminiEmbedding, geminiFlash } from "@/modules/ai-assistance/ai-seam.test-support";
import { aiScenario } from "@/modules/ai-assistance/ai-scenario.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand, type Actor } from "@/platform/command";
import { memoryStorage } from "@/platform/storage";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { anExistingTeamMember } from "@/test-support/team-members";
import { DefectDetailsView } from "./defect-details";
import { loadDefectDetails, type DefectDetailsData } from "./defect-details-data";

/**
 * ST-107 on the defect page: the section „KI-Einschätzungen“ (RM-DefectAiAssessments) – what it shows, to whom it offers
 * „KI-Einschätzung anfordern“ and when it is hidden. The page is composed from Repair's defect, Collection's file
 * titles and AI assistance's read model, and rendered by its view – the seam the catalog names for a composed page.
 */
const isolated = isolatedTestDatabase("ai_assessment_page");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const ben = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const tomViewer = { id: tom.teamMemberId, role: "technician" } as const;
const benViewer = { id: ben.teamMemberId, role: "helper" } as const;
const EMBEDDING = geminiEmbedding.id;
const CHAT = geminiFlash.id;
const NOW = "2026-11-03T12:00:00Z";
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
  await withoutMachines(db);
  storage = memoryStorage();
  await saveAiSettings();
});

const scenario = aiScenario({ db: () => db, storage: () => storage, clock: fixedClock(NOW), technician: tom });
/** The AI seam in tests – only the chat model's name is read here; nothing is written in this file's scenarios. */
const ai = () => scenario.ai();
const saveAiSettings = () => scenario.turnAiOn({ chatModel: CHAT, embeddingModel: EMBEDDING });
const turnAiOff = scenario.removeTheKey;

async function aMachine(museumNumber: string) {
  const registered = await executeCommand(
    registerMachineCommand,
    { machineModelId: eightBall, museumNumber, serialNumber: undefined, location: "Hall 1", machineStatus: "playable" },
    { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
  );
  if (!registered.ok) throw new Error(registered.error);
  return registered.result.machineId;
}

async function anOpenDefect(machineId: string, title: string, suitableForHelpers = false) {
  const reported = await executeCommand(
    reportProblemAndTriageCommand,
    {
      machineId,
      description: `${title} – first seen`,
      triage: {
        outcome: "defect-recorded",
        title,
        priority: undefined,
        suitableForHelpers,
        machineStatus: undefined,
        machineVersion: undefined,
      },
    },
    { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
  );
  if (!reported.ok || !reported.result.defectId) throw new Error("no defect recorded");
  return reported.result.defectId;
}

const request = (defectId: string, actor: Actor = tom, note = "", photos: string[] = []) =>
  scenario.requestAiAssessment(defectId, { note, photos, by: actor });

async function writtenAssessment(defectId: string, summary = "Die Spule ist schwach.") {
  const id = await request(defectId, tom);
  const pdf = await attach(defectId, "Eight Ball Manual");
  await writeAiAssessmentForTest(db, id, {
    summary,
    probableCauses: ["Die Spule ist verschlissen.", "Der Kontakt ist oxidiert."],
    whatToCheckFirst: ["Die Spule messen."],
    references: [{ fileId: pdf, page: 12 }],
    embeddingModel: EMBEDDING,
    cost: 0.04,
    at: fixedClock("2026-11-03T11:00:00Z"),
  });
  return { id, fileId: pdf };
}

async function attach(defectId: string, title: string) {
  const defect = await defectDetails(db, defectId);
  if (!defect) throw new Error("no defect");
  const bytes = new TextEncoder().encode("manual");
  return scenario.attachFile(defect.machineId, { title, bytes, contentType: "application/pdf" });
}

async function page(
  defectId: string,
  viewer: { id: string; role: "helper" | "technician" } = tomViewer,
): Promise<{ data: DefectDetailsData; html: string }> {
  const data = await loadDefectDetails(db, fixedClock(NOW), defectId, {
    viewer,
    storage,
    ai: ai(),
  });
  if (!data) throw new Error("no defect page");
  return { data, html: renderToStaticMarkup(createElement(DefectDetailsView, { details: data })) };
}

describe("the AI assessments section on a defect's page", () => {
  it("ST-107: The written AI assessment says what it found, that it is AI, and what it cost", async () => {
    const machineId = await aMachine("LG-042");
    const defectId = await anOpenDefect(machineId, "Left flipper weak");
    const { fileId } = await writtenAssessment(defectId);

    const { data, html } = await page(defectId);

    expect(data.aiAssessments.current?.state).toBe("written");
    expect(html).toContain("KI-Einschätzungen");
    expect(html).toContain("Zusammenfassung");
    expect(html).toContain("Die Spule ist schwach.");
    expect(html).toContain("Wahrscheinliche Ursachen");
    // In the order the chat model ranked them.
    expect(html.indexOf("Die Spule ist verschlissen.")).toBeLessThan(html.indexOf("Der Kontakt ist oxidiert."));
    expect(html).toContain("Zuerst prüfen");
    expect(html).toContain("Die Spule messen.");
    expect(html).toContain("Fundstellen");
    expect(html).toContain(`/team/dateien/${fileId}`);
    expect(html).toContain("Eight Ball Manual, S. 12");
    // That it is AI, with the model, when it was written, who asked and the cost.
    expect(html).toContain("KI-Einschätzung · Gemini 2.5 Flash · 03.11.2026, 12:00 · angefordert von Tom · 0,04 $");
  });

  it("ST-107: A helper asks for an AI assessment of a defect suitable for helpers", async () => {
    const machineId = await aMachine("LG-042");
    const suitable = await anOpenDefect(machineId, "Ball stuck in shooter lane", true);
    const notSuitable = await anOpenDefect(machineId, "Display flickers");
    const noneAtAll = await anOpenDefect(machineId, "Drop target slow");
    const { id } = await writtenAssessment(notSuitable, "Der Bildschirm flackert.");
    // The helper may request one for the suitable defect – and while it is written the action is gone (HS-31).
    const beforeRequest = await page(suitable, benViewer);
    expect(beforeRequest.data.aiAssessments.mayRequest).toBe(true);
    await request(suitable, ben);
    const atSuitable = await page(suitable, benViewer);
    expect(atSuitable.data.aiAssessments.mayRequest).toBe(false);
    expect(atSuitable.html).toContain("KI-Einschätzung läuft …");
    const atNotSuitable = await page(notSuitable, benViewer);
    expect(atNotSuitable.data.aiAssessments.mayRequest).toBe(false);
    // The AI assessment stays readable to the helper, without „KI-Einschätzung anfordern“.
    expect(atNotSuitable.html).toContain("Der Bildschirm flackert.");
    expect(atNotSuitable.html).not.toContain("KI-Einschätzung anfordern");
    const atNone = await page(noneAtAll, benViewer);
    expect(atNone.data.aiAssessments.shown).toBe(false);
    expect(atNone.html).not.toContain("KI-Einschätzungen");
    // A request the helper sends anyway is rejected and records nothing.
    const forged = await executeCommand(
      requestAiAssessmentCommand(ai()),
      { defectId: notSuitable, note: "", photos: [] },
      { actor: ben, db, clock: fixedClock(NOW), newId: randomUUID },
    );
    expect(forged).toEqual({ ok: false, error: "ai-assessment-not-allowed-for-helpers" });
    expect(
      (
        await defectAiAssessments(db, {
          defectId: notSuitable,
          viewer: { teamMemberId: ben.teamMemberId, role: "helper" },
          dependencies: ai(),
        })
      ).current?.id,
    ).toBe(id);
  });

  it("ST-107: Only an open defect can be assessed, on hold included", async () => {
    const onHold = await anOpenDefect(await aMachine("LG-042"), "Display flickers");
    const details = await defectDetails(db, onHold);
    if (!details) throw new Error("no defect");
    const held = await executeCommand(
      putDefectOnHoldCommand,
      { defectId: onHold, version: details.version, reason: "waiting-for-part", note: "" },
      { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
    );
    if (!held.ok) throw new Error(held.error);
    const resolvedMachine = await aMachine("LG-043");
    const resolved = await anOpenDefect(resolvedMachine, "Left flipper weak");
    const resolvedDetails = await defectDetails(db, resolved);
    if (!resolvedDetails) throw new Error("no defect");
    await executeCommand(
      resolveDefectCommand,
      { defectId: resolved, version: resolvedDetails.version, closingNote: "Fixed" },
      { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
    );
    const retiredMachine = await aMachine("LG-044");
    const retired = await anOpenDefect(retiredMachine, "Coin door jammed");
    const machine = await machineForTeamForm(db, "LG-044");
    if (!machine) throw new Error("no machine");
    await executeCommand(
      retireMachineCommand,
      { machineId: retiredMachine, version: machine.version, reason: "Sold" },
      { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
    );

    // „KI-Einschätzung anfordern“ is offered on the defect on hold only.
    expect((await page(onHold)).data.aiAssessments.mayRequest).toBe(true);
    expect((await page(resolved)).data.aiAssessments.mayRequest).toBe(false);
    expect((await page(retired)).data.aiAssessments.mayRequest).toBe(false);
    for (const defectId of [resolved, retired]) {
      const rejected = await executeCommand(
        requestAiAssessmentCommand(ai()),
        { defectId, note: "", photos: [] },
        { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
      );
      expect(rejected).toEqual({ ok: false, error: "ai-assessment-defect-not-open" });
      // Nothing was recorded for either.
      expect(
        (
          await defectAiAssessments(db, {
            defectId,
            viewer: { teamMemberId: tom.teamMemberId, role: "technician" },
            dependencies: ai(),
          })
        ).current,
      ).toBeUndefined();
    }
  });

  it("ST-107: While AI is off nothing about AI assessments is offered", async () => {
    const machineId = await aMachine("LG-042");
    const fresh = await anOpenDefect(machineId, "Left flipper weak");
    const withOne = await anOpenDefect(machineId, "Display flickers");
    await writtenAssessment(withOne, "Der Bildschirm flackert.");
    await turnAiOff();

    const atFresh = await page(fresh);
    expect(atFresh.data.aiAssessments.shown).toBe(false);
    expect(atFresh.html).not.toContain("KI-Einschätzungen");
    const atWithOne = await page(withOne);
    expect(atWithOne.html).toContain("KI-Einschätzungen");
    expect(atWithOne.html).toContain("Der Bildschirm flackert.");
    expect(atWithOne.html).not.toContain("KI-Einschätzung anfordern");
    const rejected = await executeCommand(
      requestAiAssessmentCommand(ai()),
      { defectId: fresh, note: "", photos: [] },
      { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
    );
    expect(rejected).toEqual({ ok: false, error: "ai-assessment-ai-off" });
    expect(
      (
        await defectAiAssessments(db, {
          defectId: fresh,
          viewer: { teamMemberId: tom.teamMemberId, role: "technician" },
          dependencies: ai(),
        })
      ).current,
    ).toBeUndefined();
  });
});

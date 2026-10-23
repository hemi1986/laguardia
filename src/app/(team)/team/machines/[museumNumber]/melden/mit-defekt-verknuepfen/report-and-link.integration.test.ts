import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  openDefectTitles,
  problemReportsOfMachine,
  reportProblemAndTriageCommand,
  resolveDefectCommand,
} from "@/modules/repair";
import { retireMachineForTest } from "@/modules/collection/machines.test-support";
import { storedProblemReport } from "@/modules/repair/command-probes.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { memoryStorage } from "@/platform/storage";
import { formRunner } from "@/app/_actions/form-runner";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { reportAndResolveFields, reportAndResolveInput } from "../direkt-behoben/report-and-resolve-input";
import { reportAndTriagePhoto } from "../report-and-triage";
import { rejectionText } from "../report-and-triage-rejection-text";
import { reportAndLinkFields, reportAndLinkInput } from "./report-and-link-input";
import { post } from "@/test-support/forms";

/**
 * The forms „Problem melden und mit Defekt verknüpfen“ and „… und als direkt behoben eintragen“ (ST-052): their fields
 * and input functions run through the Server Action runner with a photo, as the signed-in team member – what their
 * Server Actions do in a request. The problem report and its triage are stored together or not at all.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-12T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;

/** A photo as the browser prepared it. */
async function aPhoto(): Promise<File> {
  const jpeg = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#3c78c8" } })
    .jpeg()
    .toBuffer();
  return new File([Uint8Array.from(jpeg)], "IMG_0042.jpg", { type: "image/jpeg" });
}

/** A machine with the open defect „Left flipper weak“, reported and recorded by Tom (ST-023). */
async function aMachineWithAnOpenDefect() {
  await anExistingTeamMember(db, tom, "Tom");
  const machineId = await aRegisteredMachine(db);
  const recorded = await executeCommand(
    reportProblemAndTriageCommand,
    {
      machineId,
      description: "Left flipper barely moves",
      triage: {
        outcome: "defect-recorded",
        title: "Left flipper weak",
        priority: undefined,
        suitableForHelpers: false,
        machineStatus: undefined,
        machineVersion: undefined,
      },
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!recorded.ok || !recorded.result.defectId) throw new Error("no defect recorded");
  return { machineId, defectId: recorded.result.defectId };
}

function runner(actor: Actor, storage = memoryStorage()) {
  return { storage, run: formRunner({ currentPerson: async () => actor, db, clock, newId: randomUUID, storage }) };
}

/** The form „… und mit Defekt verknüpfen“ for one machine, with a storage of its own to look into. */
function linkFormFor(machineId: string, actor: Actor = tom) {
  const { storage, run } = runner(actor);
  const action = run(reportProblemAndTriageCommand, {
    fields: reportAndLinkFields,
    photo: reportAndTriagePhoto,
    input: (fields, photo) => reportAndLinkInput(fields, machineId, photo),
    onSuccess: async () => {},
  });
  return { action, storage };
}

/** The form „… und als direkt behoben eintragen“ for one machine. */
function resolveFormFor(machineId: string, actor: Actor = anna) {
  const { storage, run } = runner(actor);
  const action = run(reportProblemAndTriageCommand, {
    fields: reportAndResolveFields,
    photo: reportAndTriagePhoto,
    input: (fields, photo) => reportAndResolveInput(fields, machineId, photo),
    onSuccess: async () => {},
  });
  return { action, storage };
}

/** What is stored for the machine: its problem reports, journal entries and photos. */
async function stored(machineId: string, storage: ReturnType<typeof memoryStorage>) {
  return {
    problemReports: (await problemReportsOfMachine(db, machineId)).length,
    journal: (await journalOf(db, { machineId })).length,
    photos: storage.names().length,
  };
}

describe("the forms for reporting a problem and linking it or resolving it on the spot", () => {
  it("ST-052: Helpers cannot link a problem report to a defect when reporting", async () => {
    // The page sends a helper to the plain report form (browser test); this is the helper who sends the form anyway.
    await anExistingTeamMember(db, anna, "Anna");
    const { machineId, defectId } = await aMachineWithAnOpenDefect();
    const { action, storage } = linkFormFor(machineId, anna);
    const before = await stored(machineId, storage);

    const rejected = await action(
      null,
      post({ description: "Left flipper weak again during test", defectId }, await aPhoto()),
    );

    expect(rejected?.error).toBe("not-authorized");
    expect(await stored(machineId, storage)).toEqual(before);
  });

  it("ST-052: A defect resolved in the meantime cannot be linked when reporting", async () => {
    const { machineId, defectId } = await aMachineWithAnOpenDefect();
    // The form is open, offering „Left flipper weak“, when the defect is resolved.
    const { action, storage } = linkFormFor(machineId);
    const resolved = await executeCommand(
      resolveDefectCommand,
      { defectId, version: 0, closingNote: "Fixed" },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!resolved.ok) throw new Error("not resolved");
    const before = await stored(machineId, storage);
    const form = post({ description: "Left flipper weak again during test", defectId });

    const rejected = await action(null, form);

    expect(rejected).toMatchObject({
      error: "defect-not-open",
      values: { description: "Left flipper weak again during test", defectId },
    });
    expect(await stored(machineId, storage)).toEqual(before);
    expect(await openDefectTitles(db, machineId)).toEqual([]);
    // ST-022's text for it.
    expect(rejectionText(rejected!, "LG-042")).toBe("Dieser Defekt ist nicht mehr offen.");
  });

  it("says that the photo must be chosen again after a rejected link or resolution, and stores no photo", async () => {
    await anExistingTeamMember(db, anna, "Anna");
    const { machineId } = await aMachineWithAnOpenDefect();
    const link = linkFormFor(machineId);
    const resolve = resolveFormFor(machineId);
    const linkWithoutDefect = post({ description: "Left flipper weak again during test" }, await aPhoto());
    const resolveWithoutNote = post({ description: "Ball stuck behind the left ramp", note: " " }, await aPhoto());

    const rejectedLink = await link.action(null, linkWithoutDefect);
    const rejectedResolution = await resolve.action(null, resolveWithoutNote);

    expect(rejectionText(rejectedLink!, "LG-042")).toBe(
      "Bitte einen Defekt auswählen. Das Foto muss erneut ausgewählt werden.",
    );
    expect(rejectionText(rejectedResolution!, "LG-042")).toBe(
      "Bitte kurz beschreiben, was gemacht wurde. Das Foto muss erneut ausgewählt werden.",
    );
    expect(rejectedResolution?.values).toEqual({ description: "Ball stuck behind the left ramp", note: " " });
    expect([...link.storage.names(), ...resolve.storage.names()]).toEqual([]);
  });

  it("stores the photo with the problem report a helper resolved on the spot", async () => {
    await anExistingTeamMember(db, anna, "Anna");
    const machineId = await aRegisteredMachine(db);
    const { action, storage } = resolveFormFor(machineId);

    expect(
      await action(null, post({ description: "Ball stuck behind the left ramp", note: "Ball freed" }, await aPhoto())),
    ).toBeNull();

    expect(storage.names()).toHaveLength(1);
    const [report] = await problemReportsOfMachine(db, machineId);
    expect((await storedProblemReport(db, report.id))?.photo).toBe(storage.names()[0]);
  });

  it("stores nothing and says so when the machine was retired while either form was open", async () => {
    await anExistingTeamMember(db, anna, "Anna");
    const { machineId, defectId } = await aMachineWithAnOpenDefect();
    const link = linkFormFor(machineId);
    const resolve = resolveFormFor(machineId);
    const retired = await executeCommand(
      retireMachineForTest,
      { machineId, version: 0 },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!retired.ok) throw new Error("not retired");
    const before = await stored(machineId, link.storage);
    const linkForm = post({ description: "Left flipper weak again during test", defectId }, await aPhoto());
    const resolveForm = post({ description: "Ball stuck behind the left ramp", note: "Ball freed" });

    const rejectedLink = await link.action(null, linkForm);
    const rejectedResolution = await resolve.action(null, resolveForm);

    expect(rejectedLink).toMatchObject({
      error: "machine-retired",
      values: { description: "Left flipper weak again during test", defectId },
    });
    expect(rejectedResolution).toMatchObject({
      error: "machine-retired",
      values: { description: "Ball stuck behind the left ramp", note: "Ball freed" },
    });
    expect(rejectionText(rejectedLink!, "LG-042")).toBe(
      "LG-042 ist inzwischen ausgemustert. Es wurde nichts gespeichert. Das Foto muss erneut ausgewählt werden.",
    );
    expect(rejectionText(rejectedResolution!, "LG-042")).toBe(
      "LG-042 ist inzwischen ausgemustert. Es wurde nichts gespeichert.",
    );
    expect(await stored(machineId, link.storage)).toEqual(before);
    expect(resolve.storage.names()).toEqual([]);
  });
});

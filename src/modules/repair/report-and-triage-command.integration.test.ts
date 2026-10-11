import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { openDefectTitles, reportProblemAndTriageCommand, triageList } from ".";
import { storedProblemReport } from "./problem-report-stand-ins.test-support";

/**
 * CMD-ReportProblem with the triage outcomes *resolved on the spot* and *linked* in the same step (ST-052): a
 * technician may choose either, a helper only *resolved on the spot* – stored together with the problem report or not
 * at all.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-12T09:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;

function reportAndResolveOnTheSpot(machineId: string, description: string, note: string, actor: Actor = tom) {
  return executeCommand(
    reportProblemAndTriageCommand,
    { machineId, description, triage: { outcome: "resolved-on-the-spot", note } },
    { actor, db, clock, newId: randomUUID },
  );
}

/** An open defect of the machine – reported and recorded by the technician in one step (ST-023). Returns its ID. */
async function anOpenDefect(machineId: string, title: string) {
  const recorded = await executeCommand(
    reportProblemAndTriageCommand,
    {
      machineId,
      description: `${title} – first seen`,
      triage: {
        outcome: "defect-recorded",
        title,
        priority: undefined,
        suitableForHelpers: false,
        machineStatus: undefined,
        machineVersion: undefined,
      },
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!recorded.ok || !recorded.result.defectId) throw new Error("no defect recorded");
  return recorded.result.defectId;
}

function reportAndLink(machineId: string, description: string, defectId: string | undefined) {
  return executeCommand(
    reportProblemAndTriageCommand,
    { machineId, description, triage: { outcome: "linked", defectId } },
    { actor: tom, db, clock, newId: randomUUID },
  );
}

describe("CMD-ReportProblem with resolving on the spot or linking in the same step", () => {
  it("ST-052: Technician reports and resolves on the spot in one step", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const machineId = await aRegisteredMachine(db);

    const reported = await reportAndResolveOnTheSpot(machineId, "Ball stuck in the shooter lane", "Freed the ball");

    if (!reported.ok) throw new Error(reported.error);
    const { problemReportId } = reported.result;
    expect(await storedProblemReport(db, problemReportId)).toMatchObject({
      machineId,
      description: "Ball stuck in the shooter lane",
      reporter: { kind: "team-member", teamMemberId: tom.teamMemberId },
      triage: {
        outcome: "resolved-on-the-spot",
        triagedBy: tom.teamMemberId,
        triagedAt: new Date("2026-10-12T09:00:00Z"),
        note: "Freed the ball",
      },
    });
    expect(reported.result.defectId).toBeUndefined();
    expect(await openDefectTitles(db, machineId)).toEqual([]);
    expect((await triageList(db, clock)).map((entry) => entry.id)).not.toContain(problemReportId);
    // One action, two events by the same technician – and no free text in the journal.
    const journal = (await journalOf(db, { machineId })).slice(-2);
    expect(journal.map((entry) => [entry.type, entry.actor, entry.data])).toEqual([
      ["EVT-ProblemReported", tom, {}],
      ["EVT-ProblemResolvedOnTheSpot", tom, {}],
    ]);
  });

  it("ST-052: Helper reports and resolves on the spot in one step", async () => {
    await anExistingTeamMember(db, anna, "Anna");
    const machineId = await aRegisteredMachine(db);

    const reported = await reportAndResolveOnTheSpot(machineId, "Ball stuck behind the left ramp", "Ball freed", anna);

    if (!reported.ok) throw new Error(reported.error);
    const { problemReportId } = reported.result;
    expect(await storedProblemReport(db, problemReportId)).toMatchObject({
      description: "Ball stuck behind the left ramp",
      reporter: { kind: "team-member", teamMemberId: anna.teamMemberId },
      triage: { outcome: "resolved-on-the-spot", triagedBy: anna.teamMemberId, note: "Ball freed" },
    });
    expect((await triageList(db, clock)).map((entry) => entry.id)).not.toContain(problemReportId);
    expect((await journalOf(db, { machineId })).slice(-2).map((entry) => [entry.type, entry.actor])).toEqual([
      ["EVT-ProblemReported", anna],
      ["EVT-ProblemResolvedOnTheSpot", anna],
    ]);
  });

  it("ST-052: Helpers' other problem reports still go to the triage list", async () => {
    await anExistingTeamMember(db, anna, "Anna");
    const machineId = await aRegisteredMachine(db);

    const reported = await executeCommand(
      reportProblemAndTriageCommand,
      { machineId, description: "Rubber on the left slingshot cracked" },
      { actor: anna, db, clock, newId: randomUUID },
    );

    if (!reported.ok) throw new Error(reported.error);
    expect((await storedProblemReport(db, reported.result.problemReportId))?.triage).toBeUndefined();
    expect((await triageList(db, clock)).map((entry) => entry.id)).toContain(reported.result.problemReportId);
    // A helper may add no other triage outcome: with a defect, neither the problem report nor the defect is stored.
    const journalBefore = (await journalOf(db, { machineId })).length;
    expect(
      await executeCommand(
        reportProblemAndTriageCommand,
        {
          machineId,
          description: "Left flipper coil stop broken",
          triage: {
            outcome: "defect-recorded",
            title: "Left flipper sticks",
            priority: undefined,
            suitableForHelpers: false,
            machineStatus: undefined,
            machineVersion: undefined,
          },
        },
        { actor: anna, db, clock, newId: randomUUID },
      ),
    ).toEqual({ ok: false, error: "not-authorized" });
    expect(await journalOf(db, { machineId })).toHaveLength(journalBefore);
  });

  it("ST-052: Technician reports and links in one step", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const machineId = await aRegisteredMachine(db);
    const defectId = await anOpenDefect(machineId, "Left flipper weak");

    const reported = await reportAndLink(machineId, "Left flipper weak again during test", defectId);

    if (!reported.ok) throw new Error(reported.error);
    const { problemReportId } = reported.result;
    expect(await storedProblemReport(db, problemReportId)).toMatchObject({
      description: "Left flipper weak again during test",
      reporter: { kind: "team-member", teamMemberId: tom.teamMemberId },
      triage: { outcome: "linked", triagedBy: tom.teamMemberId, defectId },
    });
    expect(reported.result.defectId).toBe(defectId);
    // No defect is created: the machine still has the one it had.
    expect(await openDefectTitles(db, machineId)).toEqual(["Left flipper weak"]);
    expect((await triageList(db, clock)).map((entry) => entry.id)).not.toContain(problemReportId);
    expect(
      (await journalOf(db, { machineId })).slice(-2).map((entry) => [entry.type, entry.actor, entry.data]),
    ).toEqual([
      ["EVT-ProblemReported", tom, {}],
      ["EVT-ProblemReportLinkedToDefect", tom, { defectId }],
    ]);
  });

  it("links only to a defect of the same machine, and only when one is chosen – else nothing is stored", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const machineId = await aRegisteredMachine(db);
    const defectElsewhere = await anOpenDefect(await aRegisteredMachine(db), "Tilt bob missing");
    const journalBefore = (await journalOf(db, { machineId })).length;

    expect(await reportAndLink(machineId, "Tilt does not trigger", defectElsewhere)).toEqual({
      ok: false,
      error: "defect-of-another-machine",
    });
    expect(await reportAndLink(machineId, "Tilt does not trigger", undefined)).toEqual({
      ok: false,
      error: "defect-required",
    });
    expect(await journalOf(db, { machineId })).toHaveLength(journalBefore);
  });
});

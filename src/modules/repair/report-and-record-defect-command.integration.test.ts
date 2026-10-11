import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { machineRecord } from "@/modules/collection";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { commandErrorText, teamMessages } from "@/platform/messages";
import {
  openDefectTitles,
  problemReportsOfMachine,
  reportProblemAndTriageCommand,
  reportProblemCommand,
  triageList,
} from ".";
import { storedDefect, storedProblemReport } from "./problem-report-stand-ins.test-support";

/**
 * CMD-ReportProblem by a technician (ST-023): the problem report is triaged in the same step – here with the outcome
 * *defect recorded*, optionally with a stricter machine status – and stored together with its triage or not at all.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-11T09:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

/** A technician reports and records a defect in the same step – no status change unless the test asks for one. */
function reportAndRecordDefect(
  machineId: string,
  description: string,
  title: string,
  status: { machineStatus?: "limited" | "out-of-order"; machineVersion?: number } = {},
) {
  return executeCommand(
    reportProblemAndTriageCommand,
    {
      machineId,
      description,
      triage: {
        outcome: "defect-recorded",
        title,
        priority: undefined,
        suitableForHelpers: false,
        machineStatus: status.machineStatus,
        machineVersion: status.machineVersion,
      },
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
}

describe("CMD-ReportProblem by a technician", () => {
  it("ST-023: Technician reports and records a defect in one step", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const machineId = await aRegisteredMachine(db, "playable");

    const reported = await executeCommand(
      reportProblemAndTriageCommand,
      {
        machineId,
        description: "Left flipper coil stop broken",
        triage: {
          outcome: "defect-recorded",
          title: "Left flipper sticks",
          priority: undefined,
          suitableForHelpers: false,
          machineStatus: "limited",
          machineVersion: 0,
        },
      },
      { actor: tom, db, clock, newId: randomUUID },
    );

    if (!reported.ok) throw new Error(reported.error);
    const { problemReportId, defectId } = reported.result;
    if (!defectId) throw new Error("no defect recorded");
    expect(await storedProblemReport(db, problemReportId)).toMatchObject({
      machineId,
      description: "Left flipper coil stop broken",
      reporter: { kind: "team-member", teamMemberId: tom.teamMemberId },
      triage: {
        outcome: "defect-recorded",
        triagedBy: tom.teamMemberId,
        triagedAt: new Date("2026-10-11T09:00:00Z"),
        defectId,
      },
    });
    expect(await storedDefect(db, defectId)).toMatchObject({
      machineId,
      problemReportId,
      title: "Left flipper sticks",
      priority: "normal",
      recordedBy: tom.teamMemberId,
      state: "open",
    });
    const record = await machineRecord(db, await museumNumberOf(machineId));
    expect(record?.machineStatus).toBe("limited");
    expect(record?.statusHistory[0]).toMatchObject({ newStatus: "limited", reason: "Left flipper sticks" });
    // Stored already triaged: it never appears in the triage list.
    expect((await triageList(db, clock)).map((entry) => entry.id)).not.toContain(problemReportId);
    // One action, three events – all by the same technician, in this order.
    expect((await journalOf(db, { machineId })).slice(-3).map((entry) => [entry.type, entry.actor])).toEqual([
      ["EVT-ProblemReported", tom],
      ["EVT-DefectRecorded", tom],
      ["EVT-MachineStatusChanged", tom],
    ]);
  });

  it("ST-023: A technician's problem report without a triage part is rejected", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const machineId = await aRegisteredMachine(db);
    const journalBefore = (await journalOf(db, { machineId })).length;

    const reported = await executeCommand(
      reportProblemCommand,
      { machineId, description: "Left flipper coil stop broken" },
      { actor: tom, db, clock, newId: randomUUID },
    );

    expect(reported).toEqual({ ok: false, error: "triage-required" });
    expect(await problemReportsOfMachine(db, machineId)).toEqual([]);
    expect(await journalOf(db, { machineId })).toHaveLength(journalBefore);
    expect(commandErrorText(teamMessages, "triage-required")).toBe(
      "Bitte wählen, wie die Meldung gesichtet wird. Es wurde nichts gespeichert.",
    );
  });

  it("ST-023: Two faults become two own problem reports", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const machineId = await aRegisteredMachine(db);

    const first = await reportAndRecordDefect(machineId, "Left flipper coil stop broken", "Left flipper sticks");
    const second = await reportAndRecordDefect(machineId, "Rubber on the right slingshot torn", "Right slingshot dead");

    if (!first.ok || !second.ok) throw new Error("not reported");
    const reports = await Promise.all(
      [first, second].map(({ result }) => storedProblemReport(db, result.problemReportId)),
    );
    expect(reports.map((report) => [report?.reporter, report?.triage?.outcome, report?.triage?.defectId])).toEqual([
      [{ kind: "team-member", teamMemberId: tom.teamMemberId }, "defect-recorded", first.result.defectId],
      [{ kind: "team-member", teamMemberId: tom.teamMemberId }, "defect-recorded", second.result.defectId],
    ]);
    expect(first.result.defectId).not.toBe(second.result.defectId);
    expect(await problemReportsOfMachine(db, machineId)).toHaveLength(2);
    expect((await openDefectTitles(db, machineId)).sort()).toEqual(["Left flipper sticks", "Right slingshot dead"]);
  });

  it("ST-023: A missing description is named before a missing title", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const machineId = await aRegisteredMachine(db);
    const journalBefore = (await journalOf(db, { machineId })).length;

    expect(await reportAndRecordDefect(machineId, "  ", "  ")).toEqual({ ok: false, error: "description-required" });
    // With a description the missing title is the reason – and still nothing is stored.
    expect(await reportAndRecordDefect(machineId, "Left flipper coil stop broken", "  ")).toEqual({
      ok: false,
      error: "title-required",
    });
    expect(await problemReportsOfMachine(db, machineId)).toEqual([]);
    expect(await openDefectTitles(db, machineId)).toEqual([]);
    expect(await journalOf(db, { machineId })).toHaveLength(journalBefore);
  });

  it("stores neither the problem report nor the defect when the status change in the same step is refused", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const outOfOrder = await aRegisteredMachine(db, "out-of-order");
    const changedMeanwhile = await aRegisteredMachine(db, "playable");
    const journalBefore = (await journalOf(db, { machineId: changedMeanwhile })).length;

    // Not stricter than the machine's status now – the decision refuses it.
    expect(
      await reportAndRecordDefect(outOfOrder, "Left flipper coil stop broken", "Left flipper sticks", {
        machineStatus: "limited",
        machineVersion: 0,
      }),
    ).toEqual({ ok: false, error: "machine-status-not-stricter" });
    // A version of the machine nobody saw – CMD-ChangeMachineStatus refuses it after the problem report was saved,
    // and the whole command is rolled back.
    expect(
      await reportAndRecordDefect(changedMeanwhile, "Left flipper coil stop broken", "Left flipper sticks", {
        machineStatus: "limited",
        machineVersion: 7,
      }),
    ).toEqual({ ok: false, error: "version-conflict" });

    for (const machineId of [outOfOrder, changedMeanwhile]) {
      expect(await problemReportsOfMachine(db, machineId)).toEqual([]);
      expect(await openDefectTitles(db, machineId)).toEqual([]);
    }
    expect(await journalOf(db, { machineId: changedMeanwhile })).toHaveLength(journalBefore);
    expect((await machineRecord(db, await museumNumberOf(changedMeanwhile)))?.machineStatus).toBe("playable");
  });
});

async function museumNumberOf(machineId: string) {
  const [registered] = await journalOf(db, { machineId });
  return registered.data.museumNumber as string;
}

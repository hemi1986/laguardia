import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { machineRecord } from "@/modules/collection";
import { retireMachineForTest } from "@/modules/collection/machines.test-support";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { recordDefectCommand, reportProblemCommand, triageList } from ".";
import { storedDefect, storedProblemReport } from "./problem-report-stand-ins.test-support";

/** CMD-RecordDefect (ST-018) through the command layer – handled by the problem report (HS-16). */
const db = testDatabase();
const clock = fixedClock("2026-10-03T19:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

async function anUntriagedProblemReport(machineId: string, description = "Left flipper barely moves") {
  const reported = await executeCommand(
    reportProblemCommand,
    { machineId, description },
    { actor: { kind: "visitor" }, db, clock, newId: randomUUID },
  );
  if (!reported.ok) throw new Error(reported.error);
  return reported.result.problemReportId;
}

function recordDefect(
  problemReportId: string,
  fields: {
    title: string;
    priority?: "high" | "normal" | "low";
    suitableForHelpers?: boolean;
    machineStatus?: "limited" | "out-of-order";
    machineVersion?: number;
  },
  actor: Actor = tom,
) {
  return executeCommand(
    recordDefectCommand,
    {
      problemReportId,
      version: 0,
      title: fields.title,
      priority: fields.priority,
      suitableForHelpers: fields.suitableForHelpers ?? false,
      machineStatus: fields.machineStatus,
      machineVersion: fields.machineVersion,
    },
    { actor, db, clock, newId: randomUUID },
  );
}

describe("CMD-RecordDefect", () => {
  it("ST-018: Technician records a defect", async () => {
    await anExistingTeamMember(db, tom);
    const machineId = await aRegisteredMachine(db);
    const problemReportId = await anUntriagedProblemReport(machineId);

    const recorded = await recordDefect(problemReportId, { title: "Left flipper weak" });

    if (!recorded.ok) throw new Error(recorded.error);
    const { defectId } = recorded.result;
    expect(await storedDefect(db, defectId)).toEqual({
      id: defectId,
      machineId,
      problemReportId,
      title: "Left flipper weak",
      priority: "normal",
      suitableForHelpers: false,
      recordedBy: tom.teamMemberId,
      recordedAt: new Date("2026-10-03T19:00:00Z"),
      state: "open",
    });
    expect((await storedProblemReport(db, problemReportId))?.triage).toEqual({
      outcome: "defect-recorded",
      triagedBy: tom.teamMemberId,
      triagedAt: new Date("2026-10-03T19:00:00Z"),
      defectId,
    });
    expect((await triageList(db, clock)).map((entry) => entry.id)).not.toContain(problemReportId);
    const [recordedEvent] = (await journalOf(db, { aggregateId: problemReportId })).slice(1);
    // No free text in the journal: the title lives only in the defect.
    expect(recordedEvent).toMatchObject({ type: "EVT-DefectRecorded", actor: tom, machineId });
    expect(recordedEvent.data).toEqual({ defectId, priority: "normal", suitableForHelpers: false });
  });

  it("ST-018: Machine status is changed in the same step", async () => {
    await anExistingTeamMember(db, tom);
    const machineId = await aRegisteredMachine(db);
    const museumNumber = await museumNumberOf(machineId);
    const problemReportId = await anUntriagedProblemReport(machineId);

    const recorded = await recordDefect(problemReportId, {
      title: "Coil burnt, ball not ejected",
      priority: "high",
      machineStatus: "out-of-order",
      machineVersion: 0,
    });

    if (!recorded.ok) throw new Error(recorded.error);
    expect((await storedDefect(db, recorded.result.defectId))?.priority).toBe("high");
    const record = await machineRecord(db, museumNumber);
    expect(record?.machineStatus).toBe("out-of-order");
    expect(record?.statusHistory[0]).toMatchObject({
      previousStatus: "playable",
      newStatus: "out-of-order",
      reason: "Coil burnt, ball not ejected",
      changedBy: tom.teamMemberId,
    });
    // Two events, one action – journaled with the same technician, in this order.
    expect((await journalOf(db, { machineId })).slice(-2).map((entry) => [entry.type, entry.actor])).toEqual([
      ["EVT-DefectRecorded", tom],
      ["EVT-MachineStatusChanged", tom],
    ]);
  });

  it("ST-018: Rejected status change rolls back the defect", async () => {
    await anExistingTeamMember(db, tom);
    const machineId = await aRegisteredMachine(db);
    const problemReportId = await anUntriagedProblemReport(machineId);
    const retired = await executeCommand(retireMachineForTest, { machineId, version: 0 }, { actor: tom, db, clock, newId: randomUUID });
    if (!retired.ok) throw new Error("not retired");
    const journalBefore = (await journalOf(db, { machineId })).length;

    const recorded = await recordDefect(problemReportId, {
      title: "Left flipper weak",
      machineStatus: "out-of-order",
      machineVersion: 1,
    });

    expect(recorded).toEqual({ ok: false, error: "machine-retired" });
    expect((await storedProblemReport(db, problemReportId))?.triage).toBeUndefined();
    expect(await journalOf(db, { machineId })).toHaveLength(journalBefore);
    expect((await machineRecord(db, await museumNumberOf(machineId)))?.statusHistory).toHaveLength(1);
    expect(commandErrorText(teamMessages, "machine-retired")).toContain("ausgemustert");
  });

  it("ST-018: Title is required", async () => {
    await anExistingTeamMember(db, tom);
    const machineId = await aRegisteredMachine(db);
    const problemReportId = await anUntriagedProblemReport(machineId);

    expect(await recordDefect(problemReportId, { title: "  " })).toEqual({ ok: false, error: "title-required" });
    expect((await storedProblemReport(db, problemReportId))?.triage).toBeUndefined();
    expect((await triageList(db, clock)).map((entry) => entry.id)).toContain(problemReportId);
  });

  it("refuses a status that is not stricter than the machine's – the form never offers one", async () => {
    await anExistingTeamMember(db, tom);
    const machineId = await aRegisteredMachine(db, "out-of-order");
    const problemReportId = await anUntriagedProblemReport(machineId);

    expect(
      await recordDefect(problemReportId, { title: "Left flipper weak", machineStatus: "limited", machineVersion: 0 }),
    ).toEqual({ ok: false, error: "machine-status-not-stricter" });
  });
});

async function museumNumberOf(machineId: string) {
  const [registered] = await journalOf(db, { machineId });
  return registered.data.museumNumber as string;
}

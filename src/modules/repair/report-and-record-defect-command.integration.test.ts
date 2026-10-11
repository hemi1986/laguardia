import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { machineRecord } from "@/modules/collection";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { reportProblemAndTriageCommand, triageList } from ".";
import { storedDefect, storedProblemReport } from "./problem-report-stand-ins.test-support";

/**
 * CMD-ReportProblem by a technician (ST-023): the problem report is triaged in the same step – here with the outcome
 * *defect recorded*, optionally with a stricter machine status – and stored together with its triage or not at all.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-11T09:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

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
});

async function museumNumberOf(machineId: string) {
  const [registered] = await journalOf(db, { machineId });
  return registered.data.museumNumber as string;
}

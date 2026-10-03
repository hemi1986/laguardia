import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
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
  fields: { title: string; priority?: "high" | "normal" | "low"; suitableForHelpers?: boolean },
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
      machineStatus: undefined,
      machineVersion: undefined,
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
});

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

function reportAndResolveOnTheSpot(machineId: string, description: string, note: string, actor: Actor = tom) {
  return executeCommand(
    reportProblemAndTriageCommand,
    { machineId, description, triage: { outcome: "resolved-on-the-spot", note } },
    { actor, db, clock, newId: randomUUID },
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
});

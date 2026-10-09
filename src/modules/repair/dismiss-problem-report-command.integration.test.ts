import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { dismissProblemReportCommand, reportProblemCommand, triageList, type DismissProblemReportInput } from ".";
import { storedProblemReport } from "./problem-report-stand-ins.test-support";

/** CMD-DismissProblemReport (ST-020) through the command layer – a triage outcome for technicians only. */
const db = testDatabase();
const clock = fixedClock("2026-10-09T10:00:00Z");
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

async function anUntriagedProblemReport(description = "Way too hard to score") {
  await anExistingTeamMember(db, eva, "Eva");
  const machineId = await aRegisteredMachine(db);
  const reported = await executeCommand(
    reportProblemCommand,
    { machineId, description },
    { actor: { kind: "visitor" }, db, clock, newId: randomUUID },
  );
  if (!reported.ok) throw new Error(reported.error);
  return { machineId, problemReportId: reported.result.problemReportId };
}

function dismiss(
  problemReportId: string,
  dismissal: Pick<DismissProblemReportInput, "reason" | "reasonText">,
  actor: Actor = eva,
) {
  return executeCommand(
    dismissProblemReportCommand,
    { problemReportId, version: 0, ...dismissal },
    { actor, db, clock, newId: randomUUID },
  );
}

async function untriagedIds() {
  return (await triageList(db, clock)).map((listed) => listed.id);
}

describe("CMD-DismissProblemReport", () => {
  it("ST-020: Technician dismisses a problem report", async () => {
    const { machineId, problemReportId } = await anUntriagedProblemReport();

    const dismissed = await dismiss(problemReportId, { reason: "not-a-fault", reasonText: "" });

    expect(dismissed).toEqual({ ok: true, result: { problemReportId, removedPhoto: undefined } });
    expect(await storedProblemReport(db, problemReportId)).toMatchObject({
      description: "Way too hard to score",
      triage: {
        outcome: "dismissed",
        triagedBy: eva.teamMemberId,
        triagedAt: new Date("2026-10-09T10:00:00Z"),
        dismissal: { reason: "not-a-fault" },
      },
    });
    const [entry] = (await journalOf(db, { aggregateId: problemReportId })).slice(-1);
    expect(entry).toMatchObject({
      type: "EVT-ProblemReportDismissed",
      machineId,
      actor: { kind: "team-member", teamMemberId: eva.teamMemberId, role: "technician" },
      data: { reason: "not-a-fault" },
    });
    expect(await untriagedIds()).not.toContain(problemReportId);
  });
});

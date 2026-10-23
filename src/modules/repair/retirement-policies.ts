import { and, eq, isNull } from "drizzle-orm";
import { retireMachineCommandWithoutPolicies } from "@/modules/collection";
import { policy, trigger, withPolicies, type Actor, type Database } from "@/platform/command";
import { closeDefectOnRetirementCommand } from "./close-defect-on-retirement-command";
import { dismissProblemReportOnRetirementCommand } from "./dismiss-problem-report-command";
import { defect, problemReport } from "./schema";

/**
 * Repair's reaction to EVT-MachineRetired (ST-039, ADR 0010): Collection's CMD-RetireMachine with Repair's two
 * automatic policies added. Each selects what it acts on `FOR UPDATE`, filtered by the state it acts on – a defect
 * resolved or a problem report triaged a moment earlier is skipped – and changes each through its own command.
 */
type Retired = { result: { machineId: string }; actor: Actor };

/** POL-RetirementClosesDefects: every defect of the machine that is not resolved is closed on retirement. */
const retirementClosesDefects = policy({
  id: "POL-RetirementClosesDefects",
  calls: async (tx: Database, { result }: Retired) => {
    const rows = await tx
      .select({ id: defect.id })
      .from(defect)
      .where(and(eq(defect.machineId, result.machineId), eq(defect.state, "open")))
      .for("update");
    return rows.map((row) => trigger(closeDefectOnRetirementCommand, { defectId: row.id }));
  },
});

/** POL-RetirementDismissesProblemReports: every untriaged problem report of the machine is dismissed. */
const retirementDismissesProblemReports = policy({
  id: "POL-RetirementDismissesProblemReports",
  calls: async (tx: Database, { result, actor }: Retired) => {
    if (actor.kind !== "team-member") throw new Error("a machine is retired by a technician");
    const retiredBy = actor.teamMemberId;
    const rows = await tx
      .select({ id: problemReport.id })
      .from(problemReport)
      .where(and(eq(problemReport.machineId, result.machineId), isNull(problemReport.triageOutcome)))
      .for("update");
    return rows.map((row) => trigger(dismissProblemReportOnRetirementCommand, { problemReportId: row.id, retiredBy }));
  },
});

/** CMD-RetireMachine as the retire page runs it – Collection's command with Repair's retirement policies. */
export const retireMachineCommand = withPolicies(retireMachineCommandWithoutPolicies, [
  retirementClosesDefects,
  retirementDismissesProblemReports,
]);

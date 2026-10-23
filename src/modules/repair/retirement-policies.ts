import { and, eq, isNull, sql } from "drizzle-orm";
import { retireMachineCommandWithoutPolicies } from "@/modules/collection";
import { policy, trigger, withPolicies, type Actor, type Database, type JournalEvent } from "@/platform/command";
import { closeDefectOnRetirementCommand } from "./close-defect-on-retirement-command";
import { dismissProblemReportOnRetirementCommand } from "./dismiss-problem-report-command";
import { defect, problemReport } from "./schema";

/**
 * Repair's reaction to EVT-MachineRetired (ST-039, ADR 0010): Collection's CMD-RetireMachine with Repair's two
 * automatic policies added. Each selects what it acts on `FOR UPDATE`, filtered by the state it acts on – a defect
 * resolved or a problem report triaged a moment earlier is skipped – and changes each through its own command.
 */

/** What a retirement acts on: the machine's defects that are not resolved, and its untriaged problem reports. */
const toClose = (machineId: string) => and(eq(defect.machineId, machineId), eq(defect.state, "open"));
const toDismiss = (machineId: string) =>
  and(eq(problemReport.machineId, machineId), isNull(problemReport.triageOutcome));

/** The machine an EVT-MachineRetired of the triggering command names, with who retired it (its journal actor). */
function retired(events: readonly JournalEvent[], actor: Actor) {
  const event = events.find((journaled) => journaled.type === "EVT-MachineRetired");
  if (!event || actor.kind !== "team-member") return undefined;
  return { machineId: event.aggregate.id, retiredBy: actor.teamMemberId };
}

/** POL-RetirementClosesDefects: every defect of the machine that is not resolved is closed on retirement. */
const retirementClosesDefects = policy({
  id: "POL-RetirementClosesDefects",
  calls: async (tx, { events, actor }) => {
    const machine = retired(events, actor);
    if (!machine) return [];
    const rows = await tx.select({ id: defect.id }).from(defect).where(toClose(machine.machineId)).for("update");
    return rows.map((row) => trigger(closeDefectOnRetirementCommand, { defectId: row.id }));
  },
});

/**
 * POL-RetirementDismissesProblemReports: every untriaged problem report of the machine is dismissed – *dismissed by*
 * the technician who retired the machine (data model, Triage).
 */
const retirementDismissesProblemReports = policy({
  id: "POL-RetirementDismissesProblemReports",
  calls: async (tx, { events, actor }) => {
    const machine = retired(events, actor);
    if (!machine) return [];
    const rows = await tx
      .select({ id: problemReport.id })
      .from(problemReport)
      .where(toDismiss(machine.machineId))
      .for("update");
    return rows.map((row) =>
      trigger(dismissProblemReportOnRetirementCommand, { problemReportId: row.id, retiredBy: machine.retiredBy }),
    );
  },
});

/**
 * What retiring the machine now would close and dismiss – the question before it names both (G10, ST-039). The same
 * selections as the two policies, so the question says what they will do.
 */
export async function retirementConsequences(
  db: Database,
  machineId: string,
): Promise<{ openDefects: number; problemReports: number }> {
  const count = sql<number>`count(*)::int`;
  const [[defects], [reports]] = await Promise.all([
    db.select({ count }).from(defect).where(toClose(machineId)),
    db.select({ count }).from(problemReport).where(toDismiss(machineId)),
  ]);
  return { openDefects: defects.count, problemReports: reports.count };
}

/** CMD-RetireMachine as the retire page runs it – Collection's command with Repair's retirement policies. */
export const retireMachineCommand = withPolicies(retireMachineCommandWithoutPolicies, [
  retirementClosesDefects,
  retirementDismissesProblemReports,
]);

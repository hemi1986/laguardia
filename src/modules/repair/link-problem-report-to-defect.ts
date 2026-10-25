import type { MachineStatus } from "@/modules/collection";
import type { ActorOf, Decision, DecisionContext } from "@/platform/command";
import { calendarDate, daysBetween } from "@/platform/time";
import type { DefectState } from "./defect";
import type { ProblemReport } from "./report-problem";

/**
 * CMD-LinkProblemReportToDefect (AGG-ProblemReport, ST-022): a technician links an untriaged problem report to an open
 * defect of the same machine – a duplicate report becomes evidence for the known defect instead of a second one. A
 * recently resolved defect can be linked too, which reopens it (POL-LinkReopensResolvedDefect, ST-053): the command runs
 * CMD-ReopenDefect with the problem report as its reason, and the technician may set a stricter machine status then.
 */

/** Who may link a problem report to a defect – technicians only. */
export const linkingActors = ["technician"] as const;

type LinkingPerson = ActorOf<(typeof linkingActors)[number]>;

export type LinkProblemReportToDefectInput = {
  problemReportId: string;
  /** The version of the problem report the technician saw (HS-16). */
  version: number;
  /** No defect chosen: undefined. */
  defectId: string | undefined;
  /**
   * The chosen defect was offered as recently resolved: the version of it the technician saw – linking reopens it
   * (ST-053). None when it was offered as open: a defect resolved since then is not linked (ST-022).
   */
  resolvedDefectVersion?: number;
  /** A stricter machine status chosen in the same step – only when linking reopens the defect (ST-053). */
  machineStatus?: MachineStatus;
  /** The version of the machine the technician saw – needed with a chosen status (HS-16). */
  machineVersion?: number;
};

/** The chosen defect as it is stored now – none for no or an unknown defect. */
export type LinkingFacts = {
  defect:
    { id: string; machineId: string; state: DefectState; /** Its latest resolution. */ resolvedAt?: Date } | undefined;
};

/** "Recently resolved" – resolved within the last 30 days, in Europe/Berlin calendar days (ST-053, ST-003). */
const RECENTLY_RESOLVED_DAYS = 30;

/** How many calendar days ago a defect was resolved – 0 today (ST-053: „behoben vor 3 Tagen“). */
export function daysSinceResolved(resolvedAt: Date, now: Date): number {
  return daysBetween(calendarDate(resolvedAt), calendarDate(now));
}

/** Whether a defect resolved then is recently resolved now – the ones linking offers and accepts (ST-053). */
export function resolvedRecently(resolvedAt: Date, now: Date): boolean {
  return daysSinceResolved(resolvedAt, now) <= RECENTLY_RESOLVED_DAYS;
}

export type ProblemReportLinkedToDefect = {
  type: "EVT-ProblemReportLinkedToDefect";
  problemReportId: string;
  machineId: string;
  defectId: string;
};

export type LinkProblemReportToDefectError =
  | "already-triaged"
  | "defect-required"
  | "defect-of-another-machine"
  | "defect-not-open"
  | "defect-resolved-too-long-ago"
  | "machine-status-without-reopening";

export function linkProblemReportToDefect(
  report: ProblemReport,
  input: LinkProblemReportToDefectInput,
  { actor, clock }: DecisionContext<LinkingPerson>,
  { defect }: LinkingFacts,
): Decision<ProblemReport, ProblemReportLinkedToDefect, LinkProblemReportToDefectError> {
  if (report.triage) return { ok: false, error: "already-triaged" };
  if (!defect) return { ok: false, error: "defect-required" };
  if (defect.machineId !== report.machineId) return { ok: false, error: "defect-of-another-machine" };
  const reopens = input.resolvedDefectVersion !== undefined;
  // One closed on retirement is final; one resolved since the technician saw it open is not linked (ST-022).
  if (defect.state === "closed-on-retirement" || (defect.state === "resolved" && !reopens))
    return { ok: false, error: "defect-not-open" };
  if (defect.state === "resolved" && !(defect.resolvedAt && resolvedRecently(defect.resolvedAt, clock.now())))
    return { ok: false, error: "defect-resolved-too-long-ago" };
  // The machine status changes in this step only with a reopened defect (POL-DefectMayChangeMachineStatus; user,
  // 2026-10-25) – never silently ignored.
  if (input.machineStatus && !reopens) return { ok: false, error: "machine-status-without-reopening" };
  return {
    ok: true,
    state: {
      ...report,
      triage: { outcome: "linked", triagedBy: actor.teamMemberId, triagedAt: clock.now(), defectId: defect.id },
    },
    events: [
      {
        type: "EVT-ProblemReportLinkedToDefect",
        problemReportId: report.id,
        machineId: report.machineId,
        defectId: defect.id,
      },
    ],
  };
}

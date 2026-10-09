import type { ActorOf, Decision, DecisionContext } from "@/platform/command";
import type { DefectState } from "./defect";
import type { ProblemReport } from "./report-problem";

/**
 * CMD-LinkProblemReportToDefect (AGG-ProblemReport, ST-022): a technician links an untriaged problem report to an open
 * defect of the same machine – a duplicate report becomes evidence for the known defect instead of a second one. Linking
 * to a resolved defect is rejected until ST-053 reopens it (POL-LinkReopensResolvedDefect).
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
};

/** The chosen defect as it is stored now – none for no or an unknown defect. */
export type LinkingFacts = { defect: { id: string; machineId: string; state: DefectState } | undefined };

export type ProblemReportLinkedToDefect = {
  type: "EVT-ProblemReportLinkedToDefect";
  problemReportId: string;
  machineId: string;
  defectId: string;
};

export type LinkProblemReportToDefectError =
  "already-triaged" | "defect-required" | "defect-of-another-machine" | "defect-not-open";

export function linkProblemReportToDefect(
  report: ProblemReport,
  _input: LinkProblemReportToDefectInput,
  { actor, clock }: DecisionContext<LinkingPerson>,
  { defect }: LinkingFacts,
): Decision<ProblemReport, ProblemReportLinkedToDefect, LinkProblemReportToDefectError> {
  if (report.triage) return { ok: false, error: "already-triaged" };
  if (!defect) return { ok: false, error: "defect-required" };
  if (defect.machineId !== report.machineId) return { ok: false, error: "defect-of-another-machine" };
  if (defect.state !== "open") return { ok: false, error: "defect-not-open" };
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

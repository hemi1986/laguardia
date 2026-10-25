import { holdAgainstRetirement } from "@/modules/collection";
import { aggregateCommand, run } from "@/platform/command";
import { linkingFacts } from "./defects";
import {
  linkingActors,
  linkProblemReportToDefect,
  type LinkProblemReportToDefectInput,
} from "./link-problem-report-to-defect";
import { problemReports } from "./problem-reports";
import { repairEvents } from "./events";
import { reopenDefectCommand } from "./reopen-defect-command";

/**
 * POL-LinkReopensResolvedDefect (ST-053): the reopening a link runs when the technician chose a defect offered as
 * recently resolved – CMD-ReopenDefect at the version they saw, the problem report as the reason, with a stricter
 * machine status if one was chosen (POL-DefectMayChangeMachineStatus). None for a defect offered as open. Shared with
 * CMD-ReportProblem (ST-052).
 *
 * An automatic policy that runs as the person, not as the system (`runs`, not `runAsSystem`): the reopening records
 * who reopened it, needs the version that person saw, and the status change is that technician's decision
 * (engineering conventions, *Automatic policies*).
 */
export function reopeningByLink(
  problemReportId: string,
  defectId: string,
  chosen: Pick<LinkProblemReportToDefectInput, "resolvedDefectVersion" | "machineStatus" | "machineVersion">,
) {
  if (chosen.resolvedDefectVersion === undefined) return [];
  return [
    run(reopenDefectCommand, {
      defectId,
      version: chosen.resolvedDefectVersion,
      problemReportId,
      machineStatus: chosen.machineStatus,
      machineVersion: chosen.machineVersion,
    }),
  ];
}

/**
 * CMD-LinkProblemReportToDefect through the command layer: a change of AGG-ProblemReport at the version the technician
 * saw (HS-16) – a concurrent triage is rejected as "already triaged" – emits EVT-ProblemReportLinkedToDefect. Its facts
 * are the chosen defect as stored now; the defect itself is not changed. Before the defect's row lock it takes the
 * machine's retirement lock from Collection (ADR 0010) – linking to a resolved defect reopens it, and the lock order is
 * the same as the retirement's: the advisory lock first, then the defect.
 * Linking to a recently resolved defect reopens it (POL-LinkReopensResolvedDefect, `reopeningByLink`); a rejection of
 * the reopening rejects the link: nothing is stored.
 */
export const linkProblemReportToDefectCommand = aggregateCommand({
  id: "CMD-LinkProblemReportToDefect",
  allowedActors: linkingActors,
  store: problemReports,
  target: (input) => ({ id: input.problemReportId, version: input.version }),
  facts: async (tx, input, report) => {
    await holdAgainstRetirement(tx, report.machineId);
    return linkingFacts(tx, input);
  },
  decide: linkProblemReportToDefect,
  journal: repairEvents.journal,
  runs: (report, events, input) => events.flatMap((event) => reopeningByLink(report.id, event.defectId, input)),
  result: (report) => ({ problemReportId: report.id, defectId: report.triage?.defectId ?? "" }),
});

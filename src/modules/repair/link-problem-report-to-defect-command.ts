import { aggregateCommand } from "@/platform/command";
import { linkingFacts } from "./defects";
import { linkingActors, linkProblemReportToDefect } from "./link-problem-report-to-defect";
import { problemReports } from "./problem-reports";
import { repairEvents } from "./events";

/**
 * CMD-LinkProblemReportToDefect through the command layer: a change of AGG-ProblemReport at the version the technician
 * saw (HS-16) – a concurrent triage is rejected as "already triaged" – emits EVT-ProblemReportLinkedToDefect. Its facts
 * are the chosen defect as stored now; the defect itself is not changed.
 */
export const linkProblemReportToDefectCommand = aggregateCommand({
  id: "CMD-LinkProblemReportToDefect",
  allowedActors: linkingActors,
  store: problemReports,
  target: (input) => ({ id: input.problemReportId, version: input.version }),
  facts: (tx, input) => linkingFacts(tx, input),
  decide: linkProblemReportToDefect,
  journal: repairEvents.journal,
  result: (report) => ({ problemReportId: report.id, defectId: report.triage?.defectId ?? "" }),
});

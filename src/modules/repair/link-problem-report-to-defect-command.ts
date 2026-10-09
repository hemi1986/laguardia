import { aggregateCommand } from "@/platform/command";
import { linkingFacts } from "./defects";
import { linkingActors, linkProblemReportToDefect } from "./link-problem-report-to-defect";
import { problemReports } from "./problem-reports";

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
  journal: (event) => ({
    type: event.type,
    aggregate: { type: "AGG-ProblemReport", id: event.problemReportId },
    machineId: event.machineId,
    data: { defectId: event.defectId },
  }),
  result: (report) => ({ problemReportId: report.id, defectId: report.triage?.defectId ?? "" }),
});

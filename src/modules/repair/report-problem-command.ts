import { aggregateCommand } from "@/platform/command";
import { problemReports, reportingFacts } from "./problem-reports";
import { reportProblem, reportingActors } from "./report-problem";

/** CMD-ReportProblem through the command layer: a creating command on AGG-ProblemReport, emits EVT-ProblemReported. */
export const reportProblemCommand = aggregateCommand({
  id: "CMD-ReportProblem",
  allowedActors: reportingActors,
  store: problemReports,
  creates: true,
  facts: reportingFacts,
  decide: reportProblem,
  journal: (event) => ({
    type: event.type,
    aggregate: { type: "AGG-ProblemReport", id: event.problemReportId },
    machineId: event.machineId,
    data: {}, // the reporter is the journal's actor; the description stays in the problem report only
  }),
  result: (report) => ({ problemReportId: report.id }),
});

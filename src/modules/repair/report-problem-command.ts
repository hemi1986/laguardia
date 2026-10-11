import { aggregateCommand, type Command } from "@/platform/command";
import { linkingFacts } from "./defects";
import { journalProblemReportLinked } from "./link-problem-report-to-defect-command";
import { problemReports, reportingFacts } from "./problem-reports";
import { journalDefectRecorded, statusChangeWithDefect } from "./record-defect-command";
import { reportingActors, type ReportProblemError, type ReportProblemInput } from "./report-problem";
import { reportProblemAndTriage, type TriageRequired } from "./report-problem-and-triage";
import { journalProblemResolvedOnTheSpot } from "./resolve-problem-on-the-spot-command";

/**
 * CMD-ReportProblem through the command layer: a creating command on AGG-ProblemReport, emits EVT-ProblemReported –
 * and the event of the triage outcome chosen in the same step (ST-023, ST-052): EVT-DefectRecorded with the new defect,
 * EVT-ProblemReportLinkedToDefect or EVT-ProblemResolvedOnTheSpot. A stricter
 * machine status in that step runs Collection's CMD-ChangeMachineStatus as the same technician, in the same
 * transaction, as CMD-RecordDefect does (HS-3) – its rejection rejects the problem report too.
 */
export const reportProblemAndTriageCommand = aggregateCommand({
  id: "CMD-ReportProblem",
  allowedActors: reportingActors,
  store: problemReports,
  creates: true,
  // The machine as Collection knows it now and – for the outcome *linked* – the chosen defect, locked until the commit
  // so a concurrent resolution waits (ST-022).
  facts: async (tx, input) => ({
    ...(await reportingFacts(tx, input)),
    ...(await linkingFacts(tx, { defectId: input.triage?.outcome === "linked" ? input.triage.defectId : undefined })),
  }),
  decide: reportProblemAndTriage,
  journal: (event) => {
    switch (event.type) {
      case "EVT-ProblemReported":
        return {
          type: event.type,
          aggregate: { type: "AGG-ProblemReport", id: event.problemReportId },
          machineId: event.machineId,
          data: {}, // the reporter is the journal's actor; the description stays in the problem report only
        };
      case "EVT-DefectRecorded":
        return journalDefectRecorded(event);
      case "EVT-ProblemResolvedOnTheSpot":
        return journalProblemResolvedOnTheSpot(event);
      case "EVT-ProblemReportLinkedToDefect":
        return journalProblemReportLinked(event);
    }
  },
  runs: (_report, events, input) =>
    events.flatMap((event) =>
      event.type === "EVT-DefectRecorded" && input.triage?.outcome === "defect-recorded"
        ? statusChangeWithDefect(event, input.triage)
        : [],
    ),
  result: (report) => ({ problemReportId: report.id, defectId: report.triage?.defectId }),
});

/**
 * CMD-ReportProblem as a form without a triage part sends it (visitors, helpers) – the same command, typed by what
 * such a form can give and get back: without a triage part none of the triage outcome's rejections can occur, so a
 * visitor page needs no texts for them – only for the technician who sends such a form anyway.
 */
export const reportProblemCommand = reportProblemAndTriageCommand as Command<
  ReportProblemInput,
  { problemReportId: string },
  ReportProblemError | TriageRequired
>;

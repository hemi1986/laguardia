import { aggregateCommand, type Command } from "@/platform/command";
import { problemReports, reportingFacts } from "./problem-reports";
import { journalDefectRecorded, statusChangeWithDefect } from "./record-defect-command";
import { reportingActors, type ReportProblemError, type ReportProblemInput } from "./report-problem";
import { reportProblemAndTriage, type TriageRequired } from "./report-problem-and-triage";

/**
 * CMD-ReportProblem through the command layer: a creating command on AGG-ProblemReport, emits EVT-ProblemReported –
 * and, when a technician triages it in the same step (ST-023), EVT-DefectRecorded with the new defect. A stricter
 * machine status in that step runs Collection's CMD-ChangeMachineStatus as the same technician, in the same
 * transaction, as CMD-RecordDefect does (HS-3) – its rejection rejects the problem report too.
 */
export const reportProblemAndTriageCommand = aggregateCommand({
  id: "CMD-ReportProblem",
  allowedActors: reportingActors,
  store: problemReports,
  creates: true,
  facts: reportingFacts,
  decide: reportProblemAndTriage,
  journal: (event) =>
    event.type === "EVT-ProblemReported"
      ? {
          type: event.type,
          aggregate: { type: "AGG-ProblemReport", id: event.problemReportId },
          machineId: event.machineId,
          data: {}, // the reporter is the journal's actor; the description stays in the problem report only
        }
      : journalDefectRecorded(event),
  runs: (_report, events, input) =>
    events.flatMap((event) =>
      event.type === "EVT-DefectRecorded" && input.triage ? statusChangeWithDefect(event, input.triage) : [],
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

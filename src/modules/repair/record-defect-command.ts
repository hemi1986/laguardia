import { changeMachineStatusCommand } from "@/modules/collection";
import { aggregateCommand, run } from "@/platform/command";
import { problemReports, reportingFacts } from "./problem-reports";
import { recordDefect, recordingActors, type DefectRecorded, type RecordDefectInput } from "./record-defect";

/**
 * CMD-RecordDefect through the command layer: a change of AGG-ProblemReport at the version the technician saw that
 * creates the defect (HS-16), emits EVT-DefectRecorded. Its facts are the machine as Collection knows it now; a status
 * change in the same step runs Collection's CMD-ChangeMachineStatus as the same technician, in the same transaction
 * (`context.run`, HS-3) – its rejection rejects the defect too. The status history's reason is the defect's title.
 */
const NO_VERSION_SEEN = -1;

/**
 * EVT-DefectRecorded in the journal – for every command that records a defect (CMD-RecordDefect, and CMD-ReportProblem
 * with that triage outcome in the same step, ST-023). References and non-personal facts only: the title is typed text
 * and lives in the defect (ST-003).
 */
export function journalDefectRecorded(event: DefectRecorded) {
  return {
    type: event.type,
    aggregate: { type: "AGG-ProblemReport", id: event.problemReportId },
    machineId: event.machineId,
    data: { defectId: event.defectId, priority: event.priority, suitableForHelpers: event.suitableForHelpers },
  } as const;
}

/**
 * The stricter machine status chosen in the same step as recording a defect (HS-3): Collection's
 * CMD-ChangeMachineStatus, run as the same technician in the same transaction – none when the status stays. The
 * status history's reason is the defect's title. Without the version the technician saw, a chosen status ends as a
 * conflict – it is never skipped.
 */
export function statusChangeWithDefect(
  event: DefectRecorded,
  chosen: Pick<RecordDefectInput, "machineStatus" | "machineVersion">,
) {
  if (!chosen.machineStatus) return [];
  return [
    run(changeMachineStatusCommand, {
      machineId: event.machineId,
      version: chosen.machineVersion ?? NO_VERSION_SEEN,
      machineStatus: chosen.machineStatus,
      reason: event.title,
    }),
  ];
}

export const recordDefectCommand = aggregateCommand({
  id: "CMD-RecordDefect",
  allowedActors: recordingActors,
  store: problemReports,
  target: (input) => ({ id: input.problemReportId, version: input.version }),
  facts: (tx, _input, report) => reportingFacts(tx, report),
  decide: recordDefect,
  journal: journalDefectRecorded,
  runs: (_report, events, input) => events.flatMap((event) => statusChangeWithDefect(event, input)),
  result: (report) => ({ defectId: report.triage?.defectId ?? "" }),
});

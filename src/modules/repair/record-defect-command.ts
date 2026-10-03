import { changeMachineStatusCommand } from "@/modules/collection";
import { aggregateCommand, run } from "@/platform/command";
import { problemReports, reportingFacts } from "./problem-reports";
import { recordDefect, recordingActors } from "./record-defect";

/**
 * CMD-RecordDefect through the command layer: a change of AGG-ProblemReport at the version the technician saw that
 * creates the defect (HS-16), emits EVT-DefectRecorded. Its facts are the machine as Collection knows it now; a status
 * change in the same step runs Collection's CMD-ChangeMachineStatus as the same technician, in the same transaction
 * (`context.run`, HS-3) – its rejection rejects the defect too. The status history's reason is the defect's title.
 */
const NO_VERSION_SEEN = -1;

export const recordDefectCommand = aggregateCommand({
  id: "CMD-RecordDefect",
  allowedActors: recordingActors,
  store: problemReports,
  target: (input) => ({ id: input.problemReportId, version: input.version }),
  facts: (tx, _input, report) => reportingFacts(tx, report),
  decide: recordDefect,
  journal: (event) => ({
    type: event.type,
    aggregate: { type: "AGG-ProblemReport", id: event.problemReportId },
    machineId: event.machineId,
    // References and non-personal facts only: the title is typed text and lives in the defect (ST-003).
    data: { defectId: event.defectId, priority: event.priority, suitableForHelpers: event.suitableForHelpers },
  }),
  runs: (report, events, input) =>
    input.machineStatus
      ? events.map((event) =>
          run(changeMachineStatusCommand, {
            machineId: report.machineId,
            // Without the version the technician saw, a chosen status ends as a conflict – it is never skipped.
            version: input.machineVersion ?? NO_VERSION_SEEN,
            machineStatus: input.machineStatus,
            reason: event.title,
          }),
        )
      : [],
  result: (report) => ({ defectId: report.triage?.defectId ?? "" }),
});

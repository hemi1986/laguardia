import { changeMachineStatusCommand, machineForReporting } from "@/modules/collection";
import { aggregateCommand, run } from "@/platform/command";
import { defects } from "./defects";
import { repairEvents } from "./events";
import { reopenDefect, reopeningActors, type DefectReopened, type ReopenDefectInput } from "./reopen-defect";

const NO_VERSION_SEEN = -1;

/**
 * The stricter machine status chosen in the same step as reopening (POL-DefectMayChangeMachineStatus, as in ST-018):
 * Collection's CMD-ChangeMachineStatus, run as the same technician in the same transaction – none when the status
 * stays. The status history's reason is the defect's title.
 */
function statusChangeWithReopening(event: DefectReopened, chosen: Pick<ReopenDefectInput, "machineStatus" | "machineVersion">) {
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

/**
 * CMD-ReopenDefect through the command layer: a change of AGG-Defect at the version the team member saw (ST-003),
 * emits EVT-DefectReopened. Its facts are the machine as Collection knows it now (read without a lock, context map); a
 * status change in the same step runs Collection's CMD-ChangeMachineStatus (`context.run`, HS-3).
 */
export const reopenDefectCommand = aggregateCommand({
  id: "CMD-ReopenDefect",
  allowedActors: reopeningActors,
  store: defects,
  target: (input) => ({ id: input.defectId, version: input.version }),
  facts: async (tx, _input, defect) => ({ machine: await machineForReporting(tx, defect.machineId) }),
  decide: reopenDefect,
  journal: repairEvents.journal,
  runs: (_defect, events, input) => events.flatMap((event) => statusChangeWithReopening(event, input)),
  result: (defect) => ({ defectId: defect.id }),
});

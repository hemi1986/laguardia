import { machineForReporting } from "@/modules/collection";
import { aggregateCommand } from "@/platform/command";
import { defects } from "./defects";
import { repairEvents } from "./events";
import { statusChangeWithDefect } from "./record-defect-command";
import { reopenDefect, reopeningActors } from "./reopen-defect";

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
  runs: (_defect, events, input) => events.flatMap((event) => statusChangeWithDefect(event, input)),
  result: (defect) => ({ defectId: defect.id }),
});

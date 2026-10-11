import { aggregateCommand } from "@/platform/command";
import { defects } from "./defects";
import { logWork, loggingActors, type WorkLogged } from "./log-work";

/** EVT-WorkLogged in the journal: references only – what was done and the parts used are free text of the aggregate. */
function journalWorkLogged(event: WorkLogged) {
  return {
    type: event.type,
    aggregate: { type: "AGG-Defect", id: event.defectId },
    machineId: event.machineId,
    data: { workLogEntryId: event.workLogEntryId, loggedBy: event.loggedBy },
  } as const;
}

/**
 * CMD-LogWork through the command layer: a change of AGG-Defect at the version the team member saw (ST-003), emits
 * EVT-WorkLogged.
 */
export const logWorkCommand = aggregateCommand({
  id: "CMD-LogWork",
  allowedActors: loggingActors,
  store: defects,
  target: (input) => ({ id: input.defectId, version: input.version }),
  decide: logWork,
  journal: journalWorkLogged,
  result: (defect) => ({ defectId: defect.id }),
});

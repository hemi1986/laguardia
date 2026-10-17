import { aggregateCommand } from "@/platform/command";
import { defects } from "./defects";
import { logWork, loggingActors } from "./log-work";
import { repairEvents } from "./events";

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
  journal: repairEvents.journal,
  result: (defect) => ({ defectId: defect.id }),
});

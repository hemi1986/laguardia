import { aggregateCommand } from "@/platform/command";
import { defects } from "./defects";
import { repairEvents } from "./events";
import { holdingActors, putDefectOnHold } from "./put-defect-on-hold";

/**
 * CMD-PutDefectOnHold through the command layer: a change of AGG-Defect at the version the team member saw (ST-003),
 * emits EVT-DefectPutOnHold.
 */
export const putDefectOnHoldCommand = aggregateCommand({
  id: "CMD-PutDefectOnHold",
  allowedActors: holdingActors,
  store: defects,
  target: (input) => ({ id: input.defectId, version: input.version }),
  decide: putDefectOnHold,
  journal: repairEvents.journal,
  result: (defect) => ({ defectId: defect.id }),
});

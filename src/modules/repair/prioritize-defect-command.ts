import { aggregateCommand } from "@/platform/command";
import { defects } from "./defects";
import { prioritizeDefect, prioritizingActors } from "./prioritize-defect";

/**
 * CMD-PrioritizeDefect through the command layer: a change of AGG-Defect at the version the technician saw, emits
 * EVT-DefectPrioritized. The new priority is a non-personal fact and goes into the journal; who prioritized it is the
 * acting person of the journal entry.
 */
export const prioritizeDefectCommand = aggregateCommand({
  id: "CMD-PrioritizeDefect",
  allowedActors: prioritizingActors,
  store: defects,
  target: (input) => ({ id: input.defectId, version: input.version }),
  decide: prioritizeDefect,
  journal: (event) => ({
    type: event.type,
    aggregate: { type: "AGG-Defect", id: event.defectId },
    machineId: event.machineId,
    data: { priority: event.priority },
  }),
  result: (defect) => ({ defectId: defect.id }),
});

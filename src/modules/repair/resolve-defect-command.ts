import { aggregateCommand } from "@/platform/command";
import { defects } from "./defects";
import { resolveDefect, resolvingActors } from "./resolve-defect";
import { repairEvents } from "./events";

/**
 * CMD-ResolveDefect through the command layer: a change of AGG-Defect at the version the team member saw (ST-003),
 * emits EVT-DefectResolved.
 */
export const resolveDefectCommand = aggregateCommand({
  id: "CMD-ResolveDefect",
  allowedActors: resolvingActors,
  store: defects,
  target: (input) => ({ id: input.defectId, version: input.version }),
  decide: resolveDefect,
  journal: repairEvents.journal,
  result: (defect) => ({ defectId: defect.id }),
});

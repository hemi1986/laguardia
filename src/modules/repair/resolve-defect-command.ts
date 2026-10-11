import { aggregateCommand } from "@/platform/command";
import { defects } from "./defects";
import { resolveDefect, resolvingActors, type DefectResolved } from "./resolve-defect";

/** EVT-DefectResolved in the journal: references only – the closing note is free text and stays in the aggregate. */
function journalDefectResolved(event: DefectResolved) {
  return {
    type: event.type,
    aggregate: { type: "AGG-Defect", id: event.defectId },
    machineId: event.machineId,
    data: { resolvedBy: event.resolvedBy },
  } as const;
}

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
  journal: journalDefectResolved,
  result: (defect) => ({ defectId: defect.id }),
});

import { aggregateCommand } from "@/platform/command";
import { claimDefect, claimingActors } from "./claim-defect";
import { defects } from "./defects";

/**
 * CMD-ClaimDefect through the command layer: a change of AGG-Defect at the version the team member saw – of two
 * concurrent claims the second is rejected as a conflict, not silently turned into a takeover (ST-003) – emits
 * EVT-DefectClaimed.
 */
export const claimDefectCommand = aggregateCommand({
  id: "CMD-ClaimDefect",
  allowedActors: claimingActors,
  store: defects,
  target: (input) => ({ id: input.defectId, version: input.version }),
  decide: claimDefect,
  journal: (event) => ({
    type: event.type,
    aggregate: { type: "AGG-Defect", id: event.defectId },
    machineId: event.machineId,
    data: { claimedBy: event.claimedBy },
  }),
  result: (defect, [claimed]) => ({ defectId: defect.id, takenOverFrom: claimed?.takenOverFrom }),
});

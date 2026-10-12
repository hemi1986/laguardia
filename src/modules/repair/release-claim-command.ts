import { aggregateCommand } from "@/platform/command";
import { defects } from "./defects";
import { releaseClaim, releasingActors } from "./release-claim";

/**
 * CMD-ReleaseClaim through the command layer: a change of AGG-Defect at the version the team member saw, emits
 * EVT-DefectClaimReleased. A claim that someone took over meanwhile is never released unseen (ST-003): its former
 * claimant, a helper, is told it is not theirs any more – the decision runs on what is stored now –, a technician gets
 * a conflict. Who released it is the acting person of the journal entry.
 */
export const releaseClaimCommand = aggregateCommand({
  id: "CMD-ReleaseClaim",
  allowedActors: releasingActors,
  store: defects,
  target: (input) => ({ id: input.defectId, version: input.version }),
  decide: releaseClaim,
  journal: (event) => ({
    type: event.type,
    aggregate: { type: "AGG-Defect", id: event.defectId },
    machineId: event.machineId,
    data: {},
  }),
  result: (defect) => ({ defectId: defect.id }),
});

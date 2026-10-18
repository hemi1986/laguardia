import { activeTeamMemberRole } from "@/modules/team";
import { aggregateCommand } from "@/platform/command";
import { changeDefectDetails, changingDetailsActors } from "./change-defect-details";
import { defects } from "./defects";
import { repairEvents } from "./events";

/**
 * CMD-ChangeDefectDetails through the command layer: a change of AGG-Defect at the version the technician saw, emits
 * EVT-DefectDetailsChanged – and EVT-DefectClaimReleased when removing the mark releases a helper's claim. Which details
 * changed and the mark go into the journal, the title stays in the aggregate; who changed them is the acting person of
 * the journal entry. Its facts are the claimant's role as Team knows it now, read without a lock (context map).
 */
export const changeDefectDetailsCommand = aggregateCommand({
  id: "CMD-ChangeDefectDetails",
  allowedActors: changingDetailsActors,
  store: defects,
  target: (input) => ({ id: input.defectId, version: input.version }),
  facts: async (tx, _input, defect) => ({
    claimantRole: defect.claim ? await activeTeamMemberRole(tx, defect.claim.claimedBy) : undefined,
  }),
  decide: changeDefectDetails,
  journal: repairEvents.journal,
  result: (defect) => ({ defectId: defect.id }),
});

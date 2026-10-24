import { assigneeRefusal, defectForAction } from "@/modules/repair";
import { activeTeamMembers, type ActiveTeamMember } from "@/modules/team";
import type { Database } from "@/platform/command";
import { shownClaimant, type ShownClaimant, type Viewer } from "../../../claimant";
import { named } from "../../../named";
import { defectForForm, type DefectForForm } from "../defect-form-data";

/** What the form page „Defekt zuweisen“ shows (ST-026): the defect, who has it now, and whom it can be assigned to. */
export type DefectForAssigning = DefectForForm<"assign"> & {
  /** Its claimant, if any – an assignment takes the defect over from them. */
  claimant: ShownClaimant | undefined;
  /**
   * The team members the defect can be assigned to, by name – everyone with an active account CMD-ClaimDefect would
   * accept (G11): helpers only for a defect suitable for helpers, not its claimant, and not the technician looking at
   * the page, who claims it on the defect's page. Empty for someone who may not assign.
   */
  teamMembers: ActiveTeamMember[];
};

/**
 * Repair's defect and its rule about whom it can be assigned to, Team's active team members and names, Collection's
 * museum number and title – the page composes (ST-009). Undefined when there is no such defect.
 */
export async function loadDefectForAssigning(
  db: Database,
  defectId: string,
  viewer: Viewer,
): Promise<DefectForAssigning | undefined> {
  const defect = await defectForAction(db, defectId, { teamMemberId: viewer.id, role: viewer.role }, "assign");
  if (!defect) return undefined;
  const { whyNot } = defect;
  const [shown, active] = await Promise.all([
    named(db, { machines: [defect.machineId], teamMembers: [defect.claim?.claimedBy] }),
    whyNot ? [] : activeTeamMembers(db),
  ]);
  return {
    ...defectForForm(defect, shown),
    claimant: shownClaimant(defect.claim?.claimedBy, shown, viewer),
    teamMembers: active.filter(
      ({ id, role }) => id !== viewer.id && assigneeRefusal(defect, { teamMemberId: id, role }) === undefined,
    ),
  };
}

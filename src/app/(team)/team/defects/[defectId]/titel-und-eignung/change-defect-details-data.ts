import { claimReleasedByRemovingTheMark, defectForAction } from "@/modules/repair";
import { teamMemberRole } from "@/modules/team";
import type { Database } from "@/platform/command";
import type { Viewer } from "../../../claimant";
import { named } from "../../../named";
import { defectForForm, type DefectForForm } from "../defect-form-data";

/** What the form page „Titel und Eignung ändern“ shows (ST-031): the defect with its title and mark as they are now. */
export type DefectForChangingDetails = DefectForForm<"change-details"> & {
  suitableForHelpers: boolean;
  /** Whose claim removing the mark would release – a helper's, by name; none otherwise (rule on CMD-ChangeDefectDetails). */
  releasesClaimOf: string | undefined;
};

/**
 * Repair's defect with Collection's machine label and Team's claimant – the page composes (ST-009). Whose claim removing
 * the mark releases is Repair's rule (`claimReleasedByRemovingTheMark`), asked with the claimant's role as Team knows it
 * now. Undefined when there is no such defect.
 */
export async function loadDefectForChangingDetails(
  db: Database,
  defectId: string,
  viewer: Viewer,
): Promise<DefectForChangingDetails | undefined> {
  const defect = await defectForAction(db, defectId, { teamMemberId: viewer.id, role: viewer.role }, "change-details");
  if (!defect) return undefined;
  const claimant = defect.claim?.claimedBy;
  // Only the claimant's claim can be released, so naming the claimant names whom it would be.
  const [shown, claimantRole] = await Promise.all([
    named(db, { machines: [defect.machineId], teamMembers: [claimant] }),
    claimant ? teamMemberRole(db, claimant) : undefined,
  ]);
  const released = claimReleasedByRemovingTheMark(defect, claimantRole);
  return {
    ...defectForForm(defect, shown),
    suitableForHelpers: defect.suitableForHelpers,
    releasesClaimOf: released && shown.name(released),
  };
}

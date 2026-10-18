import { claimReleasedByRemovingTheMark, defectForAction } from "@/modules/repair";
import { activeTeamMemberRole, teamMemberNames } from "@/modules/team";
import { machineLabels } from "@/modules/collection";
import type { Database } from "@/platform/command";
import { nameOf, type Viewer } from "../../../claimant";
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
  const [machines, claimantRole] = await Promise.all([
    machineLabels(db, [defect.machineId]),
    claimant ? activeTeamMemberRole(db, claimant) : undefined,
  ]);
  const released = claimReleasedByRemovingTheMark(defect, claimantRole);
  return {
    ...defectForForm(defect, machines.get(defect.machineId)),
    suitableForHelpers: defect.suitableForHelpers,
    releasesClaimOf: released && nameOf(await teamMemberNames(db, [released]), released),
  };
}

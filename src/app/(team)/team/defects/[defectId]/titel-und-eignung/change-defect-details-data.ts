import { defectForAction } from "@/modules/repair";
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
 * Repair's defect with Collection's machine label and Team's names – the page composes (ST-009). Whose claim removing
 * the mark releases is Repair's answer (the command's own rule, G11). Undefined when there is no such defect.
 */
export async function loadDefectForChangingDetails(
  db: Database,
  defectId: string,
  viewer: Viewer,
): Promise<DefectForChangingDetails | undefined> {
  const defect = await defectForAction(db, defectId, { teamMemberId: viewer.id, role: viewer.role }, "change-details");
  if (!defect) return undefined;
  const released = defect.offer.releasesClaimOf;
  const shown = await named(db, { machines: [defect.machineId], teamMembers: [released] });
  return {
    ...defectForForm(defect, shown),
    suitableForHelpers: defect.suitableForHelpers,
    releasesClaimOf: released && shown.name(released),
  };
}

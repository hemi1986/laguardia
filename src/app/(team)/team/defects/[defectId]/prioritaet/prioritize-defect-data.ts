import type { Priority } from "@/modules/repair";
import type { Database } from "@/platform/command";
import type { Viewer } from "../../../claimant";
import { loadDefectForForm, type DefectForForm } from "../defect-form-data";

/** What the form page „Priorität ändern“ shows (ST-027): the defect, its priority, and the priorities to choose from. */
export type DefectForPrioritizing = DefectForForm<"prioritize"> & {
  /** The priorities CMD-PrioritizeDefect would accept (G11) – every one but the one it has, in the usual order. */
  priorities: Priority[];
};

/**
 * The defect as every form page of a defect loads it, with the priorities Repair offers – the command's own rule, never
 * a second copy here. Undefined when there is no such defect.
 */
export async function loadDefectForPrioritizing(
  db: Database,
  defectId: string,
  viewer: Viewer,
): Promise<DefectForPrioritizing | undefined> {
  const defect = await loadDefectForForm(db, defectId, viewer, "prioritize");
  return defect && { ...defect, priorities: defect.offer.priorities };
}

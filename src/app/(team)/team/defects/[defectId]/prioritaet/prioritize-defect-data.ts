import { priorities, priorityRefusal, type Priority } from "@/modules/repair";
import type { Database } from "@/platform/command";
import type { Viewer } from "../../../claimant";
import { loadDefectForForm, type DefectForForm } from "../defect-form-data";

/** What the form page „Priorität ändern“ shows (ST-027): the defect, its priority, and the priorities to choose from. */
export type DefectForPrioritizing = DefectForForm<"prioritize"> & {
  /** The priorities CMD-PrioritizeDefect would accept (G11) – every one but the one it has, in the usual order. */
  priorities: Priority[];
};

/** The defect as every form page of a defect loads it. Undefined when there is no such defect. */
export async function loadDefectForPrioritizing(
  db: Database,
  defectId: string,
  viewer: Viewer,
): Promise<DefectForPrioritizing | undefined> {
  const defect = await loadDefectForForm(db, defectId, viewer, "prioritize");
  if (!defect) return undefined;
  return {
    ...defect,
    priorities: priorities.filter((priority) => priorityRefusal(defect, priority) === undefined),
  };
}

import { machineLabels } from "@/modules/collection";
import { defectDetails, type DefectAction, type DefectActionRefusals, type Priority } from "@/modules/repair";
import type { Viewer } from "../../claimant";
import type { Database } from "@/platform/command";

/**
 * What a form page of a defect repeats about it (G21) and what its form posts – for „Defekt beheben“ (ST-028) and
 * „Arbeitsschritt eintragen“ (ST-024) and „Priorität ändern“ (ST-027).
 */
export type DefectForForm<Action extends DefectAction> = {
  id: string;
  /** The version this page shows (HS-16). */
  version: number;
  title: string;
  priority: Priority;
  museumNumber: string;
  machineModelTitle: string;
  /** Why the form's command would refuse this team member – the command's own reason (G11); none if it would not. */
  whyNot: DefectActionRefusals[Action];
};

/**
 * Repair's defect with Collection's museum number and title – the page composes (ST-009). `action` is what the form
 * does; whether its command would refuse the team member looking at the page is Repair's answer. Undefined when there
 * is no such defect.
 */
export async function loadDefectForForm<Action extends DefectAction>(
  db: Database,
  defectId: string,
  viewer: Viewer,
  action: Action,
): Promise<DefectForForm<Action> | undefined> {
  const defect = await defectDetails(db, defectId, { teamMemberId: viewer.id, role: viewer.role });
  if (!defect) return undefined;
  const machine = (await machineLabels(db, [defect.machineId])).get(defect.machineId);
  return {
    id: defect.id,
    version: defect.version,
    title: defect.title,
    priority: defect.priority,
    museumNumber: machine?.museumNumber ?? "",
    machineModelTitle: machine?.machineModelTitle ?? "",
    whyNot: defect.actions?.[action],
  };
}

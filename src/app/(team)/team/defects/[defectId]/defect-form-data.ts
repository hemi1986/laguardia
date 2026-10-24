import {
  defectForAction,
  type DefectAction,
  type DefectActionRefusals,
  type DefectForAction,
  type DefectFormOffer,
  type Priority,
} from "@/modules/repair";
import type { Viewer } from "../../claimant";
import { named, type Named } from "../../named";
import type { Database } from "@/platform/command";

/**
 * What a form page of a defect repeats about it (G21) and what its form posts – for „Defekt beheben“ (ST-028) and
 * „Arbeitsschritt eintragen“ (ST-024), „Priorität ändern“ (ST-027) and „Defekt zuweisen“ (ST-026).
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
  /** The choices the form may offer them – Repair's answer from the command's own rules (G11). */
  offer: DefectFormOffer<Action>;
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
  const defect = await defectForAction(db, defectId, { teamMemberId: viewer.id, role: viewer.role }, action);
  if (!defect) return undefined;
  return defectForForm(defect, await named(db, { machines: [defect.machineId] }));
}

/**
 * What the form page repeats, from Repair's defect and its machine's label (`named`, over at least the defect's
 * machine) – for a page that loads more.
 */
export function defectForForm<Action extends DefectAction>(
  defect: DefectForAction<Action>,
  { label }: Pick<Named, "label">,
): DefectForForm<Action> {
  return {
    id: defect.id,
    version: defect.version,
    title: defect.title,
    priority: defect.priority,
    ...label(defect.machineId),
    whyNot: defect.whyNot,
    offer: defect.offer,
  };
}

import { machineLabels } from "@/modules/collection";
import { defectDetails, type DefectDetails } from "@/modules/repair";
import type { Database } from "@/platform/command";

/**
 * What a form page of a defect repeats about it (G21) and what its form posts – for „Defekt beheben“ (ST-028) and
 * „Arbeitsschritt eintragen“ (ST-024).
 */
export type DefectForForm<Refusal extends string> = {
  id: string;
  /** The version this page shows (HS-16). */
  version: number;
  title: string;
  museumNumber: string;
  machineModelTitle: string;
  /** Why the form's command would refuse the defect as it is – the command's own reason (G11); none if it would not. */
  whyNot: Refusal | undefined;
};

/**
 * Repair's defect with Collection's museum number and title – the page composes (ST-009). `refusal` is the rule of the
 * form's command, asked for the team member looking at the page. Undefined when there is no such defect.
 */
export async function loadDefectForForm<Refusal extends string>(
  db: Database,
  defectId: string,
  refusal: (defect: DefectDetails) => Refusal | undefined,
): Promise<DefectForForm<Refusal> | undefined> {
  const defect = await defectDetails(db, defectId);
  if (!defect) return undefined;
  const machine = (await machineLabels(db, [defect.machineId])).get(defect.machineId);
  return {
    id: defect.id,
    version: defect.version,
    title: defect.title,
    museumNumber: machine?.museumNumber ?? "",
    machineModelTitle: machine?.machineModelTitle ?? "",
    whyNot: refusal(defect),
  };
}

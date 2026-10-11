import { machineLabels } from "@/modules/collection";
import { defectDetails, resolveRefusal, type ResolveDefectError } from "@/modules/repair";
import type { Database } from "@/platform/command";
import type { Viewer } from "../../../claimant";

/** What the form page „Defekt beheben“ repeats about the defect (G21), and what its form posts. */
export type DefectToResolve = {
  id: string;
  /** The version this page shows (HS-16). */
  version: number;
  title: string;
  museumNumber: string;
  machineModelTitle: string;
  /** Why this team member may not resolve the defect as it is – CMD-ResolveDefect's own reason (G11); none if they may. */
  whyNot: Exclude<ResolveDefectError, "closing-note-required"> | undefined;
};

/** Repair's defect with Collection's museum number and title – the page composes (ST-009). Undefined for no defect. */
export async function loadDefectToResolve(
  db: Database,
  defectId: string,
  viewer: Viewer,
): Promise<DefectToResolve | undefined> {
  const defect = await defectDetails(db, defectId);
  if (!defect) return undefined;
  const machine = (await machineLabels(db, [defect.machineId])).get(defect.machineId);
  return {
    id: defect.id,
    version: defect.version,
    title: defect.title,
    museumNumber: machine?.museumNumber ?? "",
    machineModelTitle: machine?.machineModelTitle ?? "",
    whyNot: resolveRefusal(defect, viewer),
  };
}

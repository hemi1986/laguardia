import { machineForTeamForm, type MachineStatus } from "@/modules/collection";
import { stricterMachineStatuses } from "@/modules/repair";
import type { Database } from "@/platform/command";
import type { Viewer } from "../../../claimant";
import { loadDefectForForm, type DefectForForm } from "../defect-form-data";

/**
 * What the form page „Defekt wieder öffnen“ shows (ST-030): the defect – with why CMD-ReopenDefect would refuse, the
 * machine being retired included (G11) – and for technicians the status choice.
 */
export type DefectForReopening = DefectForForm<"reopen"> & {
  /**
   * The machine for the status choice of POL-DefectMayChangeMachineStatus – technicians only; none for a helper, who
   * cannot change the status while reopening (ST-030).
   */
  machine: { status: MachineStatus; version: number; stricter: MachineStatus[] } | undefined;
};

/**
 * Repair's defect as every form page of a defect loads it, with Collection's machine – the page composes (ST-009).
 * Undefined when there is no such defect.
 */
export async function loadDefectForReopening(
  db: Database,
  defectId: string,
  viewer: Viewer,
): Promise<DefectForReopening | undefined> {
  const defect = await loadDefectForForm(db, defectId, viewer, "reopen");
  if (!defect) return undefined;
  // Whether they may choose a status is Repair's rule (G11); the machine is read only then.
  const machine = defect.offer.mayChangeMachineStatus ? await machineForTeamForm(db, defect.museumNumber) : undefined;
  return {
    ...defect,
    machine: machine
      ? {
          status: machine.machineStatus,
          version: machine.version,
          stricter: stricterMachineStatuses(machine.machineStatus),
        }
      : undefined,
  };
}

import type { ChangeMachinesOfMaintenanceTaskInput } from "@/modules/maintenance";
import type { FormFields } from "@/app/_actions/form-action";

/** The form's own field – read and echoed after a rejection (ST-073): the maintenance task. */
export const changeMachinesFields = ["maintenanceTaskId"] as const;

export type ChangeMachinesField = (typeof changeMachinesFields)[number];

/** The field the browser posts once per ticked machine – the runner reads them all, as posted (ST-094). */
export const MACHINE_FIELD = "machineId";

/**
 * Reads the form „Geräte ändern“ (ST-095, Q19): the maintenance task, the machines ticked and the machines seen when the
 * page opened – exactly as posted, so a forged change that names a machine twice reaches the command.
 */
export function changeMachinesInput(
  fields: FormFields<ChangeMachinesField>,
  ticked: readonly string[],
  seen: readonly string[],
): ChangeMachinesOfMaintenanceTaskInput {
  return { maintenanceTaskId: fields.maintenanceTaskId ?? "", seen, ticked };
}

/**
 * How the form „Geräte ändern“ is read (ST-095) – what its Server Action runs and its tests post through: a set delta,
 * so the runner reads the machines seen as well (`SeenField`) and a rejection keeps them.
 */
export const changeMachinesDefinition = {
  fields: changeMachinesFields,
  many: { field: MACHINE_FIELD, seen: true },
  input: changeMachinesInput,
} as const;

/**
 * Where the technician lands after the change (G33): the maintenance plan, which says how many machines the task applies
 * to now – also when nothing changed. The command names the task.
 */
export function machinesChangedLanding({ maintenanceTaskId }: { maintenanceTaskId: string }): string {
  return `/team/maintenance-plan?machinesChanged=${maintenanceTaskId}`;
}

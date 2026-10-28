import type { ChangeMaintenancePlanInput } from "@/modules/maintenance";
import type { FormFields } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";
import { maintenanceTaskChangesOf, maintenanceTaskFields } from "../maintenance-task-input";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const addMaintenanceTaskFields = ["version", "name", ...maintenanceTaskFields] as const;

export type AddMaintenanceTaskField = (typeof addMaintenanceTaskFields)[number];

/** The field the browser posts once per ticked machine – the runner reads them all, as posted (ST-094). */
export const MACHINE_FIELD = "machineId";

/**
 * Reads the form „Wartungsaufgabe hinzufügen“ (ST-040, ST-094, Q19): its name, the details every maintenance task has
 * and the machines ticked – exactly as posted, so a forged step that names one twice reaches the command.
 */
export function addMaintenanceTaskInput(
  fields: FormFields<AddMaintenanceTaskField>,
  machineIds: readonly string[],
): ChangeMaintenancePlanInput {
  return {
    version: versionSeen(fields.version),
    change: "add",
    task: { name: fields.name ?? "", ...maintenanceTaskChangesOf(fields), machineIds },
  };
}

/** How the form „Wartungsaufgabe hinzufügen“ is read (ST-040, ST-094) – what its Server Action runs and its tests post through. */
export const addMaintenanceTaskDefinition = {
  fields: addMaintenanceTaskFields,
  many: { field: MACHINE_FIELD },
  input: addMaintenanceTaskInput,
} as const;

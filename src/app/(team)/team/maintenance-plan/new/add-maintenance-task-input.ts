import type { ChangeMaintenancePlanInput } from "@/modules/maintenance";
import type { FormFields } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";
import { maintenanceTaskChangesOf, maintenanceTaskFields } from "../maintenance-task-input";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const addMaintenanceTaskFields = ["version", "name", ...maintenanceTaskFields] as const;

export type AddMaintenanceTaskField = (typeof addMaintenanceTaskFields)[number];

/** Reads the form „Wartungsaufgabe hinzufügen“ (ST-040, Q19): its name, and the details every maintenance task has. */
export function addMaintenanceTaskInput(fields: FormFields<AddMaintenanceTaskField>): ChangeMaintenancePlanInput {
  return {
    version: versionSeen(fields.version),
    change: "add",
    task: { name: fields.name ?? "", ...maintenanceTaskChangesOf(fields) },
  };
}

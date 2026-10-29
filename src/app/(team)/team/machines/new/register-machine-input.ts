import { machineStatuses, type RegisterMachineInput } from "@/modules/collection";
import type { ChosenMaintenanceTasks } from "@/modules/maintenance";
import type { FormFields } from "@/app/_actions/form-action";
import { TASK_FIELD } from "./task-field";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const registerMachineFields = [
  "machineModelId",
  "museumNumber",
  "serialNumber",
  "location",
  "machineStatus",
] as const;

export type RegisterMachineField = (typeof registerMachineFields)[number];


/**
 * Reads and converts the fields of the registration form (ST-073, Q19): no validation, no default. The empty-field
 * rule: an empty museum number is "no museum number given" – CMD-RegisterMachine assigns one; a missing machine model
 * or an unknown machine status is "no value given", which the command rejects with its own reason.
 */
export function registerMachineInput(fields: FormFields<RegisterMachineField>): RegisterMachineInput {
  return {
    machineModelId: fields.machineModelId || undefined,
    museumNumber: fields.museumNumber || undefined,
    serialNumber: fields.serialNumber || undefined,
    location: fields.location ?? "",
    machineStatus: machineStatuses.find((status) => status === fields.machineStatus),
  };
}

/**
 * How the registration form is read (ST-097) – what its Server Action runs and its tests post through: the machine's
 * own fields for Collection's command, and the maintenance tasks ticked – exactly as posted, so a forged step that names
 * a task La Guardia does not know reaches the policy – for Maintenance's policy (HS-22).
 */
export const registerMachineDefinition = {
  fields: registerMachineFields,
  many: { field: TASK_FIELD },
  input: (
    fields: FormFields<RegisterMachineField>,
    ticked: readonly string[],
  ): { command: RegisterMachineInput; policies: ChosenMaintenanceTasks } => ({
    command: registerMachineInput(fields),
    policies: { maintenanceTaskIds: ticked },
  }),
} as const;

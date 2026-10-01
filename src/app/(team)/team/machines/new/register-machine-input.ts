import { machineStatuses, type RegisterMachineInput } from "@/modules/collection";
import type { FormFields } from "@/app/_actions/form-action";

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

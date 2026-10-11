import { machineStatuses, type ChangeMachineStatusInput } from "@/modules/collection";
import type { FormFields } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const changeMachineStatusFields = ["machineId", "version", "machineStatus", "reason"] as const;

export type ChangeMachineStatusField = (typeof changeMachineStatusFields)[number];

/**
 * Reads and converts the fields of the status change form (ST-073, Q19): no validation, no default. An unknown
 * machine status is "no value given", which CMD-ChangeMachineStatus rejects; the reason arrives as it was typed.
 * A version that is not a whole number is one nobody saw – the command layer answers it with a version conflict.
 */
export function changeMachineStatusInput(fields: FormFields<ChangeMachineStatusField>): ChangeMachineStatusInput {
  return {
    machineId: fields.machineId ?? "",
    version: versionSeen(fields.version),
    machineStatus: machineStatuses.find((status) => status === fields.machineStatus),
    reason: fields.reason ?? "",
  };
}

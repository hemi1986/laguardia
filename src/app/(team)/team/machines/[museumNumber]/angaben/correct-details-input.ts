import type { CorrectMachineDetailsInput } from "@/modules/collection";
import type { FormFields } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const correctDetailsFields = ["machineId", "version", "museumNumber", "serialNumber"] as const;

export type CorrectDetailsField = (typeof correctDetailsFields)[number];

/**
 * Reads the fields of the correction form (ST-073, Q19): no validation, no default. Both arrive as they were typed;
 * CMD-CorrectMachineDetails decides – an empty serial number means the machine has none (user, 2026-10-25).
 */
export function correctDetailsInput(fields: FormFields<CorrectDetailsField>): CorrectMachineDetailsInput {
  return {
    machineId: fields.machineId ?? "",
    version: versionSeen(fields.version),
    museumNumber: fields.museumNumber ?? "",
    serialNumber: fields.serialNumber ?? "",
  };
}

import type { MoveMachineInput } from "@/modules/collection";
import type { FormFields } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const moveMachineFields = ["machineId", "version", "location"] as const;

export type MoveMachineField = (typeof moveMachineFields)[number];

/**
 * Reads the fields of the move form (ST-073, Q19): no validation, no default. The location arrives as it was typed;
 * CMD-MoveMachine rejects an empty one. A version that is not a whole number is one nobody saw.
 */
export function moveMachineInput(fields: FormFields<MoveMachineField>): MoveMachineInput {
  return {
    machineId: fields.machineId ?? "",
    version: versionSeen(fields.version),
    location: fields.location ?? "",
  };
}

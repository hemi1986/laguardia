import type { LogWorkInput } from "@/modules/repair";
import type { FormFields } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const logWorkFields = ["version", "whatWasDone", "partsUsed"] as const;

export type LogWorkField = (typeof logWorkFields)[number];

/**
 * Reads the form „Arbeitsschritt eintragen“ (Q19): no validation, no default. A missing text is an empty one – the
 * command rejects an empty „what was done“ and takes empty parts as none; a version that is not a whole number is one
 * nobody saw – the command layer answers with a conflict.
 */
export function logWorkInput(fields: FormFields<LogWorkField>, defectId: string): LogWorkInput {
  return {
    defectId,
    version: versionSeen(fields.version),
    whatWasDone: fields.whatWasDone ?? "",
    partsUsed: fields.partsUsed ?? "",
  };
}

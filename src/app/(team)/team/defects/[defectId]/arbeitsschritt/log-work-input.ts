import type { LogWorkInput } from "@/modules/repair";
import type { FormFields } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const logWorkFields = ["version", "whatWasDone", "partsUsed"] as const;

export type LogWorkField = (typeof logWorkFields)[number];

/**
 * The form's photos (ST-032): the file field posted once per photo, stored as the work log's; too many is a rejection
 * of the photos themselves – its text says what to do, so it does not ask to choose them again (G8a).
 */
export const logWorkPhotos = { field: "photos", owner: "work-log", rejectedBy: ["too-many-photos"] } as const;

/**
 * Reads the form „Arbeitsschritt eintragen“ (Q19): no validation, no default. A missing text is an empty one – the
 * command rejects an empty „what was done“ and takes empty parts as none; a version that is not a whole number is one
 * nobody saw – the command layer answers with a conflict.
 */
export function logWorkInput(
  fields: FormFields<LogWorkField>,
  defectId: string,
  photos: readonly string[] = [],
): LogWorkInput {
  return {
    defectId,
    version: versionSeen(fields.version),
    whatWasDone: fields.whatWasDone ?? "",
    partsUsed: fields.partsUsed ?? "",
    photos,
  };
}

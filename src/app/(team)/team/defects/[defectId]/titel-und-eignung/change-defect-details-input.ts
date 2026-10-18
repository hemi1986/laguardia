import type { ChangeDefectDetailsInput } from "@/modules/repair";
import type { FormFields } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const changeDefectDetailsFields = ["version", "title", "suitableForHelpers"] as const;

export type ChangeDefectDetailsField = (typeof changeDefectDetailsFields)[number];

/**
 * Reads the form „Titel und Eignung ändern“ (Q19): no validation. A missing title is an empty one, which the command
 * rejects; an unticked box is not posted at all, so it removes the mark; a version that is not a whole number is one
 * nobody saw.
 */
export function changeDefectDetailsInput(
  fields: FormFields<ChangeDefectDetailsField>,
  defectId: string,
): ChangeDefectDetailsInput {
  return {
    defectId,
    version: versionSeen(fields.version),
    title: fields.title ?? "",
    suitableForHelpers: fields.suitableForHelpers !== undefined,
  };
}

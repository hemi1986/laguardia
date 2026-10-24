import { holdReasons, type PutDefectOnHoldInput } from "@/modules/repair";
import type { FormFields } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const putDefectOnHoldFields = ["version", "reason", "note"] as const;

export type PutDefectOnHoldField = (typeof putDefectOnHoldFields)[number];

/**
 * Reads the form „Defekt pausieren“ (Q19): no validation, no default. No reason chosen – or an unknown one – is "no
 * reason given", which the command rejects; a version that is not a whole number is one nobody saw.
 */
export function putDefectOnHoldInput(
  fields: FormFields<PutDefectOnHoldField>,
  defectId: string,
): PutDefectOnHoldInput {
  return {
    defectId,
    version: versionSeen(fields.version),
    reason: holdReasons.find((reason) => reason === fields.reason),
    note: fields.note,
  };
}

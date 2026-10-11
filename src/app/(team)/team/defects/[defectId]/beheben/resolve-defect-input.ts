import type { ResolveDefectInput } from "@/modules/repair";
import type { FormFields } from "@/app/_actions/form-action";
import { NO_VERSION_SEEN, wholeNumber } from "../../../defect-input";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const resolveDefectFields = ["version", "closingNote"] as const;

export type ResolveDefectField = (typeof resolveDefectFields)[number];

/**
 * Reads the form „Defekt beheben“ (Q19): no validation, no default. A missing closing note is an empty one – the command
 * rejects it; a version that is not a whole number is one nobody saw – the command layer answers with a conflict.
 */
export function resolveDefectInput(fields: FormFields<ResolveDefectField>, defectId: string): ResolveDefectInput {
  return {
    defectId,
    version: wholeNumber(fields.version) ?? NO_VERSION_SEEN,
    closingNote: fields.closingNote ?? "",
  };
}

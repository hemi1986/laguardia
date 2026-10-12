import type { ClaimDefectInput } from "@/modules/repair";
import type { FormFields } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const assignDefectFields = ["version", "assignTo"] as const;

export type AssignDefectField = (typeof assignDefectFields)[number];

/**
 * Reads the form „Defekt zuweisen“ (Q19): no validation, no default. No team member chosen is an assignment to nobody
 * – the command rejects it, it never becomes a claim of the technician's own; a version that is not a whole number is
 * one nobody saw – the command layer answers with a conflict.
 */
export function assignDefectInput(fields: FormFields<AssignDefectField>, defectId: string): ClaimDefectInput {
  return { defectId, version: versionSeen(fields.version), assignTo: fields.assignTo ?? "" };
}

import type { ClaimDefectInput } from "@/modules/repair";
import type { FormFields } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";

/** The claim form's own field – the version of the defect its page showed (ST-073, HS-16). */
export const claimDefectFields = ["version"] as const;

export type ClaimDefectField = (typeof claimDefectFields)[number];

/**
 * Reads the claim form (Q19): a version that is not a whole number is one nobody saw – the command layer answers with a
 * conflict, never with a claim on a defect the person did not see.
 */
export function claimDefectInput(fields: FormFields<ClaimDefectField>, defectId: string): ClaimDefectInput {
  return { defectId, version: versionSeen(fields.version) };
}

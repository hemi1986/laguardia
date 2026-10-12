import type { FormFields } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";

/** The only field of a one-tap action on a defect – the version of the defect its page showed (ST-073, HS-16). */
export const defectVersionFields = ["version"] as const;

export type DefectVersionField = (typeof defectVersionFields)[number];

/**
 * Reads the form of a one-tap action on a defect – claiming it (ST-025), releasing its claim (ST-026) (Q19): a version
 * that is not a whole number is one nobody saw – the command layer answers with a conflict, never with a change of a
 * defect the person did not see.
 */
export function defectVersionInput(
  fields: FormFields<DefectVersionField>,
  defectId: string,
): { defectId: string; version: number } {
  return { defectId, version: versionSeen(fields.version) };
}

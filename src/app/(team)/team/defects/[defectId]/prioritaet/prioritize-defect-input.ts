import { priorities, type PrioritizeDefectInput } from "@/modules/repair";
import type { FormFields } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const prioritizeDefectFields = ["version", "priority"] as const;

export type PrioritizeDefectField = (typeof prioritizeDefectFields)[number];

/**
 * Reads the form „Priorität ändern“ (Q19): no validation, no default. No priority chosen – or an unknown one – is "no
 * priority given", which the command rejects; a version that is not a whole number is one nobody saw.
 */
export function prioritizeDefectInput(
  fields: FormFields<PrioritizeDefectField>,
  defectId: string,
): PrioritizeDefectInput {
  return {
    defectId,
    version: versionSeen(fields.version),
    priority: priorities.find((priority) => priority === fields.priority),
  };
}

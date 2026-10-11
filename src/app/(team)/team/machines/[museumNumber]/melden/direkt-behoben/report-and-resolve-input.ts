import type { ReportProblemAndTriageInput } from "@/modules/repair";
import type { FormFields } from "@/app/_actions/form-action";

/**
 * The fields of the form „Problem melden und als direkt behoben eintragen“ (ST-052): the problem report's description
 * and the note of ST-019's form – only these are read and echoed after a rejection (ST-073).
 */
export const reportAndResolveFields = ["description", "note"] as const;

export type ReportAndResolveField = (typeof reportAndResolveFields)[number];

/**
 * Reads the form (Q19): no validation, no default – the description and the note arrive as they were typed, a missing
 * one as an empty one, which the command rejects. The machine is the one the server found by the page's museum number;
 * an unknown one is "no machine", which CMD-ReportProblem rejects.
 */
export function reportAndResolveInput(
  fields: FormFields<ReportAndResolveField>,
  machineId: string | undefined,
  photo?: string,
): ReportProblemAndTriageInput {
  return {
    machineId: machineId ?? "",
    description: fields.description ?? "",
    photo,
    triage: { outcome: "resolved-on-the-spot", note: fields.note ?? "" },
  };
}

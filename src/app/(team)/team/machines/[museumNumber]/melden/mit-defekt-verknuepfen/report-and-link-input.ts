import type { ReportProblemAndTriageInput } from "@/modules/repair";
import type { FormFields } from "@/app/_actions/form-action";

/**
 * The fields of the form „Problem melden und mit Defekt verknüpfen“ (ST-052): the problem report's description and
 * the chosen defect of ST-022's form – only these are read and echoed after a rejection (ST-073).
 */
export const reportAndLinkFields = ["description", "defectId"] as const;

export type ReportAndLinkField = (typeof reportAndLinkFields)[number];

/**
 * Reads the form (Q19): no validation, no default. The description arrives as it was typed; no chosen defect is none –
 * the command rejects it. The machine is the one the server found by the page's museum number; an unknown one is "no
 * machine", which CMD-ReportProblem rejects.
 */
export function reportAndLinkInput(
  fields: FormFields<ReportAndLinkField>,
  machineId: string | undefined,
  photo?: string,
): ReportProblemAndTriageInput {
  return {
    machineId: machineId ?? "",
    description: fields.description ?? "",
    photo,
    triage: { outcome: "linked", defectId: fields.defectId || undefined },
  };
}

import type { ReportProblemAndTriageInput } from "@/modules/repair";
import type { FormFields } from "@/app/_actions/form-action";
import { defectToLinkToInput } from "../../../../defect-to-link-to-input";

/**
 * The fields of the form „Problem melden und mit Defekt verknüpfen“ (ST-052): the problem report's description and
 * the chosen defect of ST-022's form – only these are read and echoed after a rejection (ST-073).
 */
export const reportAndLinkFields = ["description", "defectId", "resolvedDefects"] as const;

export type ReportAndLinkField = (typeof reportAndLinkFields)[number];

/**
 * Reads the form (Q19): no validation, no default. The description arrives as it was typed; no chosen defect is none –
 * the command rejects it; a recently resolved one comes with the version the page showed (ST-053). The machine is the one the server found by the page's museum number; an unknown one is "no
 * machine", which CMD-ReportProblem rejects.
 */
export function reportAndLinkInput(
  // The field ST-053 added is optional: what ST-052's form posted still reads the same.
  fields: FormFields<"description" | "defectId"> & Partial<FormFields<ReportAndLinkField>>,
  machineId: string | undefined,
  photo?: string,
): ReportProblemAndTriageInput {
  return {
    machineId: machineId ?? "",
    description: fields.description ?? "",
    photo,
    triage: { outcome: "linked", ...defectToLinkToInput(fields) },
  };
}

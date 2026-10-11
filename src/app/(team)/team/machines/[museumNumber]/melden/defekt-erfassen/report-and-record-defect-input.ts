import type { ReportProblemAndTriageInput } from "@/modules/repair";
import type { FormFields } from "@/app/_actions/form-action";
import { defectInput } from "../../../../defect-input";

/**
 * The fields of the form „Problem melden und Defekt erfassen“ (ST-023): the problem report's description and the
 * defect's fields as on ST-018's form – only these are read and echoed after a rejection (ST-073).
 */
export const reportAndRecordDefectFields = [
  "description",
  "title",
  "priority",
  "suitableForHelpers",
  "machineStatus",
  "machineVersion",
] as const;

export type ReportAndRecordDefectField = (typeof reportAndRecordDefectFields)[number];

/**
 * Reads the form (Q19): no validation, no default. The description arrives as it was typed; the defect's fields are
 * read exactly as on the form „Defekt erfassen“ (ST-018). The machine is the one the server found by the page's museum
 * number; an unknown one is "no machine", which CMD-ReportProblem rejects.
 */
export function reportAndRecordDefectInput(
  fields: FormFields<ReportAndRecordDefectField>,
  machineId: string | undefined,
  photo?: string,
): ReportProblemAndTriageInput {
  return {
    machineId: machineId ?? "",
    description: fields.description ?? "",
    photo,
    triage: { outcome: "defect-recorded", ...defectInput(fields) },
  };
}

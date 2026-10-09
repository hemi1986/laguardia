import type { LinkProblemReportToDefectInput } from "@/modules/repair";
import type { FormFields } from "@/app/_actions/form-action";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const linkToDefectFields = ["version", "defectId"] as const;

export type LinkToDefectField = (typeof linkToDefectFields)[number];

/**
 * Reads the form „Mit Defekt verknüpfen“ (ST-073, Q19): no validation, no default. No chosen defect is none – the
 * command rejects it; a version that is not a whole number is one nobody saw – the command layer answers with a conflict.
 */
export function linkToDefectInput(
  fields: FormFields<LinkToDefectField>,
  problemReportId: string,
): LinkProblemReportToDefectInput {
  const version = Number(fields.version);
  return {
    problemReportId,
    version: fields.version && Number.isInteger(version) ? version : NO_VERSION_SEEN,
    defectId: fields.defectId || undefined,
  };
}

const NO_VERSION_SEEN = -1;

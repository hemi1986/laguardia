import { machineStatuses } from "@/modules/collection";
import type { LinkProblemReportToDefectInput } from "@/modules/repair";
import type { FormFields } from "@/app/_actions/form-action";
import { NO_VERSION_SEEN, versionSeen, wholeNumber } from "@/app/_actions/version";
import { defectToLinkToInput } from "../../../defect-to-link-to-input";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const linkToDefectFields = [
  "version",
  "defectId",
  "resolvedDefects",
  "machineStatus",
  "machineVersion",
] as const;

export type LinkToDefectField = (typeof linkToDefectFields)[number];

/**
 * Reads the form „Mit Defekt verknüpfen“ (ST-073, Q19): no validation, no default. No chosen defect is none – the
 * command rejects it; a version that is not a whole number is one nobody saw – the command layer answers with a
 * conflict. A recently resolved defect comes with the version the page showed (ST-053), and an empty machine status is
 * "do not change the status".
 */
export function linkToDefectInput(
  // The fields ST-053 added are optional: what ST-022's form posted still reads the same.
  fields: FormFields<"version" | "defectId"> & Partial<FormFields<LinkToDefectField>>,
  problemReportId: string,
): LinkProblemReportToDefectInput {
  return {
    problemReportId,
    version: versionSeen(fields.version),
    ...defectToLinkToInput(fields),
    machineStatus: machineStatuses.find((status) => status === fields.machineStatus),
    machineVersion: fields.machineVersion ? (wholeNumber(fields.machineVersion) ?? NO_VERSION_SEEN) : undefined,
  };
}

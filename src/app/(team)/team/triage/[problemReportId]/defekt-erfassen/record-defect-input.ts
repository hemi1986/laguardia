import { machineStatuses } from "@/modules/collection";
import { priorities, type RecordDefectInput } from "@/modules/repair";
import type { FormFields } from "@/app/_actions/form-action";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const recordDefectFields = [
  "version",
  "title",
  "priority",
  "suitableForHelpers",
  "machineStatus",
  "machineVersion",
] as const;

export type RecordDefectField = (typeof recordDefectFields)[number];

/** The defect's own fields – also on the form that reports and records in the same step (ST-023). */
export type DefectInputField = "title" | "priority" | "suitableForHelpers" | "machineStatus" | "machineVersion";

/**
 * Reads the defect's fields (ST-073, Q19): no validation, no default. An unknown priority is "no priority chosen" –
 * the command takes normal; an empty machine status is "do not change the status"; the checkbox is set when it is
 * posted. A version that is not a whole number is one nobody saw – the command layer answers with a conflict.
 */
export function defectInput(fields: FormFields<DefectInputField>) {
  return {
    title: fields.title ?? "",
    priority: priorities.find((priority) => priority === fields.priority),
    suitableForHelpers: fields.suitableForHelpers !== undefined,
    machineStatus: machineStatuses.find((status) => status === fields.machineStatus),
    machineVersion: fields.machineVersion ? (wholeNumber(fields.machineVersion) ?? NO_VERSION_SEEN) : undefined,
  };
}

/** Reads the form „Defekt erfassen“: the problem report, the version of it the technician saw, and the defect. */
export function recordDefectInput(fields: FormFields<RecordDefectField>, problemReportId: string): RecordDefectInput {
  return { problemReportId, version: wholeNumber(fields.version) ?? NO_VERSION_SEEN, ...defectInput(fields) };
}

const NO_VERSION_SEEN = -1;

function wholeNumber(value: string | undefined): number | undefined {
  const number = Number(value);
  return value && Number.isInteger(number) ? number : undefined;
}

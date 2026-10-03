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

/**
 * Reads the form „Defekt erfassen“ (ST-073, Q19): no validation, no default. An unknown priority is "no priority
 * chosen" – the command takes normal; an empty machine status is "do not change the status"; the checkbox is set when
 * it is posted. A version that is not a whole number is one nobody saw – the command layer answers with a conflict.
 */
export function recordDefectInput(fields: FormFields<RecordDefectField>, problemReportId: string): RecordDefectInput {
  return {
    problemReportId,
    version: wholeNumber(fields.version) ?? NO_VERSION_SEEN,
    title: fields.title ?? "",
    priority: priorities.find((priority) => priority === fields.priority),
    suitableForHelpers: fields.suitableForHelpers !== undefined,
    machineStatus: machineStatuses.find((status) => status === fields.machineStatus),
    machineVersion: fields.machineVersion ? (wholeNumber(fields.machineVersion) ?? NO_VERSION_SEEN) : undefined,
  };
}

const NO_VERSION_SEEN = -1;

function wholeNumber(value: string | undefined): number | undefined {
  const number = Number(value);
  return value && Number.isInteger(number) ? number : undefined;
}

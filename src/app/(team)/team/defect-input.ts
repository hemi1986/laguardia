import { machineStatuses } from "@/modules/collection";
import { priorities } from "@/modules/repair";
import type { FormFields } from "@/app/_actions/form-action";
import { NO_VERSION_SEEN, wholeNumber } from "@/app/_actions/version";

/**
 * The fields of a new defect as a form posts them – shared by the form „Defekt erfassen“ in triage (ST-018) and the
 * form that reports and records in the same step (ST-023). Beside the routes, like the other pieces several team
 * pages share.
 */
/** The defect's own fields. */
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

import { machineStatuses } from "@/modules/collection";
import type { ReopenDefectInput } from "@/modules/repair";
import type { FormFields } from "@/app/_actions/form-action";
import { NO_VERSION_SEEN, versionSeen, wholeNumber } from "@/app/_actions/version";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const reopenDefectFields = ["version", "reason", "machineStatus", "machineVersion"] as const;

export type ReopenDefectField = (typeof reopenDefectFields)[number];

/**
 * Reads the form „Defekt wieder öffnen“ (Q19): no validation, no default. An empty machine status is "do not change
 * the status"; a version that is not a whole number is one nobody saw – the command layer answers with a conflict.
 */
export function reopenDefectInput(fields: FormFields<ReopenDefectField>, defectId: string): ReopenDefectInput {
  return {
    defectId,
    version: versionSeen(fields.version),
    reason: fields.reason ?? "",
    machineStatus: machineStatuses.find((status) => status === fields.machineStatus),
    machineVersion: fields.machineVersion ? (wholeNumber(fields.machineVersion) ?? NO_VERSION_SEEN) : undefined,
  };
}

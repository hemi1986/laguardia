import { maintenanceOutcomes, type RecordMaintenanceInput } from "@/modules/maintenance";
import type { FormFields } from "@/app/_actions/form-action";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const recordMaintenanceFields = ["maintenanceTaskId", "machineId", "outcome", "date", "note"] as const;

export type RecordMaintenanceField = (typeof recordMaintenanceFields)[number];

/**
 * Reads the form „Wartung erfassen“ (ST-044, Q19): no validation, no default. An empty date is "no date given" – the
 * command takes today; any other date goes to the command, which rejects one that is no calendar date. An unknown
 * outcome is "no outcome given".
 */
export function recordMaintenanceInput(fields: FormFields<RecordMaintenanceField>): RecordMaintenanceInput {
  const date = fields.date?.trim();
  return {
    maintenanceTaskId: fields.maintenanceTaskId ?? "",
    machineId: fields.machineId ?? "",
    outcome: maintenanceOutcomes.find((outcome) => outcome === fields.outcome),
    date: date ? date : undefined,
    note: fields.note ?? "",
  };
}

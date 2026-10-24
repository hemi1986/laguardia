import type { RecordMaintenanceInput } from "@/modules/maintenance";
import type { EachOutcome, FormFields } from "@/app/_actions/form-action";
import { recordMaintenanceInput } from "../erfassen/record-maintenance-input";

/**
 * The form's own fields (ST-073) – the ticked machines come as `machineId`, once per checkbox, which the runner reads
 * as the items to run the command for (ST-045).
 */
export const recordForSeveralFields = ["maintenanceTaskId", "outcome", "date", "note"] as const;

export type RecordForSeveralField = (typeof recordForSeveralFields)[number];

/** Reads the form for one ticked machine – the outcome, date and note apply to every one of them, as in ST-044's form. */
export function recordForSeveralInput(
  fields: FormFields<RecordForSeveralField>,
  machineId: string,
): RecordMaintenanceInput {
  return recordMaintenanceInput({ ...fields, machineId });
}

/**
 * Back on the due maintenance list at the maintenance task (ST-045): the address names the records just made, which
 * the list confirms only as the team member's own (G3), and the machines that were not recorded – whose reason the list
 * asks Maintenance for, not the address.
 */
export function recordedForSeveralAddress({
  done,
  rejected,
}: EachOutcome<{ maintenanceRecordId: string; maintenanceTaskId: string }, string>): string {
  const params = new URLSearchParams();
  if (done[0]) params.set("task", done[0].result.maintenanceTaskId);
  for (const { result } of done) params.append("recorded", result.maintenanceRecordId);
  for (const { item } of rejected) params.append("notRecorded", item);
  return `/team/maintenance?${params.toString()}`;
}

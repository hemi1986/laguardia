import type { ChangeMachinesOfMaintenanceTaskInput } from "@/modules/maintenance";
import type { FormFields } from "@/app/_actions/form-action";

/**
 * The form's own fields – only these are read and echoed after a rejection (ST-073): the maintenance task, and the
 * machines as they were ticked when the page opened. A rejection keeps `seen` as it was, so a retry still means what the
 * technician changed, even though the page now shows what is stored.
 */
export const changeMachinesFields = ["maintenanceTaskId", "seen"] as const;

export type ChangeMachinesField = (typeof changeMachinesFields)[number];

/** The field the browser posts once per ticked machine – the runner reads them all, as posted (ST-094). */
export const MACHINE_FIELD = "machineId";

/** The machines seen travel in one hidden field, separated by commas (they are IDs). */
export const SEEN_SEPARATOR = ",";

/**
 * Reads the form „Geräte ändern“ (ST-095, Q19): the maintenance task, the machines seen and the machines ticked – exactly
 * as posted, so a forged change that names a machine twice reaches the command.
 */
export function changeMachinesInput(
  fields: FormFields<ChangeMachinesField>,
  ticked: readonly string[],
): ChangeMachinesOfMaintenanceTaskInput {
  return {
    maintenanceTaskId: fields.maintenanceTaskId ?? "",
    seen: (fields.seen ?? "").split(SEEN_SEPARATOR).filter((machineId) => machineId !== ""),
    ticked,
  };
}

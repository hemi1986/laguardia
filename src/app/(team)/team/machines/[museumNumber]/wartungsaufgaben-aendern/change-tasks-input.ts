import type { ChangeMaintenanceTasksOfMachineInput } from "@/modules/maintenance";
import type { FormFields } from "@/app/_actions/form-action";

/**
 * The form's own fields – only these are read and echoed after a rejection (ST-073): the machine, and the tasks as they
 * were ticked when the page opened. A rejection keeps `seen` as it was, so a retry still means what the technician
 * changed, even though the page now shows what is stored (ST-095).
 */
export const changeTasksFields = ["machineId", "seen"] as const;

export type ChangeTasksField = (typeof changeTasksFields)[number];

/** The field the browser posts once per ticked maintenance task – the runner reads them all, as posted. */
export const TASK_FIELD = "maintenanceTaskId";

/** The tasks seen travel in one hidden field, separated by commas (they are IDs). */
export const SEEN_SEPARATOR = ",";

/**
 * Reads the form „Wartungsaufgaben ändern“ (ST-096, Q19): the machine, the tasks seen and the tasks ticked – exactly as
 * posted, so a forged change that names a task La Guardia does not know reaches the command.
 */
export function changeTasksInput(
  fields: FormFields<ChangeTasksField>,
  ticked: readonly string[],
): ChangeMaintenanceTasksOfMachineInput {
  return {
    machineId: fields.machineId ?? "",
    seen: (fields.seen ?? "").split(SEEN_SEPARATOR).filter((taskId) => taskId !== ""),
    ticked,
  };
}

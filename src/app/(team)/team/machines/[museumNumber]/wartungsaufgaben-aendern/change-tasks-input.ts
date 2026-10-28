import type { ChangeMaintenanceTasksOfMachineInput } from "@/modules/maintenance";
import type { FormFields } from "@/app/_actions/form-action";

/** The form's own field – read and echoed after a rejection (ST-073): the machine. */
export const changeTasksFields = ["machineId"] as const;

export type ChangeTasksField = (typeof changeTasksFields)[number];

/** The field the browser posts once per ticked maintenance task – the runner reads them all, as posted. */
export const TASK_FIELD = "maintenanceTaskId";

/**
 * Reads the form „Wartungsaufgaben ändern“ (ST-096, Q19): the machine, the tasks ticked and the tasks seen when the page
 * opened – exactly as posted, so a forged change that names a task La Guardia does not know reaches the command.
 */
export function changeTasksInput(
  fields: FormFields<ChangeTasksField>,
  ticked: readonly string[],
  seen: readonly string[],
): ChangeMaintenanceTasksOfMachineInput {
  return { machineId: fields.machineId ?? "", seen, ticked };
}

/**
 * How the form „Wartungsaufgaben ändern“ is read (ST-096) – what its Server Action runs and its tests post through: a
 * set delta, so the runner reads the tasks seen as well (`SeenField`) and a rejection keeps them.
 */
export const changeTasksDefinition = {
  fields: changeTasksFields,
  many: { field: TASK_FIELD, seen: true },
  input: changeTasksInput,
} as const;

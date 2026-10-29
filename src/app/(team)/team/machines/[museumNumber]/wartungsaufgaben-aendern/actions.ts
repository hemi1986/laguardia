"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { changeMaintenanceTasksOfMachineCommand } from "@/modules/maintenance";
import { formAction, type ManyFormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { database } from "@/platform/database";
import { requireTechnician } from "../../../../../team-session";
import { changeTasksDefinition, type ChangeTasksField } from "./change-tasks-input";
import { withRemovedNamed } from "../../task-choice";
import { tasksChangedLanding } from "./change-tasks-outcome";

/**
 * The form's state: a rejection with what was kept, the tasks ticked and seen – and, when a maintenance task was removed
 * meanwhile, which ones (their names), so the rejection can name them (ST-096).
 */
export type ChangeTasksState =
  | (NonNullable<ManyFormState<CommandError<typeof changeMaintenanceTasksOfMachineCommand>, ChangeTasksField>> & {
      removed?: readonly string[];
    })
  | null;

/**
 * CMD-ChangeMachinesOfMaintenanceTask from the form „Wartungsaufgaben ändern“ (ST-096) through the Server Action runner
 * (ST-073). Afterwards the technician is back on the machine record, which says how many maintenance tasks apply to the
 * machine now – also when nothing changed, which is no rejection (G33).
 */
const changeTasks = formAction(changeMaintenanceTasksOfMachineCommand, {
  ...changeTasksDefinition,
  onSuccess: async (result) => {
    const { record, address } = await tasksChangedLanding(database(), result);
    revalidatePath(record);
    redirect(address);
  },
});

export async function changeTasksAction(previous: ChangeTasksState, formData: FormData): Promise<ChangeTasksState> {
  await requireTechnician(); // the page's access check; who may run the command is decided by its allowedActors
  // The command names the tasks removed meanwhile; the rejection says them by their names.
  return withRemovedNamed(database(), await changeTasks(previous, formData));
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { machineLabels } from "@/modules/collection";
import { changeMaintenanceTasksOfMachineCommand, removedMaintenanceTaskNames } from "@/modules/maintenance";
import { formAction, type ManyFormState } from "@/app/_actions/form-action";
import { isId, type CommandError } from "@/platform/command";
import { database } from "@/platform/database";
import { requireTechnician } from "../../../../../team-session";
import {
  changeTasksFields,
  changeTasksInput,
  SEEN_SEPARATOR,
  TASK_FIELD,
  type ChangeTasksField,
} from "./change-tasks-input";

/**
 * The form's state: a rejection with what was kept and the tasks ticked – and, when a maintenance task was removed
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
export async function changeTasksAction(previous: ChangeTasksState, formData: FormData): Promise<ChangeTasksState> {
  await requireTechnician(); // the page's access check; who may run the command is decided by its allowedActors
  // The command's result names nothing, so the landing takes the machine from the form it was posted from.
  const posted = formData.get("machineId");
  const machineId = typeof posted === "string" && isId(posted) ? posted : undefined;
  const museumNumber = machineId && (await machineLabels(database(), [machineId])).get(machineId)?.museumNumber;
  const changeTasks = formAction(changeMaintenanceTasksOfMachineCommand, {
    fields: changeTasksFields,
    many: { field: TASK_FIELD },
    input: changeTasksInput,
    onSuccess: async () => {
      const record = museumNumber ? `/team/machines/${encodeURIComponent(museumNumber)}` : "/team/machines";
      revalidatePath(record);
      redirect(museumNumber ? `${record}?tasksChanged=1` : record);
    },
  });
  const state = await changeTasks(previous, formData);
  // The command's reason is a code; the rejection names the tasks removed meanwhile, as the page sees them now – only
  // the newly ticked ones: one only unticked is no longer offered and so skipped, never the cause.
  if (state?.error === "maintenance-task-removed") {
    const seen = new Set(state.values.seen.split(SEEN_SEPARATOR));
    const newlyTicked = state.chosen.filter((maintenanceTaskId) => !seen.has(maintenanceTaskId));
    return { ...state, removed: await removedMaintenanceTaskNames(database(), newlyTicked) };
  }
  return state;
}

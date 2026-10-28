"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { changeMaintenancePlanCommand } from "@/modules/maintenance";
import { formAction, type ManyFormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { database } from "@/platform/database";
import { requireTechnician } from "../../../../team-session";
import {
  addMaintenanceTaskFields,
  addMaintenanceTaskInput,
  MACHINE_FIELD,
  type AddMaintenanceTaskField,
} from "./add-maintenance-task-input";
import { withRetiredNamed } from "../retired-named";

const MAINTENANCE_PLAN = "/team/maintenance-plan";

/**
 * The form's state: a rejection with what was typed and the machines ticked – and, when a machine was retired
 * meanwhile, which ones (their museum numbers), so the rejection can name them (ST-094).
 */
export type AddMaintenanceTaskState =
  | (NonNullable<ManyFormState<CommandError<typeof changeMaintenancePlanCommand>, AddMaintenanceTaskField>> & {
      retired?: readonly string[];
    })
  | null;

/**
 * CMD-ChangeMaintenancePlan from the form „Wartungsaufgabe hinzufügen“ (ST-040, ST-094) – through the Server Action
 * runner (ST-073). Afterwards the technician is back on the maintenance plan, which names the new maintenance task
 * (G2a, G3).
 */
const addMaintenanceTask = formAction(changeMaintenancePlanCommand, {
  fields: addMaintenanceTaskFields,
  many: { field: MACHINE_FIELD },
  input: addMaintenanceTaskInput,
  onSuccess: async ({ maintenanceTaskId }) => {
    revalidatePath(MAINTENANCE_PLAN);
    redirect(`${MAINTENANCE_PLAN}?added=${maintenanceTaskId}`);
  },
});

export async function addMaintenanceTaskAction(
  previous: AddMaintenanceTaskState,
  formData: FormData,
): Promise<AddMaintenanceTaskState> {
  await requireTechnician(); // the page's access check; who may run the command is decided by its allowedActors
  // The command names the machines retired meanwhile; the rejection says them by their museum numbers.
  return withRetiredNamed(database(), await addMaintenanceTask(previous, formData));
}

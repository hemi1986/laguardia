"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { changeMaintenancePlanCommand } from "@/modules/maintenance";
import { formAction, type FormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { requireTechnician } from "../../../../team-session";
import {
  addMaintenanceTaskFields,
  addMaintenanceTaskInput,
  type AddMaintenanceTaskField,
} from "./add-maintenance-task-input";

const MAINTENANCE_PLAN = "/team/maintenance-plan";

export type AddMaintenanceTaskState = FormState<
  CommandError<typeof changeMaintenancePlanCommand>,
  AddMaintenanceTaskField
>;

/**
 * CMD-ChangeMaintenancePlan from the form „Wartungsaufgabe hinzufügen“ (ST-040) – through the Server Action runner
 * (ST-073). Afterwards the technician is back on the maintenance plan, which names the new maintenance task (G2a, G3).
 */
const addMaintenanceTask = formAction(changeMaintenancePlanCommand, {
  fields: addMaintenanceTaskFields,
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
  return addMaintenanceTask(previous, formData);
}

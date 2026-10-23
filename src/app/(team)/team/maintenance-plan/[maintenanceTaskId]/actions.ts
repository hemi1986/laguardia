"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { changeMaintenancePlanCommand } from "@/modules/maintenance";
import { formAction, type FormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { requireTechnician } from "../../../../team-session";
import {
  changeMaintenanceTaskFields,
  changeMaintenanceTaskInput,
  changeStep,
  keptValues,
  removeMaintenanceTaskFields,
  removeMaintenanceTaskInput,
  type ChangeMaintenanceTaskField,
} from "./change-maintenance-task-input";

const MAINTENANCE_PLAN = "/team/maintenance-plan";

type Values = { readonly [F in ChangeMaintenanceTaskField]: string };

/**
 * The form's state: null before the first post; a rejection with what was typed; or the question before removing –
 * asked (`asking: true`) or gone back from (`asking: false`) – with what was typed (G10b).
 */
export type ChangeMaintenanceTaskState =
  | (NonNullable<FormState<CommandError<typeof changeMaintenancePlanCommand>, ChangeMaintenanceTaskField>> & {
      asking?: undefined;
    })
  | { asking: true; error?: undefined; values: Values }
  | { asking: false; error?: undefined; values: Values }
  | null;

/**
 * CMD-ChangeMaintenancePlan from the change form of a maintenance task (ST-041), through the Server Action runner
 * (ST-073) – changing it, or removing it once the question is answered (G10, G10b). Afterwards the technician is back
 * on the maintenance plan, which names what was done (G3).
 */
const changeMaintenanceTask = formAction(changeMaintenancePlanCommand, {
  fields: changeMaintenanceTaskFields,
  input: changeMaintenanceTaskInput,
  onSuccess: async ({ maintenanceTaskId }) => {
    revalidatePath(MAINTENANCE_PLAN);
    redirect(`${MAINTENANCE_PLAN}?changed=${maintenanceTaskId}`);
  },
});

const removeMaintenanceTask = formAction(changeMaintenancePlanCommand, {
  fields: removeMaintenanceTaskFields,
  input: removeMaintenanceTaskInput,
  onSuccess: async ({ maintenanceTaskId }) => {
    revalidatePath(MAINTENANCE_PLAN);
    redirect(`${MAINTENANCE_PLAN}?removed=${maintenanceTaskId}`);
  },
});

export async function changeMaintenanceTaskAction(
  previous: ChangeMaintenanceTaskState,
  formData: FormData,
): Promise<ChangeMaintenanceTaskState> {
  await requireTechnician(); // the page's access check; who may run the command is decided by its allowedActors
  const values = keptValues(formData);
  switch (changeStep(formData)) {
    case "ask":
      return { asking: true, values };
    case "back":
      return { asking: false, values };
    case "remove": {
      // A rejected removal goes back to the form with everything typed, and names the reason there (G8).
      const rejected = await removeMaintenanceTask(null, formData);
      return rejected && { error: rejected.error, values };
    }
    case "change":
      return changeMaintenanceTask(null, formData);
  }
}

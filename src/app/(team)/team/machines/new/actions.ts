"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { registerMachineWithMaintenanceTasksCommand } from "@/modules/maintenance";
import { formAction, type ManyFormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { database } from "@/platform/database";
import { requireTechnician } from "../../../../team-session";
import { withRemovedNamed } from "../task-choice";
import { registerMachineDefinition, type RegisterMachineField } from "./register-machine-input";

const MACHINES = "/team/machines";

/**
 * The form's state: a rejection with what was kept and the maintenance tasks ticked – and, when a task was removed
 * meanwhile, which ones (their names), so the rejection can name them (ST-097).
 */
export type RegisterMachineState =
  | (NonNullable<
      ManyFormState<CommandError<typeof registerMachineWithMaintenanceTasksCommand>, RegisterMachineField>
    > & { removed?: readonly string[] })
  | null;

/**
 * CMD-RegisterMachine from the registration page (ST-007) – through the Server Action runner (ST-073), with
 * Maintenance's policy applying the maintenance tasks ticked (ST-097, HS-22). After registering, the technician lands
 * back on the machine overview, which names the new machine (G2a, G3).
 */
const registerMachine = formAction(registerMachineWithMaintenanceTasksCommand, {
  ...registerMachineDefinition,
  onSuccess: async ({ machineId }) => {
    revalidatePath(MACHINES);
    redirect(`${MACHINES}?registered=${machineId}`);
  },
});

export async function registerMachineAction(
  previous: RegisterMachineState,
  formData: FormData,
): Promise<RegisterMachineState> {
  await requireTechnician(); // the page's access check; who may run the command is decided by its allowedActors
  // The policy names the maintenance tasks removed meanwhile; the rejection says them by their names.
  return withRemovedNamed(database(), await registerMachine(previous, formData));
}

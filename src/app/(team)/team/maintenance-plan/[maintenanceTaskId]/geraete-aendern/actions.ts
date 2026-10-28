"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { changeMachinesOfMaintenanceTaskCommand } from "@/modules/maintenance";
import { formAction, type ManyFormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { database } from "@/platform/database";
import { requireTechnician } from "../../../../../team-session";
import { withRetiredNamed } from "../../retired-named";
import { changeMachinesDefinition, machinesChangedLanding, type ChangeMachinesField } from "./change-machines-input";

/**
 * The form's state: a rejection with what was kept, the machines ticked and seen – and, when a machine was retired
 * meanwhile, which ones (their museum numbers), so the rejection can name them (ST-094, ST-095).
 */
export type ChangeMachinesState =
  | (NonNullable<ManyFormState<CommandError<typeof changeMachinesOfMaintenanceTaskCommand>, ChangeMachinesField>> & {
      retired?: readonly string[];
    })
  | null;

/**
 * CMD-ChangeMachinesOfMaintenanceTask from the form „Geräte ändern“ (ST-095) through the Server Action runner (ST-073).
 * Afterwards the technician is back on the maintenance plan, which says how many machines the task applies to now – also
 * when nothing changed, which is no rejection (G33).
 */
const changeMachines = formAction(changeMachinesOfMaintenanceTaskCommand, {
  ...changeMachinesDefinition,
  onSuccess: async (result) => {
    revalidatePath("/team/maintenance-plan");
    redirect(machinesChangedLanding(result));
  },
});

export async function changeMachinesAction(
  previous: ChangeMachinesState,
  formData: FormData,
): Promise<ChangeMachinesState> {
  await requireTechnician(); // the page's access check; who may run the command is decided by its allowedActors
  // The command names the machines retired meanwhile; the rejection says them by their museum numbers.
  return withRetiredNamed(database(), await changeMachines(previous, formData));
}

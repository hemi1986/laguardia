"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { changeMachinesOfMaintenanceTaskCommand } from "@/modules/maintenance";
import { formAction, type ManyFormState } from "@/app/_actions/form-action";
import { isId, type CommandError } from "@/platform/command";
import { database } from "@/platform/database";
import { requireTechnician } from "../../../../../team-session";
import { retiredAmong } from "../../retired-among";
import {
  changeMachinesFields,
  changeMachinesInput,
  MACHINE_FIELD,
  type ChangeMachinesField,
} from "./change-machines-input";

const MAINTENANCE_PLAN = "/team/maintenance-plan";

/**
 * The form's state: a rejection with what was kept and the machines ticked – and, when a machine was retired meanwhile,
 * which ones (their museum numbers), so the rejection can name them (ST-094, ST-095).
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
export async function changeMachinesAction(
  previous: ChangeMachinesState,
  formData: FormData,
): Promise<ChangeMachinesState> {
  await requireTechnician(); // the page's access check; who may run the command is decided by its allowedActors
  // The command's result names nothing when nothing changed, so the landing takes the task from the form it was posted from.
  const posted = formData.get("maintenanceTaskId");
  const maintenanceTaskId = typeof posted === "string" && isId(posted) ? posted : undefined;
  const changeMachines = formAction(changeMachinesOfMaintenanceTaskCommand, {
    fields: changeMachinesFields,
    many: { field: MACHINE_FIELD },
    input: changeMachinesInput,
    onSuccess: async () => {
      revalidatePath(MAINTENANCE_PLAN);
      redirect(maintenanceTaskId ? `${MAINTENANCE_PLAN}?machinesChanged=${maintenanceTaskId}` : MAINTENANCE_PLAN);
    },
  });
  const state = await changeMachines(previous, formData);
  // The command's reason is a code; the rejection names the machines retired meanwhile, as the page sees them now.
  if (state?.error === "machine-retired") return { ...state, retired: await retiredAmong(database(), state.chosen) };
  return state;
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordMaintenanceCommand } from "@/modules/maintenance";
import { formAction, type EachFormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { requireTeamMember } from "../../../../team-session";
import {
  recordedForSeveralAddress,
  recordForSeveralFields,
  recordForSeveralInput,
  type RecordForSeveralField,
} from "./record-for-several-input";

export type RecordForSeveralState = EachFormState<CommandError<typeof recordMaintenanceCommand>, RecordForSeveralField>;

/**
 * CMD-RecordMaintenance once per ticked machine (ST-045, HS-11) – each in its own transaction, through the Server
 * Action runner (ST-073), as the signed-in team member. Afterwards they are back on the due maintenance list, which
 * confirms the records and names the machines left out (G3, G23). Who may record what where is the command's.
 */
const recordForSeveral = formAction(recordMaintenanceCommand, {
  fields: recordForSeveralFields,
  each: { field: "machineId" },
  input: recordForSeveralInput,
  onSuccess: async (outcome) => {
    revalidatePath("/team/maintenance");
    redirect(recordedForSeveralAddress(outcome));
  },
});

export async function recordForSeveralAction(
  previous: RecordForSeveralState,
  formData: FormData,
): Promise<RecordForSeveralState> {
  await requireTeamMember(); // the page's access check
  return recordForSeveral(previous, formData);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordMaintenanceCommand } from "@/modules/maintenance";
import { formAction, type FormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { database } from "@/platform/database";
import { requireTeamMember } from "../../../../team-session";
import {
  recordMaintenanceFields,
  recordMaintenanceInput,
  type RecordMaintenanceField,
} from "./record-maintenance-input";
import { addressAfterRecording } from "./address-after-recording";
import { recordMaintenanceReturnOf } from "./record-maintenance-address";

export type RecordMaintenanceState = FormState<CommandError<typeof recordMaintenanceCommand>, RecordMaintenanceField>;

/**
 * CMD-RecordMaintenance from the form „Wartung erfassen“ (ST-044) – through the Server Action runner (ST-073), as the
 * signed-in team member. Afterwards they are back where the form was opened from (ST-047) – the due maintenance list
 * at the same maintenance task, or the machine record –, which confirms the record (G3). Who may record what where is
 * the command's.
 */
const recordMaintenanceFrom = {
  list: formAction(recordMaintenanceCommand, {
    fields: recordMaintenanceFields,
    input: recordMaintenanceInput,
    onSuccess: async (result) => {
      revalidatePath("/team/maintenance");
      redirect(await addressAfterRecording(database(), "list", result));
    },
  }),
  machine: formAction(recordMaintenanceCommand, {
    fields: recordMaintenanceFields,
    input: recordMaintenanceInput,
    onSuccess: async (result) => {
      revalidatePath("/team/maintenance");
      redirect(await addressAfterRecording(database(), "machine", result));
    },
  }),
};

/**
 * `back` is bound by the page: where the form leads back to. It returns from the browser like a field, so it only
 * chooses between the two fixed places – never an address (no open redirect).
 */
export async function recordMaintenanceAction(
  back: string,
  previous: RecordMaintenanceState,
  formData: FormData,
): Promise<RecordMaintenanceState> {
  await requireTeamMember(); // the page's access check
  return recordMaintenanceFrom[recordMaintenanceReturnOf(back)](previous, formData);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordMaintenanceCommand } from "@/modules/maintenance";
import { formAction, type FormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { requireTeamMember } from "../../../../team-session";
import {
  recordMaintenanceFields,
  recordMaintenanceInput,
  type RecordMaintenanceField,
} from "./record-maintenance-input";

export type RecordMaintenanceState = FormState<CommandError<typeof recordMaintenanceCommand>, RecordMaintenanceField>;

/**
 * CMD-RecordMaintenance from the form „Wartung erfassen“ (ST-044) – through the Server Action runner (ST-073), as the
 * signed-in team member. Afterwards they are back on the due maintenance list at the same maintenance task, which
 * confirms the record (G3). Who may record what where is the command's.
 */
const recordMaintenance = formAction(recordMaintenanceCommand, {
  fields: recordMaintenanceFields,
  input: recordMaintenanceInput,
  onSuccess: async ({ maintenanceRecordId, maintenanceTaskId }) => {
    revalidatePath("/team/maintenance");
    const params = new URLSearchParams({ task: maintenanceTaskId, recorded: maintenanceRecordId });
    redirect(`/team/maintenance?${params.toString()}`);
  },
});

export async function recordMaintenanceAction(
  previous: RecordMaintenanceState,
  formData: FormData,
): Promise<RecordMaintenanceState> {
  await requireTeamMember(); // the page's access check
  return recordMaintenance(previous, formData);
}

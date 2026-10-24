"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordMaintenanceCommand } from "@/modules/maintenance";
import { formAction, type FormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { database } from "@/platform/database";
import { requireTeamMember } from "../../../../team-session";
import type { RecordMaintenanceField } from "./record-maintenance-input";
import { recordMaintenanceDefinition } from "./record-maintenance-definition";
import { recordMaintenanceReturnOf } from "./record-maintenance-address";

export type RecordMaintenanceState = FormState<CommandError<typeof recordMaintenanceCommand>, RecordMaintenanceField>;

/**
 * CMD-RecordMaintenance from the form „Wartung erfassen“ (ST-044) – through the Server Action runner (ST-073), as the
 * signed-in team member. Afterwards they are back where the form was opened from (ST-047) – the due maintenance list
 * at the same maintenance task, or the machine record –, which confirms the record (G3). Who may record what where is
 * the command's.
 *
 * `from` is bound by the page – the address's `von`. It returns from the browser like a field, so it only chooses
 * between the two fixed places – never an address (no open redirect).
 */
export async function recordMaintenanceAction(
  from: string | undefined,
  previous: RecordMaintenanceState,
  formData: FormData,
): Promise<RecordMaintenanceState> {
  await requireTeamMember(); // the page's access check
  const record = formAction(
    recordMaintenanceCommand,
    recordMaintenanceDefinition(database(), recordMaintenanceReturnOf(from), async (address) => {
      revalidatePath("/team/maintenance");
      redirect(address);
    }),
  );
  return record(previous, formData);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { changeMachineStatusCommand } from "@/modules/collection";
import { formAction } from "@/app/_actions/form-action";
import { requireTeamMember } from "../../../../../team-session";
import { changeMachineStatusFields, changeMachineStatusInput } from "./change-machine-status-input";

/**
 * CMD-ChangeMachineStatus from the status change page (ST-012) – through the Server Action runner (ST-073). After the
 * change the team member is back on the machine record, which names the machine and its new machine status (G3).
 */
const changeMachineStatus = formAction(changeMachineStatusCommand, {
  fields: changeMachineStatusFields,
  input: changeMachineStatusInput,
  onSuccess: async ({ museumNumber }) => {
    const record = `/team/machines/${encodeURIComponent(museumNumber)}`;
    revalidatePath("/team/machines");
    revalidatePath(record);
    redirect(`${record}?statusChanged=1`);
  },
});

export type ChangeMachineStatusState = Parameters<typeof changeMachineStatus>[0];

export async function changeMachineStatusAction(
  previous: ChangeMachineStatusState,
  formData: FormData,
): Promise<ChangeMachineStatusState> {
  await requireTeamMember(); // the page's access check; who may set which status is decided by the command
  return changeMachineStatus(previous, formData);
}

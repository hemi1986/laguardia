"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { reopenDefectCommand } from "@/modules/repair";
import { formAction, type FormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { requireTeamMember } from "../../../../../team-session";
import { reopenDefectFields, reopenDefectInput, type ReopenDefectField } from "./reopen-defect-input";

export type ReopenDefectState = FormState<CommandError<typeof reopenDefectCommand>, ReopenDefectField>;

/**
 * CMD-ReopenDefect from the form „Defekt wieder öffnen“ (ST-030) – through the Server Action runner (ST-073), as the
 * signed-in team member. Afterwards they are on the defect's page, which confirms the reopening – and the machine's new
 * status when one was chosen (as in ST-018). Who may reopen, and who may change the status, is the command's.
 */
export async function reopenDefectAction(
  defectId: string,
  previous: ReopenDefectState,
  formData: FormData,
): Promise<ReopenDefectState> {
  await requireTeamMember(); // the page's access check
  return formAction(reopenDefectCommand, {
    fields: reopenDefectFields,
    input: (fields) => reopenDefectInput(fields, defectId),
    onSuccess: async (reopened) => {
      revalidatePath("/team/defects");
      redirect(`/team/defects/${reopened.defectId}?done=reopen`);
    },
  })(previous, formData);
}

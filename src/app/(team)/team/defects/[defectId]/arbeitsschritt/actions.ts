"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logWorkCommand } from "@/modules/repair";
import { formAction, type FormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { requireTeamMember } from "../../../../../team-session";
import { logWorkFields, logWorkInput, type LogWorkField } from "./log-work-input";

export type LogWorkState = FormState<CommandError<typeof logWorkCommand>, LogWorkField>;

/**
 * CMD-LogWork from the form „Arbeitsschritt eintragen“ (ST-024) – through the Server Action runner (ST-073), as the
 * signed-in team member. Afterwards the team member is on the defect's page, which confirms it and shows the entry at
 * the top of the work log (G3). The page binds the defect's ID.
 */
export async function logWorkAction(
  defectId: string,
  previous: LogWorkState,
  formData: FormData,
): Promise<LogWorkState> {
  await requireTeamMember(); // the page's access check
  return formAction(logWorkCommand, {
    fields: logWorkFields,
    input: (fields) => logWorkInput(fields, defectId),
    onSuccess: async (logged) => {
      revalidatePath("/team/defects");
      redirect(`/team/defects/${logged.defectId}?done=log-work`);
    },
  })(previous, formData);
}

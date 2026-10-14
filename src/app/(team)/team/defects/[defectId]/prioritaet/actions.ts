"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prioritizeDefectCommand } from "@/modules/repair";
import { formAction, type FormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { requireTeamMember } from "../../../../../team-session";
import { prioritizeDefectFields, prioritizeDefectInput, type PrioritizeDefectField } from "./prioritize-defect-input";

export type PrioritizeDefectState = FormState<CommandError<typeof prioritizeDefectCommand>, PrioritizeDefectField>;

/**
 * CMD-PrioritizeDefect from the form „Priorität ändern“ (ST-027) – through the Server Action runner (ST-073), as the
 * signed-in team member. Afterwards the technician is on the defect's page, which confirms the new priority (G3). The
 * page binds the defect's ID; that only technicians prioritize, and only an open defect, is the command's.
 */
export async function prioritizeDefectAction(
  defectId: string,
  previous: PrioritizeDefectState,
  formData: FormData,
): Promise<PrioritizeDefectState> {
  await requireTeamMember(); // the page's access check
  return formAction(prioritizeDefectCommand, {
    fields: prioritizeDefectFields,
    input: (fields) => prioritizeDefectInput(fields, defectId),
    onSuccess: async (prioritized) => {
      revalidatePath("/team/defects");
      redirect(`/team/defects/${prioritized.defectId}?done=prioritize`);
    },
  })(previous, formData);
}

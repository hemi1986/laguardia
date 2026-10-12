"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { claimDefectCommand } from "@/modules/repair";
import { formAction, type FormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { requireTeamMember } from "../../../../../team-session";
import { assignDefectFields, assignDefectInput, type AssignDefectField } from "./assign-defect-input";

export type AssignDefectState = FormState<CommandError<typeof claimDefectCommand>, AssignDefectField>;

/**
 * CMD-ClaimDefect for someone else, from the form „Defekt zuweisen“ (ST-026) – through the Server Action runner
 * (ST-073), as the signed-in team member. Afterwards the technician is on the defect's page, which confirms the
 * assignment (G3). The page binds the defect's ID; that only technicians assign, and to whom, is the command's.
 */
export async function assignDefectAction(
  defectId: string,
  previous: AssignDefectState,
  formData: FormData,
): Promise<AssignDefectState> {
  await requireTeamMember(); // the page's access check
  return formAction(claimDefectCommand, {
    fields: assignDefectFields,
    input: (fields) => assignDefectInput(fields, defectId),
    onSuccess: async (assigned) => {
      revalidatePath("/team/defects");
      redirect(`/team/defects/${assigned.defectId}?done=assign`);
    },
  })(previous, formData);
}

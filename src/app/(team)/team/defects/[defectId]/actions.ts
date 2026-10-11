"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { claimDefectCommand } from "@/modules/repair";
import { formAction, type FormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { requireTeamMember } from "../../../../team-session";
import { claimDefectFields, claimDefectInput, type ClaimDefectField } from "./claim-defect-input";

export type ClaimDefectState = FormState<CommandError<typeof claimDefectCommand>, ClaimDefectField>;

/**
 * CMD-ClaimDefect from the defect's page (ST-025) – through the Server Action runner (ST-073), as the signed-in team
 * member. Afterwards the team member is on the defect's page again, which confirms the claim (G3). The page binds the
 * defect's ID; who may claim which defect is the command's.
 */
export async function claimDefectAction(
  defectId: string,
  previous: ClaimDefectState,
  formData: FormData,
): Promise<ClaimDefectState> {
  await requireTeamMember(); // the page's access check
  return formAction(claimDefectCommand, {
    fields: claimDefectFields,
    input: (fields) => claimDefectInput(fields, defectId),
    onSuccess: async () => {
      revalidatePath("/team/defects");
      redirect(`/team/defects/${defectId}?claimed=1`);
    },
  })(previous, formData);
}

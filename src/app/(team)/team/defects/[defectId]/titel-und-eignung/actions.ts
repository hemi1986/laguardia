"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { changeDefectDetailsCommand } from "@/modules/repair";
import { formAction, type FormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { requireTeamMember } from "../../../../../team-session";
import {
  changeDefectDetailsFields,
  changeDefectDetailsInput,
  type ChangeDefectDetailsField,
} from "./change-defect-details-input";

export type ChangeDefectDetailsState = FormState<
  CommandError<typeof changeDefectDetailsCommand>,
  ChangeDefectDetailsField
>;

/**
 * CMD-ChangeDefectDetails from the form „Titel und Eignung ändern“ (ST-031) – through the Server Action runner (ST-073),
 * as the signed-in team member. Afterwards the technician is on the defect's page, which confirms each change and a
 * released claim (G3). The page binds the defect's ID; that only technicians change it, and only an open defect, is the
 * command's.
 */
export async function changeDefectDetailsAction(
  defectId: string,
  previous: ChangeDefectDetailsState,
  formData: FormData,
): Promise<ChangeDefectDetailsState> {
  await requireTeamMember(); // the page's access check
  return formAction(changeDefectDetailsCommand, {
    fields: changeDefectDetailsFields,
    input: (fields) => changeDefectDetailsInput(fields, defectId),
    onSuccess: async (changed) => {
      revalidatePath("/team/defects");
      redirect(`/team/defects/${changed.defectId}?done=change-details`);
    },
  })(previous, formData);
}

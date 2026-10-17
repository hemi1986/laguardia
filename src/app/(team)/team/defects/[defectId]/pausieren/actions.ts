"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { putDefectOnHoldCommand } from "@/modules/repair";
import { formAction, type FormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { requireTeamMember } from "../../../../../team-session";
import { putDefectOnHoldFields, putDefectOnHoldInput, type PutDefectOnHoldField } from "./put-defect-on-hold-input";

export type PutDefectOnHoldState = FormState<CommandError<typeof putDefectOnHoldCommand>, PutDefectOnHoldField>;

/**
 * CMD-PutDefectOnHold from the form „Defekt pausieren“ (ST-029) – through the Server Action runner (ST-073), as the
 * signed-in team member. Afterwards they are on the defect's page, which confirms the hold with its reason (G3). The
 * page binds the defect's ID; who may put which defect on hold is the command's.
 */
export async function putDefectOnHoldAction(
  defectId: string,
  previous: PutDefectOnHoldState,
  formData: FormData,
): Promise<PutDefectOnHoldState> {
  await requireTeamMember(); // the page's access check
  return formAction(putDefectOnHoldCommand, {
    fields: putDefectOnHoldFields,
    input: (fields) => putDefectOnHoldInput(fields, defectId),
    onSuccess: async (held) => {
      revalidatePath("/team/defects");
      redirect(`/team/defects/${held.defectId}?done=put-on-hold`);
    },
  })(previous, formData);
}

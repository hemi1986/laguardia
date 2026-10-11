"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveDefectCommand } from "@/modules/repair";
import { formAction, type FormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { requireTeamMember } from "../../../../../team-session";
import { resolveDefectFields, resolveDefectInput, type ResolveDefectField } from "./resolve-defect-input";

export type ResolveDefectState = FormState<CommandError<typeof resolveDefectCommand>, ResolveDefectField>;

/**
 * CMD-ResolveDefect from the form „Defekt beheben“ (ST-028) – through the Server Action runner (ST-073), as the
 * signed-in team member. Afterwards the team member is on the defect's page, which confirms it and shows how the defect
 * ended (G3). The page binds the defect's ID; who may resolve which defect is the command's.
 */
export async function resolveDefectAction(
  defectId: string,
  previous: ResolveDefectState,
  formData: FormData,
): Promise<ResolveDefectState> {
  await requireTeamMember(); // the page's access check
  return formAction(resolveDefectCommand, {
    fields: resolveDefectFields,
    input: (fields) => resolveDefectInput(fields, defectId),
    onSuccess: async (resolved) => {
      revalidatePath("/team/defects");
      redirect(`/team/defects/${resolved.defectId}?done=resolve`);
    },
  })(previous, formData);
}

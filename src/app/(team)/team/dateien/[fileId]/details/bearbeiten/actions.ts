"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { changeFileDetailsCommand } from "@/modules/collection";
import { formAction } from "@/app/_actions/form-action";
import { requireTeamMember } from "@/app/team-session";
import { changeLanding } from "../file-origin";
import { changeFileDetailsForm, type ChangeFileDetailsState } from "./change-file-details-form";

/**
 * „Datei speichern“ on the form „Datei bearbeiten“ (CMD-ChangeFileDetails, ST-116) – through the Server Action runner. The
 * file and its origin are bound by the page. The team member lands on the file details with the confirmation (G3, G33),
 * also when nothing changed; every page showing the file is current. It makes no AI work – the title is not indexed.
 */
export async function changeFileDetailsAction(
  fileId: string,
  origin: string | undefined,
  previous: ChangeFileDetailsState,
  formData: FormData,
): Promise<ChangeFileDetailsState> {
  await requireTeamMember(); // the page's access check; who may correct is decided by the command
  return formAction(
    changeFileDetailsCommand,
    changeFileDetailsForm(fileId, async () => {
      revalidatePath("/team/machines/[museumNumber]", "page");
      revalidatePath("/team/museum-settings");
      redirect(changeLanding(fileId, origin));
    }),
  )(previous, formData);
}

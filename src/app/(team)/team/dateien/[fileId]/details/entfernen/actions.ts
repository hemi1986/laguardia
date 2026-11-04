"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { removeFileCommandWithAiIndex } from "@/modules/ai-assistance";
import { formAction } from "@/app/_actions/form-action";
import { database } from "@/platform/database";
import { requireTechnician } from "../../../../../../team-session";
import { originOf, removalLanding } from "../file-origin";
import { removeFileForm, type RemoveFileState } from "./remove-file-form";

/**
 * CMD-RemoveFile from „Endgültig entfernen“ (ST-121) – through the Server Action runner (ST-073), which deletes the
 * content from the storage after the commit. It is Collection's command with AI assistance's policy added (ST-106): the
 * file leaves the AI index in the same transaction. The technician lands where the file details' way back leads, with
 * the confirmation (G3); the page binds the origin and the file.
 */
export async function removeFileAction(
  origin: string | undefined,
  fileId: string,
  previous: RemoveFileState,
  formData: FormData,
): Promise<RemoveFileState> {
  const viewer = await requireTechnician(); // the page's access check; who may remove is the command's allowedActors
  const db = database();
  // Bound values come back like form fields: the origin is checked again against the closed set (G17).
  const checkedOrigin = await originOf(db, origin, viewer);
  return formAction(
    removeFileCommandWithAiIndex,
    removeFileForm(fileId, async () => {
      revalidatePath("/team/machines/[museumNumber]", "page");
      revalidatePath("/team/museum-settings");
      revalidatePath("/team/machines");
      redirect(removalLanding(checkedOrigin, fileId));
    }),
  )(previous, formData);
}

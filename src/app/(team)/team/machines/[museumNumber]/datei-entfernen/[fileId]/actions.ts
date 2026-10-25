"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { removeFileCommand } from "@/modules/collection";
import { formAction, type FormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { requireTechnician } from "../../../../../../team-session";
import { removeFileForm, type RemoveFileField } from "./remove-file-form";

export type RemoveFileState = FormState<CommandError<typeof removeFileCommand>, RemoveFileField>;

/**
 * CMD-RemoveFile from „Endgültig entfernen“ (ST-038) – through the Server Action runner (ST-073), which deletes the
 * content from the storage after the commit. Afterwards the technician is back on the machine record, which names the
 * removed file (G3). The page binds the machine's museum number and the file – the command checks the file again.
 */
export async function removeFileAction(
  museumNumber: string,
  fileId: string,
  previous: RemoveFileState,
  formData: FormData,
): Promise<RemoveFileState> {
  await requireTechnician(); // the page's access check; who may remove is the command's allowedActors
  const record = `/team/machines/${encodeURIComponent(museumNumber)}`;
  return formAction(
    removeFileCommand,
    removeFileForm(fileId, async () => {
      revalidatePath(record);
      redirect(`${record}?fileRemoved=${fileId}`);
    }),
  )(previous, formData);
}

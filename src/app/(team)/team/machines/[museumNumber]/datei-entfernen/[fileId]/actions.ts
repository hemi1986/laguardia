"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { machineFile, machineForTeamForm, removeFileCommand } from "@/modules/collection";
import { formAction, type FormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { database } from "@/platform/database";
import { requireTechnician } from "../../../../../../team-session";
import { removeFileForm, type RemoveFileField } from "./remove-file-form";

export type RemoveFileState = FormState<CommandError<typeof removeFileCommand>, RemoveFileField>;

/**
 * CMD-RemoveFile from „Endgültig entfernen“ (ST-038) – through the Server Action runner (ST-073), which deletes the
 * content from the storage after the commit. Afterwards the technician is back on the machine record, which names the
 * removed file (G3). The page binds the machine's museum number and the file.
 */
export async function removeFileAction(
  museumNumber: string,
  fileId: string,
  previous: RemoveFileState,
  formData: FormData,
): Promise<RemoveFileState> {
  await requireTechnician(); // the page's access check; who may remove is the command's allowedActors
  // Bound values come back like form fields: only a file of this machine's page, so the confirmation can name it.
  const db = database();
  const machine = await machineForTeamForm(db, museumNumber);
  if (!machine || !(await machineFile(db, { fileId, machineId: machine.id })))
    return { error: "not-found", values: { version: "" } };
  const record = `/team/machines/${encodeURIComponent(museumNumber)}`;
  return formAction(
    removeFileCommand,
    removeFileForm(fileId, async () => {
      // A file of the machine model leaves every machine record of that model.
      revalidatePath("/team/machines/[museumNumber]", "page");
      redirect(`${record}?fileRemoved=${fileId}`);
    }),
  )(previous, formData);
}

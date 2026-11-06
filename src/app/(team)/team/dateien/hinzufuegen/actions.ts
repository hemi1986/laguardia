"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addFileCommand } from "@/modules/collection";
import { formAction } from "@/app/_actions/form-action";
import { requireTeamMember } from "@/app/team-session";
import { fileDetailsAddress } from "../[fileId]/details/file-origin";
import { addFileForm } from "./add-file-form";

/**
 * CMD-AddFile from „Datei hinzufügen“ in the file overview (ST-119) – through the upload runner: the content was uploaded
 * when the file was chosen (ST-085), what the file is attached to is posted as one field. The team member lands on the
 * new file's details, which confirm it (G3). The runner starts the AI work once the command has committed
 * (POL-AttachedFileIsIndexedForAi, ADR 0018: adding the file makes AI work, attached or not).
 */
const addFile = formAction(
  addFileCommand,
  addFileForm(async ({ fileId }) => {
    revalidatePath("/team/dateien");
    redirect(fileDetailsAddress(fileId, "files", { added: true }));
  }),
);

export type AddFileState = Parameters<typeof addFile>[0];

export async function addFileAction(previous: AddFileState, formData: FormData): Promise<AddFileState> {
  await requireTeamMember(); // the page's access check; who may add is decided by the command
  return addFile(previous, formData);
}

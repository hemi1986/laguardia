"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { attachFileCommand } from "@/modules/collection";
import { uploadFormAction } from "@/app/_actions/form-action";
import { requireTeamMember } from "../../../../../team-session";
import { attachFileForm } from "./attach-file-form";

/**
 * CMD-AttachFile from the page that attaches a file (ST-037) – through the upload runner: the content was uploaded
 * when the file was chosen (ST-085). After attaching, the team member is back on the machine record, which names the
 * file (G3). The museum number is bound by the page; it only says where to land.
 */
const attachFile = (museumNumber: string) =>
  uploadFormAction(
    attachFileCommand,
    attachFileForm(async ({ fileId }) => {
      const record = `/team/machines/${encodeURIComponent(museumNumber)}`;
      revalidatePath(record);
      redirect(`${record}?attached=${fileId}`);
    }),
  );

export type AttachFileState = Parameters<ReturnType<typeof attachFile>>[0];

export async function attachFileAction(
  museumNumber: string,
  previous: AttachFileState,
  formData: FormData,
): Promise<AttachFileState> {
  await requireTeamMember(); // the page's access check; who may attach is decided by the command
  return attachFile(museumNumber)(previous, formData);
}

"use server";

import { redirect } from "next/navigation";
import { attachFileCommand } from "@/modules/collection";
import { formAction } from "@/app/_actions/form-action";
import { requireTeamMember } from "@/app/team-session";
import { attachLanding } from "../../../file-navigation";
import { attachToFileForm, type AttachToFileState } from "./attach-to-file-form";

/**
 * „Anhängen“ on the file details (CMD-AttachFile, ST-115): the file is bound by the page, the choice is posted as one
 * field. The team member lands on the file details, which say what the file is attached to now (G3, G33). The runner
 * starts no AI work – attaching makes none (ADR 0018).
 */
const attach = (fileId: string, origin: string | undefined) =>
  formAction(
    attachFileCommand,
    attachToFileForm(fileId, async () => redirect(attachLanding(fileId, origin))),
  );

export async function attachToFileAction(
  fileId: string,
  origin: string | undefined,
  previous: AttachToFileState,
  formData: FormData,
): Promise<AttachToFileState> {
  await requireTeamMember(); // the page's access check; who may attach is decided by the command
  return attach(fileId, origin)(previous, formData);
}

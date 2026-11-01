"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { attachFileCommand } from "@/modules/collection";
import { formAction } from "@/app/_actions/form-action";
import { startAiWorkAfterResponse } from "@/app/ai-work";
import { requireTeamMember } from "../../../../../team-session";
import { attachPhotoForm } from "./attach-photo-form";

/**
 * CMD-AttachFile with a camera photo (ST-054) – through the runner's photo step: the photo is stored through the photo
 * module and deleted again when the command rejects it. After attaching, the team member is back on the machine
 * record, which names the file (G3). The machine is bound by the page – the command checks it (`attachingFacts`).
 * Once the command has committed, the AI work is started after the response (POL-AttachedFileIsIndexedForAi, ST-106);
 * this page attaches a file like the upload page, so it starts the work the same way.
 */
const attachPhoto = (museumNumber: string) =>
  formAction(
    attachFileCommand,
    attachPhotoForm(async ({ fileId }) => {
      const record = `/team/machines/${encodeURIComponent(museumNumber)}`;
      revalidatePath(record);
      startAiWorkAfterResponse();
      redirect(`${record}?attached=${fileId}`);
    }),
  );

export type AttachPhotoState = Parameters<ReturnType<typeof attachPhoto>>[0];

export async function attachPhotoAction(
  machine: { id: string; museumNumber: string },
  previous: AttachPhotoState,
  formData: FormData,
): Promise<AttachPhotoState> {
  await requireTeamMember(); // the page's access check; who may attach is decided by the command
  formData.set("machineId", machine.id);
  return attachPhoto(machine.museumNumber)(previous, formData);
}

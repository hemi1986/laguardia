"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addFileCommand } from "@/modules/collection";
import { formAction } from "@/app/_actions/form-action";
import { requireTeamMember } from "../../../../../team-session";
import { attachPhotoForm } from "./attach-photo-form";

/**
 * CMD-AddFile with a camera photo (ST-054, ST-113) – through the runner's photo step: the photo is stored through the photo
 * module and deleted again when the command rejects it. After attaching, the team member is back on the machine
 * record, which names the file (G3). The machine and its machine model are bound by the page – the command checks them (`addingFacts`).
 * The runner starts the AI work once the command has committed (POL-AttachedFileIsIndexedForAi, ADR 0018).
 */
const attachPhoto = (museumNumber: string) =>
  formAction(
    addFileCommand,
    attachPhotoForm(async ({ fileId }) => {
      const record = `/team/machines/${encodeURIComponent(museumNumber)}`;
      revalidatePath(record);
      redirect(`${record}?attached=${fileId}`);
    }),
  );

export type AttachPhotoState = Parameters<ReturnType<typeof attachPhoto>>[0];

export async function attachPhotoAction(
  machine: { id: string; machineModelId: string; museumNumber: string },
  previous: AttachPhotoState,
  formData: FormData,
): Promise<AttachPhotoState> {
  await requireTeamMember(); // the page's access check; who may attach is decided by the command
  formData.set("machineId", machine.id);
  formData.set("machineModelId", machine.machineModelId);
  return attachPhoto(machine.museumNumber)(previous, formData);
}

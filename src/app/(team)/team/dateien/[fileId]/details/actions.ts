"use server";

import { redirect } from "next/navigation";
import { aiDependencies, retryFileIndexingCommand } from "@/modules/ai-assistance";
import { detachFileCommand } from "@/modules/collection";
import { formAction } from "@/app/_actions/form-action";
import { requireTeamMember } from "@/app/team-session";
import {
  retryFileIndexingForm,
  type RetryFileIndexingState,
} from "@/app/(team)/team/museum-settings/retry-file-indexing-definition";
import { attachmentTargetValue } from "./file-attachments";
import { detachFileForm, type DetachFileState } from "./detach-file-form";
import { detachLanding, fileDetailsAddress } from "./file-origin";

/**
 * „Erneut versuchen“ on the file details (ST-114): the same CMD-IndexFileForAi by hand as on the form „KI“, through the
 * Server Action runner as the signed-in team member – a helper is refused by the command (`not-authorized`), AI off by
 * its rule. The runner starts the AI work after the commit (ADR 0015); the person stays on the details with the
 * confirmation (G3), the origin kept (G17).
 */
export async function retryFileFromDetailsAction(
  origin: string | undefined,
  previous: RetryFileIndexingState,
  formData: FormData,
): Promise<RetryFileIndexingState> {
  await requireTeamMember(); // the page's access check; who may run the command is decided by its allowedActors
  const retry = formAction(
    retryFileIndexingCommand(aiDependencies()),
    retryFileIndexingForm(async ({ fileId }) => redirect(fileDetailsAddress(fileId, origin, { retried: true }))),
  );
  return retry(previous, formData);
}

/**
 * „Lösen“ on the file details (CMD-DetachFile, ST-115, G10a): one tap, no question. The file and its origin are bound by
 * the page, the target is posted. The technician lands on the file details with the confirmation that names the target
 * (G3); the runner starts no AI work – detaching makes none (ADR 0018).
 */
const detach = (fileId: string, origin: string | undefined) =>
  formAction(
    detachFileCommand,
    detachFileForm(fileId, async ({ target }) =>
      redirect(detachLanding(fileId, origin, attachmentTargetValue(target))),
    ),
  );

export async function detachFileFromDetailsAction(
  fileId: string,
  origin: string | undefined,
  previous: DetachFileState,
  formData: FormData,
): Promise<DetachFileState> {
  await requireTeamMember(); // the page's access check; who may detach is decided by the command
  return detach(fileId, origin)(previous, formData);
}

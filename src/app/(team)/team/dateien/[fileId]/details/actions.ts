"use server";

import { redirect } from "next/navigation";
import { aiDependencies, retryFileIndexingCommand } from "@/modules/ai-assistance";
import { formAction } from "@/app/_actions/form-action";
import { requireTeamMember } from "@/app/team-session";
import {
  retryFileIndexingForm,
  type RetryFileIndexingState,
} from "@/app/(team)/team/museum-settings/retry-file-indexing-definition";
import { fileDetailsAddress } from "./file-origin";

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

"use server";

import { redirect } from "next/navigation";
import { aiDependencies, retryFileIndexingCommand } from "@/modules/ai-assistance";
import { formAction } from "@/app/_actions/form-action";
import { requireTechnician } from "../../../team-session";
import { retriedLanding, retryFileIndexingForm, type RetryFileIndexingState } from "./retry-file-indexing-definition";

/**
 * „Erneut versuchen“ on a failed file (ST-109): CMD-IndexFileForAi by hand through the Server Action runner as the
 * signed-in technician. The runner starts the AI work once it has committed – the file is waiting again (ADR 0015) – and
 * the technician stays on „Einstellungen“ with the confirmation (G3).
 */
const retryFileIndexing = formAction(
  retryFileIndexingCommand(aiDependencies()),
  retryFileIndexingForm(async ({ fileId }) => redirect(retriedLanding(fileId))),
);

export async function retryFileIndexingAction(
  previous: RetryFileIndexingState,
  formData: FormData,
): Promise<RetryFileIndexingState> {
  await requireTechnician(); // the page's access check; who may run the command is decided by its allowedActors
  return retryFileIndexing(previous, formData);
}

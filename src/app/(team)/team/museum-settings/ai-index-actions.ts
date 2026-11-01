"use server";

import { redirect } from "next/navigation";
import { aiDependencies, retryFileIndexingCommand } from "@/modules/ai-assistance";
import { formAction } from "@/app/_actions/form-action";
import { startAiWorkAfterResponse } from "@/app/ai-work";
import { requireTechnician } from "../../../team-session";
import { retriedLanding, retryFileIndexingForm, type RetryFileIndexingState } from "./retry-file-indexing-definition";

/**
 * „Erneut versuchen“ on a failed file (ST-109): CMD-IndexFileForAi by hand through the Server Action runner as the
 * signed-in technician. Once it has committed – the file is waiting again – the AI work is started after the response
 * (ADR 0015), and the technician stays on „Einstellungen“ with the confirmation (G3).
 */
const retryFileIndexing = formAction(
  retryFileIndexingCommand(aiDependencies()),
  retryFileIndexingForm(async ({ fileId }) => {
    startAiWorkAfterResponse();
    redirect(retriedLanding(fileId));
  }),
);

export async function retryFileIndexingAction(
  previous: RetryFileIndexingState,
  formData: FormData,
): Promise<RetryFileIndexingState> {
  await requireTechnician(); // the page's access check; who may run the command is decided by its allowedActors
  return retryFileIndexing(previous, formData);
}

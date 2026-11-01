"use server";

import { redirect } from "next/navigation";
import { aiAssessmentRetryRequest, aiDependencies, requestAiAssessmentCommand } from "@/modules/ai-assistance";
import { formAction, type PhotoFormState } from "@/app/_actions/form-action";
import { startAiWorkAfterResponse } from "@/app/ai-work";
import { database } from "@/platform/database";
import { requireTeamMember } from "../../../../../team-session";
import {
  aiAssessmentLanding,
  requestAiAssessmentForm,
  type RequestAiAssessmentField,
  type RequestAiAssessmentFormError,
} from "./request-ai-assessment-definition";
import { retryAiAssessmentForm, type RetryAiAssessmentState } from "./retry-ai-assessment-definition";

export type RequestAiAssessmentState = PhotoFormState<RequestAiAssessmentFormError, RequestAiAssessmentField>;

/**
 * CMD-RequestAiAssessment from the form „KI-Einschätzung anfordern“ (ST-107): the page's access check, the command
 * through the Server Action runner as the signed-in team member, back on the defect page at once. Once the command has
 * committed, the AI work is started after the response (POL-RequestedAiAssessmentIsWritten, ADR 0015).
 */
export async function requestAiAssessmentAction(
  defectId: string,
  previous: RequestAiAssessmentState,
  formData: FormData,
): Promise<RequestAiAssessmentState> {
  await requireTeamMember(); // the page's access check; who may request is decided by the command
  return formAction(
    requestAiAssessmentCommand(aiDependencies()),
    requestAiAssessmentForm({
      defectId,
      onSuccess: async () => {
        startAiWorkAfterResponse();
        redirect(aiAssessmentLanding(defectId));
      },
    }),
  )(previous, formData);
}

/**
 * „Erneut versuchen“ (ST-108): one tap asks CMD-RequestAiAssessment again with the failed AI assessment's note and
 * photos – read on the server, never from the browser. The failed one stays as it is; the new one starts writing after
 * the response (POL-RequestedAiAssessmentIsWritten, ADR 0015). A stale button – nothing failed any more – asks nothing
 * twice and lands on the defect page, which shows what is there now.
 */
export async function retryAiAssessmentAction(
  defectId: string,
  previous: RetryAiAssessmentState,
  formData: FormData,
): Promise<RetryAiAssessmentState> {
  await requireTeamMember(); // the page's access check; who may request is decided by the command
  const input = await aiAssessmentRetryRequest(database(), defectId);
  if (!input) return redirect(aiAssessmentLanding(defectId));
  return formAction(
    requestAiAssessmentCommand(aiDependencies()),
    retryAiAssessmentForm({
      input,
      onSuccess: async () => {
        startAiWorkAfterResponse();
        redirect(aiAssessmentLanding(defectId));
      },
    }),
  )(previous, formData);
}

"use server";

import { redirect } from "next/navigation";
import { aiDependencies, requestAiAssessmentCommand } from "@/modules/ai-assistance";
import { formAction, type PhotoFormState } from "@/app/_actions/form-action";
import { startAiWorkAfterResponse } from "@/app/ai-work";
import { requireTeamMember } from "../../../../../team-session";
import {
  aiAssessmentLanding,
  requestAiAssessmentForm,
  type RequestAiAssessmentField,
  type RequestAiAssessmentFormError,
} from "./request-ai-assessment-definition";

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

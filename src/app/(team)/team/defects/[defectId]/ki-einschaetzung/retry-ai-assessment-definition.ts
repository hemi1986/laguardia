import type { FormDefinition, FormState } from "@/app/_actions/form-action";
import { requestAiAssessmentCommand, type RequestAiAssessmentInput } from "@/modules/ai-assistance";
import type { CommandError } from "@/platform/command";

type RequestAiAssessmentCommand = ReturnType<typeof requestAiAssessmentCommand>;

/** The command's own reasons and the command layer's – what a retry can be rejected with. */
export type RetryAiAssessmentFormError = CommandError<RequestAiAssessmentCommand>;

/** What a rejected „Erneut versuchen“ answers: the rejection, and no field to keep – the form has none. */
export type RetryAiAssessmentState = FormState<RetryAiAssessmentFormError, never>;

/**
 * „Erneut versuchen“ (ST-108): one tap asks CMD-RequestAiAssessment again with the failed AI assessment's note and
 * photos, read on the server (`aiAssessmentRetryRequest`) – no request form in between. The form has no fields: the
 * input is what the failed one carried. It is a plain module so a test can run the real Server Action runner with it.
 */
export function retryAiAssessmentForm({
  input,
  onSuccess,
}: {
  input: RequestAiAssessmentInput;
  onSuccess: (result: { aiAssessmentId: string }) => Promise<void>;
}): FormDefinition<RequestAiAssessmentInput, { aiAssessmentId: string }, never> {
  return { fields: [], input: () => input, onSuccess };
}

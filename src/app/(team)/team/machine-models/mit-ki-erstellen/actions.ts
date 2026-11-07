"use server";

import { redirect } from "next/navigation";
import { aiDependencies, requestAiModelProposalCommand } from "@/modules/ai-assistance";
import { formAction, type FormState } from "@/app/_actions/form-action";
import { requireTechnician } from "../../../../team-session";
import {
  aiModelProposalAddress,
  requestAiModelProposalForm,
  type RequestAiModelProposalField,
  type RequestAiModelProposalFormError,
} from "./request-ai-model-proposal-definition";

export type RequestAiModelProposalState = FormState<RequestAiModelProposalFormError, RequestAiModelProposalField>;

/**
 * CMD-RequestAiModelProposal from the page „Mit KI erstellen“ (ST-123): the page's access check, the command through
 * the Server Action runner as the signed-in technician, then the proposal's own page at once (G35). The runner starts
 * the AI work once the command has committed (POL-RequestedAiModelProposalIsWritten, ADR 0015, ST-124).
 */
export async function requestAiModelProposalAction(
  previous: RequestAiModelProposalState,
  formData: FormData,
): Promise<RequestAiModelProposalState> {
  await requireTechnician(); // the page's access check; who may request is decided by the command
  return formAction(
    requestAiModelProposalCommand(aiDependencies()),
    requestAiModelProposalForm({
      onSuccess: async ({ aiModelProposalId }) => redirect(aiModelProposalAddress(aiModelProposalId)),
    }),
  )(previous, formData);
}

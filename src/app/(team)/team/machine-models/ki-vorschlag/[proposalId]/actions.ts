"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acceptAiModelProposalCommand } from "@/modules/ai-assistance";
import { formAction } from "@/app/_actions/form-action";
import { requireTechnician } from "../../../../../team-session";
import { aiModelProposalAddress } from "../../mit-ki-erstellen/request-ai-model-proposal-definition";
import { acceptAiModelProposalForm } from "./accept-ai-model-proposal-definition";

const acceptAiModelProposal = formAction(
  acceptAiModelProposalCommand,
  acceptAiModelProposalForm({
    onSuccess: async ({ aiModelProposalId }) => {
      revalidatePath("/team/machine-models");
      // The proposal's page now says „Gespeichert“ and names the machine model (G3).
      redirect(aiModelProposalAddress(aiModelProposalId));
    },
  }),
);

export type AcceptAiModelProposalState = Awaited<ReturnType<typeof acceptAiModelProposal>>;

/**
 * CMD-AcceptAiModelProposal from „Speichern“ on the written proposal's page (ST-128): the page's access check, then the
 * command through the Server Action runner as the signed-in technician – the machine model, its attached files and the
 * accepted proposal in one transaction (ADR 0019).
 */
export async function acceptAiModelProposalAction(
  previous: AcceptAiModelProposalState,
  formData: FormData,
): Promise<AcceptAiModelProposalState> {
  await requireTechnician(); // the page's access check; who may accept is decided by the command
  return acceptAiModelProposal(previous, formData);
}

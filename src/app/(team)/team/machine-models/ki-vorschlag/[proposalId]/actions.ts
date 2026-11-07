"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acceptAiModelProposalCommand, discardAiModelProposalCommand } from "@/modules/ai-assistance";
import { formAction } from "@/app/_actions/form-action";
import { requireTechnician } from "../../../../../team-session";
import { aiModelProposalAddress } from "../../mit-ki-erstellen/request-ai-model-proposal-definition";
import { acceptAiModelProposalForm } from "./accept-ai-model-proposal-definition";
import { discardAiModelProposalForm, discardedLanding } from "./discard-ai-model-proposal-definition";

import { ALREADY_SAVED } from "./document-fields";

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
  const state = await acceptAiModelProposal(previous, formData);
  // Saved a moment ago by someone else: the page now shows the saved proposal and no form, which would take the
  // rejection with it – so it is said on that page (G8a; the form has nothing left to keep).
  if (state?.error === "ai-model-proposal-already-accepted") {
    redirect(`${aiModelProposalAddress(String(formData.get("aiModelProposalId") ?? ""))}?${ALREADY_SAVED}=1`);
  }
  return state;
}

const discardAiModelProposal = formAction(
  discardAiModelProposalCommand,
  discardAiModelProposalForm({
    onSuccess: async ({ aiModelProposalId }) => {
      revalidatePath("/team/machine-models");
      redirect(discardedLanding(aiModelProposalId));
    },
  }),
);

export type DiscardAiModelProposalState = Awaited<ReturnType<typeof discardAiModelProposal>>;

/**
 * CMD-DiscardAiModelProposal from „Verwerfen“ on a written or failed proposal's page (ST-127): the page's access check,
 * then the command through the Server Action runner; the technician lands on the machine models page (G3). A proposal
 * saved a moment ago by someone else is answered like in „Speichern“: the page now shows what was created.
 */
export async function discardAiModelProposalAction(
  previous: DiscardAiModelProposalState,
  formData: FormData,
): Promise<DiscardAiModelProposalState> {
  await requireTechnician(); // the page's access check; who may discard is decided by the command
  const state = await discardAiModelProposal(previous, formData);
  if (state?.error === "ai-model-proposal-already-accepted") {
    redirect(`${aiModelProposalAddress(String(formData.get("aiModelProposalId") ?? ""))}?${ALREADY_SAVED}=1`);
  }
  return state;
}

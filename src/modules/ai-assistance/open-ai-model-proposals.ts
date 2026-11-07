import type { Database } from "@/platform/command";
import { requestRefusal, type RequestAiModelProposalError } from "./ai-model-proposal";
import { aiModelProposalById, openAiModelProposalStates } from "./ai-model-proposals";
import type { AiDependencies } from "./ai-settings";
import { requestAiModelProposalFacts } from "./request-ai-model-proposal-command";

/**
 * RM-AiModelProposals (ST-123): the section „KI-Vorschläge“ of the machine models page – every open AI model proposal
 * with its description and state, the newest first – and whether to offer „Mit KI erstellen“. The button is offered
 * only while AI is on; with AI off it is absent, not disabled, and the section shows only what is open (G37). A running
 * proposal does not take the button away: the request is rejected with the reason instead, and the form keeps what was
 * typed (G8a).
 */
export type OpenAiModelProposals = {
  requestOffered: boolean;
  proposals: { id: string; description: string; state: "requested" | "written" | "failed" }[];
};

export async function openAiModelProposals(db: Database, dependencies: AiDependencies): Promise<OpenAiModelProposals> {
  const [facts, open] = await Promise.all([
    requestAiModelProposalFacts(db, dependencies),
    openAiModelProposalStates(db),
  ]);
  return {
    requestOffered: requestRefusal(facts) !== "ai-model-proposal-ai-off",
    proposals: open,
  };
}

/** Why the form „Mit KI erstellen“ would refuse any description now – none when it would not. */
export async function aiModelProposalRefusal(
  db: Database,
  dependencies: AiDependencies,
): Promise<RequestAiModelProposalError | undefined> {
  return requestRefusal(await requestAiModelProposalFacts(db, dependencies), undefined);
}

/** The AI model proposal's page (ST-123: while it is being written; ST-124, ST-126: written and failed). */
export async function aiModelProposalPage(db: Database, id: string) {
  const proposal = await aiModelProposalById(db, id);
  return proposal && { id: proposal.id, description: proposal.description, state: proposal.state };
}

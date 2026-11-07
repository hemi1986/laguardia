import { aggregateCommand, entriesOf, type JournalEntry } from "@/platform/command";
import type { DiscardAiModelProposalInput } from "./discard-ai-model-proposal";
import { discardAiModelProposal, discardingActors } from "./discard-ai-model-proposal";
import { aiModelProposals } from "./ai-model-proposals";
import { aiAssistanceEvents } from "./events";

/** CMD-DiscardAiModelProposal through the command layer (ST-127): a changing command at the version the technician saw. */
export const discardAiModelProposalCommand = aggregateCommand({
  id: "CMD-DiscardAiModelProposal",
  allowedActors: discardingActors,
  store: aiModelProposals,
  target: (input: DiscardAiModelProposalInput) => ({ id: input.aiModelProposalId, version: input.version }),
  decide: discardAiModelProposal,
  journal: aiAssistanceEvents.journal,
  result: (state) => ({ aiModelProposalId: state.id }),
});

/**
 * Whether the latest command on this AI model proposal was its discarding – for the confirmation „KI-Vorschlag verworfen.“
 * after the redirect (G3): the address alone confirms nothing, the journal says it (the caller has checked that the
 * viewer ran that command).
 */
export function aiModelProposalDiscardedIn(command: readonly JournalEntry[], aiModelProposalId: string): boolean {
  return entriesOf(aiAssistanceEvents, command).some(
    (entry) => entry.type === "EVT-AiModelProposalDiscarded" && entry.aggregate.id === aiModelProposalId,
  );
}

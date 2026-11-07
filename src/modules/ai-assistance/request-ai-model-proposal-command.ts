import { aggregateCommand, type Database } from "@/platform/command";
import { requestAiModelProposal, type RequestAiModelProposalFacts } from "./ai-model-proposal";
import { aiModelProposalBeingWritten, aiModelProposals } from "./ai-model-proposals";
import { aiState, type AiDependencies } from "./ai-settings";
import { aiAssistanceEvents } from "./events";

/** What the request's rule reads – in the command's facts, and for the page that asks the same rule (G11, G37). */
export async function requestAiModelProposalFacts(
  db: Database,
  dependencies: Pick<AiDependencies, "encryptionKey">,
): Promise<RequestAiModelProposalFacts> {
  const [aiNow, beingWritten] = await Promise.all([aiState(db, dependencies), aiModelProposalBeingWritten(db)]);
  return { chatModel: aiNow.on ? aiNow.chatModel : undefined, beingWritten };
}

/**
 * CMD-RequestAiModelProposal through the command layer (ST-123): a creating command on AGG-AiModelProposal for
 * technicians. Its facts read the AI settings and whether one is being written; the store's partial unique index backs
 * the set-based rule HS-37.
 */
export function requestAiModelProposalCommand(dependencies: AiDependencies) {
  return aggregateCommand({
    id: "CMD-RequestAiModelProposal",
    allowedActors: ["technician"],
    store: aiModelProposals,
    creates: true,
    facts: (tx) => requestAiModelProposalFacts(tx, dependencies),
    decide: requestAiModelProposal,
    journal: aiAssistanceEvents.journal,
    result: ({ id }) => ({ aiModelProposalId: id }),
  });
}

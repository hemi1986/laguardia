import { aggregateCommand } from "@/platform/command";
import { aiModelProposals } from "./ai-model-proposals";
import { aiAssistanceEvents } from "./events";
import { retryProposedDocument, retryingActors, type RetryProposedDocumentInput } from "./retry-proposed-document";

/**
 * CMD-RetryProposedDocument through the command layer (ST-130): a changing command at the version the technician saw;
 * its event makes AI work (`makesAiWork`), so the runner starts the loading after the response.
 */
export const retryProposedDocumentCommand = aggregateCommand({
  id: "CMD-RetryProposedDocument",
  allowedActors: retryingActors,
  store: aiModelProposals,
  target: (input: RetryProposedDocumentInput) => ({ id: input.aiModelProposalId, version: input.version }),
  decide: retryProposedDocument,
  journal: aiAssistanceEvents.journal,
  result: (state) => ({ aiModelProposalId: state.id }),
});

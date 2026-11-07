import { addFileCommand } from "@/modules/collection";
import { aggregateCommand, run } from "@/platform/command";
import type { AiModelProposalState } from "./ai-model-proposal";
import { aiModelProposals } from "./ai-model-proposals";
import { aiAssistanceEvents } from "./events";
import { loadProposedDocument, loadingActors, type LoadProposedDocumentInput } from "./load-proposed-document";

/**
 * CMD-LoadProposedDocument through the command layer (ST-129, ADR 0019): run by the background work as the system, in the
 * short transaction that ends the piece's hold (ADR 0015). The row is loaded with a lock – nobody saw a version – and only
 * a link still waiting is recorded. A loaded link is added as a file by Collection's CMD-AddFile in the same transaction,
 * attached to the machine model the proposal created, **on behalf of the technician who asked for the proposal**: a file has
 * an „added by“ that must be a team member, and the system is none (`run … as`). Works while AI is off – the AI index
 * follows the added file like any other (POL-AttachedFileIsIndexedForAi).
 */
export const loadProposedDocumentCommand = aggregateCommand({
  id: "CMD-LoadProposedDocument",
  allowedActors: loadingActors,
  store: aiModelProposals,
  target: (input: LoadProposedDocumentInput) => ({ id: input.aiModelProposalId }),
  decide: loadProposedDocument,
  journal: aiAssistanceEvents.journal,
  runs: (state: AiModelProposalState, _events, input) => {
    const document = state.documents?.[input.index];
    if (input.outcome.kind !== "loaded" || document?.kind !== "link" || !document.fileId) return [];
    return [
      run(
        addFileCommand,
        {
          id: document.fileId,
          title: document.title,
          fileCategory: document.fileCategory,
          originalFileName: input.outcome.originalFileName,
          machineIds: [],
          machineModelIds: [state.machineModelId!],
          content: input.outcome.content,
        },
        { as: { kind: "team-member", teamMemberId: state.requestedBy, role: "technician" } },
      ),
    ];
  },
  result: () => ({}),
});

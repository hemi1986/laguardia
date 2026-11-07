import { attachFileCommand, createMachineModelCommand, filesForAiReferences } from "@/modules/collection";
import { aggregateCommand, run } from "@/platform/command";
import {
  acceptAiModelProposal,
  acceptingActors,
  chosenDocuments,
  existingFileIds,
  type AcceptAiModelProposalInput,
} from "./accept-ai-model-proposal";
import type { AiModelProposalState } from "./ai-model-proposal";
import { aiModelProposals } from "./ai-model-proposals";
import { aiAssistanceEvents } from "./events";

/**
 * CMD-AcceptAiModelProposal through the command layer (ST-128, ADR 0019): a changing command on AGG-AiModelProposal at
 * the version the technician saw. After saving it runs Collection's CMD-CreateMachineModel and, for each chosen existing
 * file, CMD-AttachFile – as the same technician, in the same transaction (`runs`), so a rejection of any of them stores
 * nothing. The machine model's ID is the one the decision generated and put on the accepted proposal. The chosen links
 * are loaded afterwards (ST-129). Needs no AI: accepting reads no setting.
 */
export const acceptAiModelProposalCommand = aggregateCommand({
  id: "CMD-AcceptAiModelProposal",
  allowedActors: acceptingActors,
  store: aiModelProposals,
  target: (input: AcceptAiModelProposalInput) => ({ id: input.aiModelProposalId, version: input.version }),
  facts: async (tx, _input, state: AiModelProposalState) => {
    // Read after the proposal is loaded: which of its existing files were removed since it was written (HS-38).
    const files = await filesForAiReferences(tx, existingFileIds(state));
    return { removedFileIds: new Set([...files].flatMap(([id, file]) => (file.removed ? [id] : []))) };
  },
  decide: acceptAiModelProposal,
  journal: aiAssistanceEvents.journal,
  runs: (state, _events, input) => {
    const machineModelId = state.machineModelId!;
    return [
      run(createMachineModelCommand, { ...input.machineModel, id: machineModelId }),
      ...chosenDocuments(state).flatMap((document) =>
        document.kind === "file"
          ? [run(attachFileCommand, { fileId: document.fileId, machineIds: [], machineModelIds: [machineModelId] })]
          : [],
      ),
    ];
  },
  result: (state) => ({ aiModelProposalId: state.id, machineModelId: state.machineModelId! }),
});

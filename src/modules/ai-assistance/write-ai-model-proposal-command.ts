import { aggregateCommand } from "@/platform/command";
import {
  failAiModelProposal,
  writeAiModelProposal,
  type AiModelProposalFailureReason,
  type WriteAiModelProposalInput,
} from "./ai-model-proposal";
import { aiModelProposals } from "./ai-model-proposals";
import { aiAssistanceEvents } from "./events";

/**
 * CMD-WriteAiModelProposal through the command layer (ST-124): run by POL-RequestedAiModelProposalIsWritten as the
 * system, in the short transaction that ends the background work's hold (ADR 0015). The row is loaded with a lock – a
 * run of a person saw no version – and only a proposal still requested is written: a late result after it was failed
 * as broken off records nothing (rule). The failing half is ST-126.
 */
export type WriteAiModelProposalCommandInput = WriteAiModelProposalInput & { aiModelProposalId: string };

export const writeAiModelProposalCommand = aggregateCommand({
  id: "CMD-WriteAiModelProposal",
  allowedActors: ["system"],
  store: aiModelProposals,
  target: (input: WriteAiModelProposalCommandInput) => ({ id: input.aiModelProposalId }),
  decide: writeAiModelProposal,
  journal: aiAssistanceEvents.journal,
  result: () => ({}),
});

/** The same command's failure half (ST-126): EVT-AiModelProposalFailed with one of the domain's reasons. */
export type FailAiModelProposalCommandInput = { aiModelProposalId: string; reason: AiModelProposalFailureReason };

export const failAiModelProposalCommand = aggregateCommand({
  id: "CMD-WriteAiModelProposal",
  allowedActors: ["system"],
  store: aiModelProposals,
  target: (input: FailAiModelProposalCommandInput) => ({ id: input.aiModelProposalId }),
  decide: (state, input, context) => failAiModelProposal(state, input.reason, context),
  journal: aiAssistanceEvents.journal,
  result: () => ({}),
});

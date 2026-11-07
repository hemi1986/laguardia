import { executeCommand } from "@/platform/command";
import { aiModelProposalById, requestedAiModelProposalIds } from "./ai-model-proposals";
import { aiModelProposalChatRequest, answerOfChat } from "./ai-model-proposal-writing";
import type { AiWorkKind } from "./ai-work";
import { writeAiModelProposalCommand } from "./write-ai-model-proposal-command";

/**
 * Writing an AI model proposal as a kind of the background work (ST-124, ADR 0015, ADR 0020,
 * POL-RequestedAiModelProposalIsWritten). A run takes one whole proposal: one chat request with the web tools, outside
 * any transaction, and only the storage of the answer is one short transaction that ends the hold. The chat model is the
 * one the proposal was requested with, never the one saved since.
 *
 * Only the happy path is built here: an answer that cannot be stored (OpenRouter's failures, an answer that is not the
 * agreed form, AI turned off, a break-off) gives the piece up and records nothing. Failing it with a reason comes with
 * ST-126.
 */
const AI_MODEL_PROPOSAL_KIND = "ai-model-proposal";

export const aiModelProposalWork: AiWorkKind = {
  kind: AI_MODEL_PROPOSAL_KIND,

  /** The proposals still requested – a person is waiting, so a run takes them before waiting files. */
  waiting(db) {
    return requestedAiModelProposalIds(db);
  },

  async isWaiting(tx, id) {
    return (await aiModelProposalById(tx, id))?.state === "requested";
  },

  async work(id, piece, context) {
    const proposal = await aiModelProposalById(context.db, id);
    if (!proposal || proposal.state !== "requested") return piece.giveUp();
    const answer = answerOfChat(
      await piece.openRouter.chat(proposal.chatModel, aiModelProposalChatRequest(proposal.description)),
    );
    // ST-126: stopped, a failure of OpenRouter and an unusable answer fail the proposal with their reason.
    if (answer === "stopped" || answer === "unusable" || "failure" in answer) return piece.giveUp();
    await piece.storeResult((tx) =>
      executeCommand(
        writeAiModelProposalCommand,
        { aiModelProposalId: id, answer, cost: piece.openRouter.spent() },
        { actor: { kind: "system" }, db: tx, clock: context.clock },
      ),
    );
  },

  /** ST-126 records the proposal failed as *broken off*; until then a break-off leaves it as it is. */
  async recordBrokenOff() {},
};

import type { Clock } from "@/platform/clock";
import { executeCommand, type Database } from "@/platform/command";
import { filesForAiModelProposal } from "@/modules/collection";
import { aiModelProposalById, requestedAiModelProposalIds } from "./ai-model-proposals";
import {
  MAX_PROPOSED_DOCUMENTS,
  deviceRecognised,
  proposedFileCategories,
  type AiModelProposalAnswer,
  type AiModelProposalFailureReason,
  type FoundFile,
} from "./ai-model-proposal";
import { aiModelProposalChatRequest, answerOfChat, existingFilesSearchText } from "./ai-model-proposal-writing";
import { failureOfEmbedding } from "./ai-assessment-writing";
import { searchAiIndex } from "./ai-index-search";
import { aiState } from "./ai-settings";
import { aiWorkLeftUnfinished, type AiWorkContext, type AiWorkKind, type HeldPiece } from "./ai-work";
import type { OpenRouterSession } from "./open-router-session";
import { failAiModelProposalCommand, writeAiModelProposalCommand } from "./write-ai-model-proposal-command";

/**
 * Writing an AI model proposal as a kind of the background work (ST-124, ADR 0015, ADR 0020,
 * POL-RequestedAiModelProposalIsWritten). A run takes one whole proposal: one chat request with the web tools, outside
 * any transaction, and only the storage of the answer is one short transaction that ends the hold. The chat model is the
 * one the proposal was requested with, never the one saved since.
 *
 * What cannot be written fails the proposal with its reason (ST-126): OpenRouter's failures, an answer that is not the
 * agreed form, an answer without a machine, AI turned off – nothing is sent then – and a break-off, recorded by the next
 * run (POL-UnfinishedAiWorkFails). A failed proposal is never written again automatically.
 */
const AI_MODEL_PROPOSAL_KIND = "ai-model-proposal";

/** Whether this AI model proposal was left unfinished: its hold ran out without a result (HS-33). */
export function aiModelProposalLeftUnfinished(db: Database, clock: Clock, aiModelProposalId: string): Promise<boolean> {
  return aiWorkLeftUnfinished(db, clock, AI_MODEL_PROPOSAL_KIND, [aiModelProposalId]);
}

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
    // Already written or failed meanwhile – a stale hold does nothing.
    if (!proposal || proposal.state !== "requested") return piece.giveUp();
    // AI turned off before it started: nothing is sent, and the proposal is failed as *AI off* (rule).
    if (!(await aiState(context.db, context.ai)).on) return fail(id, "ai-off", piece, context);
    const answer = answerOfChat(
      await piece.openRouter.chat(proposal.chatModel, aiModelProposalChatRequest(proposal.description)),
    );
    if (answer === "stopped") return fail(id, "ai-off", piece, context);
    if (answer === "unusable") return fail(id, "answer-unusable", piece, context);
    if ("failure" in answer) return fail(id, answer.failure, piece, context);
    // No machine in the answer: nothing is searched for and nothing more is paid.
    if (!deviceRecognised(answer)) return fail(id, "device-not-recognised", piece, context);
    // The AI index is searched with the completed fields among all files (ST-125, ADR 0018).
    const found = await findExistingFiles(context.db, piece.openRouter, answer);
    if ("failure" in found) return fail(id, found.failure, piece, context);
    await piece.storeResult((tx) =>
      executeCommand(
        writeAiModelProposalCommand,
        {
          aiModelProposalId: id,
          answer,
          existingFiles: found.files,
          ...(found.embeddingModel !== undefined && { embeddingModel: found.embeddingModel }),
          cost: piece.openRouter.spent(),
        },
        { actor: { kind: "system" }, db: tx, clock: context.clock },
      ),
    );
  },

  /**
   * POL-UnfinishedAiWorkFails: a proposal whose hold ran out without a result is recorded failed as *broken off* and
   * never written again automatically (HS-33, D3). Nothing is read and nothing is sent.
   */
  async recordBrokenOff(tx, id, context) {
    await failIn(tx, id, "broken-off", context);
  },
};

/** Records a failure through the aggregate's own command – only while the proposal is still requested. */
async function fail(
  id: string,
  reason: AiModelProposalFailureReason,
  piece: HeldPiece,
  context: AiWorkContext,
): Promise<void> {
  await piece.storeResult((tx) => failIn(tx, id, reason, context));
}

function failIn(tx: Database, id: string, reason: AiModelProposalFailureReason, context: AiWorkContext) {
  return executeCommand(
    failAiModelProposalCommand,
    { aiModelProposalId: id, reason },
    { actor: { kind: "system" }, db: tx, clock: context.clock },
  );
}

/**
 * The files the AI index finds for the completed fields (ST-125): the best passages and the best pages or images of the
 * current embedding model among every file that is not removed, also one attached to nothing – a file counts once, passages
 * first, then pages or images (the item limits of `searchAiIndex` apply, not a limit of files). A photo is no document of a proposal. Nothing named, nothing searched and nothing paid; the number of
 * hits is fixed (`searchAiIndex`), not a setting.
 */
async function findExistingFiles(
  db: Database,
  openRouter: OpenRouterSession,
  answer: AiModelProposalAnswer,
): Promise<{ files: FoundFile[]; embeddingModel?: string } | { failure: AiModelProposalFailureReason }> {
  const text = existingFilesSearchText(answer);
  if (!text) return { files: [] };
  const embedded = await openRouter.embed({ kind: "text", text });
  if (typeof embedded === "string") return { failure: failureOfEmbedding(embedded) };
  // Photos are left out of the scope already, so they take none of the fixed hits; the decision keeps the invariant too.
  const candidates = (await filesForAiModelProposal(db)).filter((file) =>
    proposedFileCategories.some((category) => category === file.fileCategory),
  );
  const scope = { fileIds: candidates.map((file) => file.id), embeddingModel: embedded.model };
  const hits = [
    ...(await searchAiIndex(db, scope, embedded.embedding, "text")),
    ...(await searchAiIndex(db, scope, embedded.embedding, "image")),
  ];
  const byId = new Map(candidates.map((file) => [file.id, file]));
  const files = [...new Set(hits.map((hit) => hit.fileId))]
    .flatMap((fileId) => byId.get(fileId) ?? [])
    .slice(0, MAX_PROPOSED_DOCUMENTS)
    .map(({ id, title, fileCategory }) => ({ fileId: id, title, fileCategory }));
  return { files, embeddingModel: embedded.model };
}

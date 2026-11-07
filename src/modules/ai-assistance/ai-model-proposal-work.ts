import { executeCommand, type Database } from "@/platform/command";
import { filesForAiModelProposal } from "@/modules/collection";
import { aiModelProposalById, requestedAiModelProposalIds } from "./ai-model-proposals";
import {
  MAX_PROPOSED_DOCUMENTS,
  proposedFileCategories,
  type AiModelProposalAnswer,
  type FoundFile,
} from "./ai-model-proposal";
import { aiModelProposalChatRequest, answerOfChat, existingFilesSearchText } from "./ai-model-proposal-writing";
import { searchAiIndex } from "./ai-index-search";
import type { AiWorkKind } from "./ai-work";
import type { OpenRouterSession } from "./open-router-session";
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
    // The AI index is searched with the completed fields among all files (ST-125, ADR 0018).
    const found = await findExistingFiles(context.db, piece.openRouter, answer);
    // ST-126: a failed embedding fails the proposal with its reason.
    if (found === "gave-up") return piece.giveUp();
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

  /** ST-126 records the proposal failed as *broken off*; until then a break-off leaves it as it is. */
  async recordBrokenOff() {},
};

/**
 * The files the AI index finds for the completed fields (ST-125): the best passages and the best pages or images of the
 * current embedding model among every file that is not removed, also one attached to nothing – a file counts once, the
 * best hit first. A photo is no document of a proposal. Nothing named, nothing searched and nothing paid; the number of
 * hits is fixed (`searchAiIndex`), not a setting.
 */
async function findExistingFiles(
  db: Database,
  openRouter: OpenRouterSession,
  answer: AiModelProposalAnswer,
): Promise<{ files: FoundFile[]; embeddingModel?: string } | "gave-up"> {
  const text = existingFilesSearchText(answer);
  if (!text) return { files: [] };
  const embedded = await openRouter.embed({ kind: "text", text });
  if (typeof embedded === "string") return "gave-up";
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

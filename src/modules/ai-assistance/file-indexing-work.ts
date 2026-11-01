import { executeCommand, type Database } from "@/platform/command";
import { fileForIndexing, filesForIndexing } from "@/modules/collection";
import { aiIndexHasEntryFor, aiIndexedFileIds } from "./ai-index-entries";
import { aiIndexingSettings } from "./ai-settings";
import type { IndexFileForAiInput } from "./ai-index-entry";
import { indexFileForAiCommand } from "./index-file-for-ai-command";
import type { AiWorkContext, AiWorkKind, HeldPiece } from "./ai-work";
import { indexFileContent, type IndexingOutcome } from "./file-indexing";

/**
 * Indexing a file for AI as a kind of the background work (ST-106, ADR 0015). A run takes one whole file or nothing:
 * the slow part – reading the content, rendering the pages, asking OpenRouter – runs outside any transaction, and only
 * the replacement of the AI index entry is one short transaction that ends the hold. What broke off is recorded
 * *broken off* by POL-UnfinishedAiWorkFails; a failed file is never taken by a run again.
 */
export const FILE_INDEXING_KIND = "file-indexing";

export const fileIndexingWork: AiWorkKind = {
  kind: FILE_INDEXING_KIND,

  /**
   * The files not removed that have no AI index entry for the current embedding model – a file attached while AI was
   * off, one of another model, or one no run reached. A failed file with the current model is not among them: it is
   * tried again only by hand or with a new model (HS-32). While AI is off nothing waits.
   */
  async waiting(db, context) {
    const settings = await aiIndexingSettings(db, context.ai);
    if (!settings.aiOn || !settings.embeddingModel) return [];
    const [files, known] = await Promise.all([filesForIndexing(db), aiIndexedFileIds(db, settings.embeddingModel)]);
    return files.filter((file) => !known.has(file.id)).map((file) => file.id);
  },

  /** Asked again once the file is held: done, recorded broken off or removed meanwhile is no longer waited for. */
  async isWaiting(tx, id, context) {
    const settings = await aiIndexingSettings(tx, context.ai);
    if (!settings.aiOn || !settings.embeddingModel) return false;
    if (await aiIndexHasEntryFor(tx, id, settings.embeddingModel)) return false;
    return !!(await fileForIndexing(tx, id));
  },

  async work(id, piece, context) {
    const settings = await aiIndexingSettings(context.db, context.ai);
    // AI turned off: nothing reaches OpenRouter, nothing is stored, the file stays waiting (rule of CMD-IndexFileForAi).
    if (!settings.aiOn || !settings.key || !settings.embeddingModel) return piece.giveUp();
    const file = await fileForIndexing(context.db, id);
    // Removed before it was read: nothing to index. The removal policy has already taken its entry.
    if (!file) return piece.giveUp();
    const content = await context.storage.readContent(file.content.name);
    const outcome: IndexingOutcome = content
      ? await indexFileContent({
          contentType: file.content.contentType,
          bytes: content,
          ai: context.ai.ai,
          embeddingModel: settings.embeddingModel,
          // Asked before every request: AI turned off, a rotated key or a changed model stops the indexing at once.
          settings: () => aiIndexingSettings(context.db, context.ai),
          // Kept with the hold, so an indexing that breaks off still says what it cost.
          spent: (cost) => piece.recordSpent(cost),
        })
      : // A file record whose content is missing from the store (ST-105): a damaged PDF fails the same way.
        { outcome: "failed", reason: "not readable", cost: 0 };
    if (outcome.outcome === "given-up") return piece.giveUp();
    await storeOutcome(context, id, settings.embeddingModel, piece, outcome);
  },

  /**
   * POL-UnfinishedAiWorkFails: a file whose hold ran out without a result is recorded failed as *broken off* – nothing
   * is read or sent. A removed file records nothing; while AI is off it records nothing either, so the file stays
   * waiting instead of failing because someone turned AI off after the crash. The command's facts read the file under
   * the shared removal lock.
   */
  async recordBrokenOff(tx, id, context, spent) {
    const settings = await aiIndexingSettings(tx, context.ai);
    if (!settings.aiOn || !settings.embeddingModel) return;
    await runCommand(tx, context, {
      fileId: id,
      embeddingModel: settings.embeddingModel,
      failure: "broken off",
      cost: spent,
    });
  },
};

/** Stores the indexing's result only while the run still holds the file (ADR 0015); the command re-reads it (ADR 0014). */
async function storeOutcome(
  context: AiWorkContext,
  fileId: string,
  embeddingModel: string,
  piece: HeldPiece,
  outcome: IndexingOutcome,
): Promise<void> {
  if (outcome.outcome === "given-up") return piece.giveUp();
  const input: IndexFileForAiInput =
    outcome.outcome === "failed"
      ? { fileId, embeddingModel, failure: outcome.reason, cost: outcome.cost }
      : {
          fileId,
          embeddingModel,
          result: {
            items: outcome.items,
            pagesIndexed: outcome.pagesIndexed,
            imagesIndexed: outcome.imagesIndexed,
            cost: outcome.cost,
          },
        };
  await piece.storeResult((tx) => runCommand(tx, context, input));
}

/**
 * CMD-IndexFileForAi as the system. A rejection – only `file-removed` today – records nothing, and the hold still ends
 * with the piece's result (`storeResult`), so a run never pays twice for one piece.
 */
function runCommand(tx: Database, context: AiWorkContext, input: IndexFileForAiInput) {
  return executeCommand(indexFileForAiCommand, input, {
    actor: { kind: "system" },
    db: tx,
    clock: context.clock,
  });
}

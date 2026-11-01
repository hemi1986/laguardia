import { aggregateCommand } from "@/platform/command";
import { fileForIndexingWhileStoring } from "@/modules/collection";
import { indexFileForAi, retryFileIndexing, type RetryFileIndexingInput } from "./ai-index-entry";
import { aiIndexingSettings, type AiDependencies } from "./ai-settings";
import { aiIndexEntries } from "./ai-index-entries";
import { aiAssistanceEvents } from "./events";

/**
 * CMD-IndexFileForAi through the command layer (ST-106): a creating command on AGG-AiIndexEntry whose identity is the
 * file's ID – a first indexing creates the entry, a later one replaces it as a whole (`insertReplaces`). It runs in the
 * background as the system only (the run's `storeResult` transaction, ADR 0015); a technician's „Erneut versuchen“ is
 * `retryFileIndexingCommand` below. Its facts read the file in the same transaction under the file's removal lock taken
 * shared (ADR 0014) and the decision copies the owner from them – a file removed meanwhile rejects with
 * `file-removed` and records nothing.
 */
export const indexFileForAiCommand = aggregateCommand({
  id: "CMD-IndexFileForAi",
  allowedActors: ["system"],
  store: aiIndexEntries,
  creates: true,
  facts: (tx, input) => fileForIndexingWhileStoring(tx, input.fileId),
  decide: indexFileForAi,
  journal: aiAssistanceEvents.journal,
  result: () => ({}),
});

/**
 * CMD-IndexFileForAi run by hand (ST-109): „Erneut versuchen“ on a failed file – technicians only, only while AI is on,
 * only on a file that failed with the current embedding model. It removes the failed entry and records
 * EVT-FileIndexingRetried; the indexing itself is the background work's, started by the Server Action after the
 * response. A file removed meanwhile has no entry any more (POL-RemovedFileLeavesAiIndex) – `not-found`.
 */
export function retryFileIndexingCommand(dependencies: Pick<AiDependencies, "encryptionKey">) {
  return aggregateCommand({
    id: "CMD-IndexFileForAi",
    allowedActors: ["technician"],
    store: aiIndexEntries,
    target: (input: RetryFileIndexingInput) => ({ id: input.fileId, version: input.version }),
    facts: async (tx) => {
      const { aiOn, embeddingModel } = await aiIndexingSettings(tx, dependencies);
      return { aiOn, embeddingModel };
    },
    decide: retryFileIndexing,
    removes: () => true,
    journal: aiAssistanceEvents.journal,
    result: (entry) => ({ fileId: entry.id }),
  });
}

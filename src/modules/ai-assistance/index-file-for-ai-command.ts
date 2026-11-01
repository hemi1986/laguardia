import { aggregateCommand } from "@/platform/command";
import { fileForIndexingWhileStoring } from "@/modules/collection";
import { indexFileForAi } from "./ai-index-entry";
import { aiIndexEntries } from "./ai-index-entries";
import { aiAssistanceEvents } from "./events";

/**
 * CMD-IndexFileForAi through the command layer (ST-106): a creating command on AGG-AiIndexEntry whose identity is the
 * file's ID – a first indexing creates the entry, a later one replaces it as a whole (`insertReplaces`). It runs in the
 * background as the system (the run's `storeResult` transaction, ADR 0015); a technician runs it by hand with
 * „Erneut versuchen“ (ST-109). Its facts read the file in the same transaction under the file's removal lock taken
 * shared (ADR 0014) and the decision copies the owner from them – a file removed meanwhile rejects with
 * `file-removed` and records nothing.
 */
export const indexFileForAiCommand = aggregateCommand({
  id: "CMD-IndexFileForAi",
  allowedActors: ["technician", "system"],
  store: aiIndexEntries,
  creates: true,
  facts: (tx, input) => fileForIndexingWhileStoring(tx, input.fileId),
  decide: indexFileForAi,
  journal: aiAssistanceEvents.journal,
  result: () => ({}),
});

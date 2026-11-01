import { eventCatalogue } from "@/platform/command";
import type { AiSettingsChanged } from "./change-ai-settings";
import type { FileIndexedForAi, FileIndexingFailed, FileLeftAiIndex } from "./ai-index-entry";

/**
 * AI assistance's event catalogue (ST-079): per event its aggregate and what reaches the journal. The OpenRouter key is
 * never part of it – only that it was saved or removed, and its last four characters (EVT-AiSettingsChanged). The AI
 * index's passages, page images and embeddings never reach it either: it names the file, the model, the counts and the
 * cost (ST-106).
 */
const machineOf = (owner: { machineId: string } | { machineModelId: string }) =>
  "machineId" in owner ? owner.machineId : null;
const machineModelOf = (owner: { machineId: string } | { machineModelId: string }) =>
  "machineModelId" in owner ? owner.machineModelId : null;

export const aiAssistanceEvents = eventCatalogue({
  "EVT-AiSettingsChanged": {
    aggregate: "AGG-AiSettings",
    project: (event: AiSettingsChanged) => ({
      aggregateId: event.aiSettingsId,
      machineId: null,
      data: {
        changedParts: event.changedParts,
        keyLastFour: event.keyLastFour ?? null,
        chatModel: event.chatModel ?? null,
        embeddingModel: event.embeddingModel ?? null,
        aiOn: event.aiOn,
      },
    }),
  },
  "EVT-FileIndexedForAi": {
    aggregate: "AGG-AiIndexEntry",
    project: (event: FileIndexedForAi) => ({
      aggregateId: event.fileId,
      machineId: machineOf(event.owner),
      data: {
        machineModelId: machineModelOf(event.owner),
        embeddingModel: event.embeddingModel,
        pagesIndexed: event.pagesIndexed,
        imagesIndexed: event.imagesIndexed,
        cost: event.cost,
      },
    }),
  },
  "EVT-FileIndexingFailed": {
    aggregate: "AGG-AiIndexEntry",
    project: (event: FileIndexingFailed) => ({
      aggregateId: event.fileId,
      machineId: machineOf(event.owner),
      data: {
        machineModelId: machineModelOf(event.owner),
        embeddingModel: event.embeddingModel,
        reason: event.reason,
      },
    }),
  },
  "EVT-FileLeftAiIndex": {
    aggregate: "AGG-AiIndexEntry",
    project: (event: FileLeftAiIndex) => ({
      aggregateId: event.fileId,
      machineId: machineOf(event.owner),
      data: { machineModelId: machineModelOf(event.owner) },
    }),
  },
});

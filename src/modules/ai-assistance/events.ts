import { eventCatalogue } from "@/platform/command";
import type { AiSettingsChanged } from "./change-ai-settings";
import { ownerColumns, type FileIndexedForAi, type FileIndexingFailed, type FileLeftAiIndex } from "./ai-index-entry";

/**
 * AI assistance's event catalogue (ST-079): per event its aggregate and what reaches the journal. The OpenRouter key is
 * never part of it – only that it was saved or removed, and its last four characters (EVT-AiSettingsChanged). The AI
 * index's passages, page images and embeddings never reach it either: it names the file, the model, the counts and the
 * cost (ST-106).
 */
const ownerData = (owner: { machineId: string } | { machineModelId: string }) => {
  const { machineId, machineModelId } = ownerColumns(owner);
  return { machineId, machineModelId };
};

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
    project: (event: FileIndexedForAi) => {
      const { machineId, machineModelId } = ownerData(event.owner);
      return {
        aggregateId: event.fileId,
        machineId,
        data: {
          machineModelId,
          embeddingModel: event.embeddingModel,
          pagesIndexed: event.pagesIndexed,
          imagesIndexed: event.imagesIndexed,
          cost: event.cost,
        },
      };
    },
  },
  "EVT-FileIndexingFailed": {
    aggregate: "AGG-AiIndexEntry",
    project: (event: FileIndexingFailed) => {
      const { machineId, machineModelId } = ownerData(event.owner);
      return {
        aggregateId: event.fileId,
        machineId,
        data: { machineModelId, embeddingModel: event.embeddingModel, reason: event.reason },
      };
    },
  },
  "EVT-FileLeftAiIndex": {
    aggregate: "AGG-AiIndexEntry",
    project: (event: FileLeftAiIndex) => {
      const { machineId, machineModelId } = ownerData(event.owner);
      return { aggregateId: event.fileId, machineId, data: { machineModelId } };
    },
  },
});

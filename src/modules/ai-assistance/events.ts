import { eventCatalogue } from "@/platform/command";
import type { AiSettingsChanged } from "./change-ai-settings";
import type { AiAssessmentFailed, AiAssessmentRequested, AiAssessmentWritten } from "./ai-assessment";
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
  // An AI assessment never changes a defect, so its journal entries name no machine. The note and the written text
  // stay out of the journal – only that it was requested or written, with the models and the cost (ST-107).
  "EVT-AiAssessmentRequested": {
    aggregate: "AGG-AiAssessment",
    project: (event: AiAssessmentRequested) => ({
      aggregateId: event.aiAssessmentId,
      machineId: null,
      data: { defectId: event.defectId, requestedBy: event.requestedBy, chatModel: event.chatModel },
    }),
  },
  "EVT-AiAssessmentWritten": {
    aggregate: "AGG-AiAssessment",
    project: (event: AiAssessmentWritten) => ({
      aggregateId: event.aiAssessmentId,
      machineId: null,
      data: {
        defectId: event.defectId,
        chatModel: event.chatModel,
        embeddingModel: event.embeddingModel,
        cost: event.cost,
      },
    }),
  },
  "EVT-AiAssessmentFailed": {
    aggregate: "AGG-AiAssessment",
    project: (event: AiAssessmentFailed) => ({
      aggregateId: event.aiAssessmentId,
      machineId: null,
      data: { defectId: event.defectId, reason: event.reason },
    }),
  },
});

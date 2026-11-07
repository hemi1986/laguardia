import { eventCatalogue } from "@/platform/command";
import type { AiSettingsChanged } from "./change-ai-settings";
import type { AiModelProposalFailed, AiModelProposalRequested, AiModelProposalWritten } from "./ai-model-proposal";
import type { AiModelProposalAccepted } from "./accept-ai-model-proposal";
import type { ProposedDocumentFailed, ProposedDocumentLoaded } from "./load-proposed-document";
import type { AiAssessmentFailed, AiAssessmentRequested, AiAssessmentWritten } from "./ai-assessment";
import type { FileIndexedForAi, FileIndexingFailed, FileIndexingRetried, FileLeftAiIndex } from "./ai-index-entry";

/**
 * AI assistance's event catalogue (ST-079): per event its aggregate and what reaches the journal. The OpenRouter key is
 * never part of it – only that it was saved or removed, and its last four characters (EVT-AiSettingsChanged). The AI
 * index's passages, page images and embeddings never reach it either: it names the file, the model, the counts and the
 * cost (ST-106). Since ST-120 the AI index's events name no machine and no machine model – a file is indexed once,
 * whatever it is attached to; entries recorded before still carry `machineId` and `data.machineModelId`, and every
 * reader of the journal accepts them.
 */
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
      machineId: null,
      data: {
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
      machineId: null,
      data: { embeddingModel: event.embeddingModel, reason: event.reason, cost: event.cost },
    }),
  },
  "EVT-FileIndexingRetried": {
    aggregate: "AGG-AiIndexEntry",
    project: (event: FileIndexingRetried) => ({
      aggregateId: event.fileId,
      machineId: null,
      data: { embeddingModel: event.embeddingModel },
    }),
  },
  "EVT-FileLeftAiIndex": {
    aggregate: "AGG-AiIndexEntry",
    project: (event: FileLeftAiIndex) => ({ aggregateId: event.fileId, machineId: null, data: {} }),
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
        // IDs only: a reference as "file" or "file#page", never a text (the journal carries references, not prose).
        references: event.references.map((reference) =>
          reference.page === undefined ? reference.fileId : `${reference.fileId}#${reference.page}`,
        ),
        filesSearched: event.filesSearched,
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
  // The description a technician typed is free text and stays out of the journal (ST-123): who asked and the model.
  "EVT-AiModelProposalRequested": {
    aggregate: "AGG-AiModelProposal",
    project: (event: AiModelProposalRequested) => ({
      aggregateId: event.aiModelProposalId,
      machineId: null,
      data: { requestedBy: event.requestedBy, chatModel: event.chatModel },
    }),
  },
  // Written (ST-124): the text of the fields, the sources and the documents stay out – that it was written, the models
  // and the cost.
  "EVT-AiModelProposalWritten": {
    aggregate: "AGG-AiModelProposal",
    project: (event: AiModelProposalWritten) => ({
      aggregateId: event.aiModelProposalId,
      machineId: null,
      data: { chatModel: event.chatModel, embeddingModel: event.embeddingModel ?? null, cost: event.cost },
    }),
  },
  // Failed (ST-126): the reason only – the typed description is free text and stays out.
  "EVT-AiModelProposalFailed": {
    aggregate: "AGG-AiModelProposal",
    project: (event: AiModelProposalFailed) => ({
      aggregateId: event.aiModelProposalId,
      machineId: null,
      data: { reason: event.reason },
    }),
  },
  // Accepted (ST-128): the machine model it created and the existing files it attached; titles and links stay out.
  "EVT-AiModelProposalAccepted": {
    aggregate: "AGG-AiModelProposal",
    project: (event: AiModelProposalAccepted) => ({
      aggregateId: event.aiModelProposalId,
      machineId: null,
      data: { machineModelId: event.machineModelId, fileIds: event.fileIds, linkCount: event.linkCount },
    }),
  },
  // A chosen link loaded or failed (ST-129): its place among the documents and the file or the reason – no title, no link.
  "EVT-ProposedDocumentLoaded": {
    aggregate: "AGG-AiModelProposal",
    project: (event: ProposedDocumentLoaded) => ({
      aggregateId: event.aiModelProposalId,
      machineId: null,
      data: { documentIndex: event.documentIndex, fileId: event.fileId },
    }),
  },
  "EVT-ProposedDocumentFailed": {
    aggregate: "AGG-AiModelProposal",
    project: (event: ProposedDocumentFailed) => ({
      aggregateId: event.aiModelProposalId,
      machineId: null,
      data: { documentIndex: event.documentIndex, reason: event.reason },
    }),
  },
});

/** Public interface of the AI assistance module (BC-AiAssistance: AI settings, AI index, AI assessments) – ADR 0002. */
export { changeAiSettingsCommand } from "./change-ai-settings-command";
export type { AiSettingsPart, ChangeAiSettingsError, ChangeAiSettingsInput } from "./change-ai-settings";
export {
  aiDependencies,
  aiSettingsForm,
  type AiDependencies,
  type AiSettingsForm,
  type ListedModel,
  type MissingPart,
} from "./ai-settings";
export type { AiSeam, ModelKind, OfferedModel } from "./ai-seam";
export { embeddingModelChange, type EmbeddingModelChange, type NoEmbeddingModelChange } from "./embedding-model-change";
export { runAiWork } from "./ai-work";
export {
  aiIndexOverview,
  aiIndexStateOfFile,
  aiIndexStatesForOverview,
  fileIndexingRetriedBy,
  filesTheAiCannotRead,
  type AiIndexOverview,
  type FailedFile,
} from "./ai-index-overview";
export type { AiIndexStateOfFile } from "./ai-index-entries";
export type { IndexingFailureReason, RetryFileIndexingError, RetryFileIndexingInput } from "./ai-index-entry";
export { retryFileIndexingCommand } from "./index-file-for-ai-command";
export { aiWorkDependencies } from "./ai-work-dependencies";
export { aiAssessmentLeftUnfinished, aiAssessmentWork } from "./ai-assessment-work";
export { fileIndexingLeftUnfinished, fileIndexingWork } from "./file-indexing-work";
export { aiAssessmentsOfDefect } from "./ai-assessments";
export { filesContainingWords, type FilesContainingWords } from "./files-containing-words";
export { MAX_AI_ASSESSMENT_PHOTOS } from "./ai-assessment";
export type {
  AiAssessmentReference,
  AiAssessmentState,
  AssessmentFailureReason,
  RequestAiAssessmentError,
  RequestAiAssessmentInput,
} from "./ai-assessment";
export { requestAiAssessmentCommand } from "./request-ai-assessment-command";
export {
  aiAssessmentRetryRequest,
  aiAssessmentsInRepairHistory,
  defectAiAssessments,
  type AiAssessmentViewer,
  type DefectAiAssessments,
  type ShownAiAssessment,
  type ShownAiAssessmentReference,
} from "./defect-ai-assessments";
/**
 * Collection's CMD-RemoveFile with POL-RemovedFileLeavesAiIndex added – what the file pages run (ST-106). The command
 * and its policy stay inside the module; only the composed command is exported for the page.
 */
export { removeFileCommandWithAiIndex } from "./removal-policy";
export { requestAiModelProposalCommand } from "./request-ai-model-proposal-command";
export type {
  ProposedDocument,
  ProposedFileCategory,
  RequestAiModelProposalError,
  RequestAiModelProposalInput,
} from "./ai-model-proposal";
export {
  aiModelProposalPage,
  aiModelProposalRefusal,
  openAiModelProposals,
  type AiModelProposalPage,
  type OpenAiModelProposals,
} from "./open-ai-model-proposals";
export { aiModelProposalWork } from "./ai-model-proposal-work";

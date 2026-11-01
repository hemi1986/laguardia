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
export {
  embeddingModelChange,
  TOKENS_PER_PAGE_OR_IMAGE,
  type EmbeddingModelChange,
  type NoEmbeddingModelChange,
} from "./embedding-model-change";
export { aiWorkLeftUnfinished, runAiWork } from "./ai-work";
export {
  aiIndexOverview,
  fileIndexingRetriedBy,
  filesTheAiCannotRead,
  type AiIndexOverview,
  type FailedFile,
} from "./ai-index-overview";
export type {
  FileOwner,
  IndexingFailureReason,
  RetryFileIndexingError,
  RetryFileIndexingInput,
} from "./ai-index-entry";
export { retryFileIndexingCommand } from "./index-file-for-ai-command";
export { aiWorkDependencies } from "./ai-work-dependencies";
export { AI_ASSESSMENT_KIND, aiAssessmentWork } from "./ai-assessment-work";
export { FILE_INDEXING_KIND, fileIndexingWork } from "./file-indexing-work";
export { aiAssessmentsOfDefect } from "./ai-assessments";
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

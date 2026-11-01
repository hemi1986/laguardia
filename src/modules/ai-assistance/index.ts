/** Public interface of the AI assistance module (BC-AiAssistance: AI settings, AI index, AI assessments) – ADR 0002. */
export { changeAiSettingsCommand } from "./change-ai-settings-command";
export type { AiSettingsPart, ChangeAiSettingsError, ChangeAiSettingsInput } from "./change-ai-settings";
export {
  aiDependencies,
  aiIndexingSettings,
  aiSettingsForm,
  type AiDependencies,
  type AiIndexingSettings,
  type AiSettingsForm,
  type ListedModel,
  type MissingPart,
} from "./ai-settings";
export type { AiSeam, ModelKind, OfferedModel } from "./ai-seam";
export { aiWorkLeftUnfinished, runAiWork } from "./ai-work";
export { aiWorkDependencies } from "./ai-work-dependencies";
export { indexFileForAiCommand } from "./index-file-for-ai-command";
export { removeFileFromAiIndexCommand, removeFileCommandWithAiIndex } from "./removal-policy";
export { aiIndexEntryOf, aiIndexedFileIds, hasAiIndexEntry } from "./ai-index-entries";
export type { AiIndexEntryState, AiIndexItem, IndexingFailureReason } from "./ai-index-entry";
export { FILE_INDEXING_KIND, fileIndexingWork } from "./file-indexing-work";
export { indexFileContent, type IndexingOutcome } from "./file-indexing";

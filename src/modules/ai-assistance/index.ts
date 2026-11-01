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
export { aiWorkLeftUnfinished, runAiWork } from "./ai-work";
export { aiWorkDependencies } from "./ai-work-dependencies";

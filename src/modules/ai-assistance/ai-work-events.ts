import type { CommittedEvent } from "@/platform/command";

/**
 * Whether what a command committed leaves AI work to do (POL-AttachedFileIsIndexedForAi, POL-RequestedAiAssessmentIsWritten,
 * POL-AiIndexFollowsTheSettings, ST-109, ADR 0015): a file attached, an AI assessment requested, a file tried again, or
 * the AI settings changed in any way but the key removed. AI assistance knows this; Collection never knows AI.
 */
export function makesAiWork(events: readonly CommittedEvent[]): boolean {
  return events.some(({ type, data }) => {
    if (type === "EVT-AiSettingsChanged")
      return !(data as { changedParts: string[] }).changedParts.includes("key-removed");
    return type === "EVT-FileAttached" || type === "EVT-AiAssessmentRequested" || type === "EVT-FileIndexingRetried";
  });
}

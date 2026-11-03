import type { CommittedEvent } from "@/platform/command";

/**
 * Whether what a command committed leaves AI work to do (POL-AttachedFileIsIndexedForAi, POL-RequestedAiAssessmentIsWritten,
 * POL-AiIndexFollowsTheSettings, ST-109, ADR 0015): a file added (ADR 0018: not attaching it – a file attached to nothing is indexed too), an AI assessment requested, a file tried again, or
 * the AI settings changed in any way but the key removed. AI assistance knows this; Collection never knows AI.
 *
 * A second entry of the module beside `index.ts`, imported from here alone: every form asks this, and the module's
 * `index.ts` would bring all of AI assistance – the native canvas among it – into every Server Action, the visitor's too.
 */
export function makesAiWork(events: readonly CommittedEvent[]): boolean {
  return events.some(({ type, data }) => {
    if (type === "EVT-AiSettingsChanged")
      return !(data as { changedParts: string[] }).changedParts.includes("key-removed");
    return type === "EVT-FileAdded" || type === "EVT-AiAssessmentRequested" || type === "EVT-FileIndexingRetried";
  });
}

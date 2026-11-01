import { eventCatalogue } from "@/platform/command";
import type { AiSettingsChanged } from "./change-ai-settings";

/**
 * AI assistance's event catalogue (ST-079): per event its aggregate and what reaches the journal. The OpenRouter key is
 * never part of it – only that it was saved or removed, and its last four characters (EVT-AiSettingsChanged).
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
});

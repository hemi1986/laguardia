import { aggregateCommand } from "@/platform/command";
import { aiSettingsFacts, aiSettingsStore, type AiDependencies } from "./ai-settings";
import { AI_SETTINGS_ID, aiSettingsActors, changeAiSettings } from "./change-ai-settings";
import { aiAssistanceEvents } from "./events";

/**
 * CMD-ChangeAiSettings through the command layer (ST-104): technicians only, at the version the technician saw. Its
 * facts ask OpenRouter through the AI seam about the parts that were sent; a save without a change records nothing
 * (HS-27). Built with its dependencies – the real ones in the Server Action, the in-memory AI in tests.
 */
export function changeAiSettingsCommand(dependencies: AiDependencies) {
  return aggregateCommand({
    id: "CMD-ChangeAiSettings",
    allowedActors: aiSettingsActors,
    store: aiSettingsStore,
    target: (input) => ({ id: AI_SETTINGS_ID, version: input.version }),
    mayChangeNothing: true,
    facts: (_tx, input, state) => aiSettingsFacts(dependencies, state, input),
    decide: changeAiSettings,
    journal: aiAssistanceEvents.journal,
    result: () => ({}),
  });
}

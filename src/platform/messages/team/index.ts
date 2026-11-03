import { accountsTexts } from "./accounts";
import { aiAssistanceErrors, aiAssistanceTexts } from "./ai-assistance";
import { collectionErrors, collectionTexts } from "./collection";
import { dashboardTexts } from "./dashboard";
import { maintenanceErrors, maintenanceTexts } from "./maintenance";
import { repairErrors, repairTexts } from "./repair";
import { sharedErrors, sharedTexts } from "./shared";

/**
 * German texts of the team UI (architecture review 2026-10-18): one file per area – the shared texts and codes, and one
 * per bounded context with its pages' texts and its commands' error texts. `commandErrors` holds them all, keyed by the
 * kebab-case error code: every error code of a command a team form runs needs a text in its area or in the shared
 * file – otherwise the form fails the type check. A code lives in one file only (a test checks it).
 */
export const teamMessages = {
  ...sharedTexts,
  ...accountsTexts,
  ...aiAssistanceTexts,
  ...collectionTexts,
  ...dashboardTexts,
  ...maintenanceTexts,
  ...repairTexts,
  commandErrors: { ...sharedErrors, ...aiAssistanceErrors, ...collectionErrors, ...maintenanceErrors, ...repairErrors },
} as const;

/** The areas, for the test that a text key or an error code lives in one file only. */
export const teamAreas = {
  texts: { sharedTexts, accountsTexts, aiAssistanceTexts, collectionTexts, dashboardTexts, maintenanceTexts, repairTexts },
  errors: { sharedErrors, aiAssistanceErrors, collectionErrors, maintenanceErrors, repairErrors },
};

import { aggregateCommand } from "@/platform/command";
import { changeLegalTexts, legalTextsActors, LEGAL_TEXTS_ID } from "./change-legal-texts";
import { collectionEvents } from "./events";
import { legalTextsStore } from "./museum-settings";

/**
 * CMD-ChangeLegalTexts through the command layer (ST-103): a change of the legal texts at the version the technician saw
 * – the version check of this part only, so a change of the museum details or the logo meanwhile never rejects it –,
 * emits EVT-LegalTextsChanged. Saving without a change records no event and is no rejection (HS-27).
 */
export const changeLegalTextsCommand = aggregateCommand({
  id: "CMD-ChangeLegalTexts",
  allowedActors: legalTextsActors,
  store: legalTextsStore,
  target: (input) => ({ id: LEGAL_TEXTS_ID, version: input.version }),
  mayChangeNothing: true,
  decide: changeLegalTexts,
  journal: collectionEvents.journal,
  result: () => ({}),
});

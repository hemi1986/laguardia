import { commandErrorText, teamMessages } from "@/platform/messages";
import type { DismissRejection } from "./actions";

/** The rejection in words – naming who triaged first (story review 2026-10-03), else the catalogue's text. */
export function rejectionText(state: DismissRejection): string {
  if (state.error === "already-triaged" && state.triagedBy) return teamMessages.dismiss.alreadyTriagedBy(state.triagedBy);
  return commandErrorText(teamMessages, state.error);
}

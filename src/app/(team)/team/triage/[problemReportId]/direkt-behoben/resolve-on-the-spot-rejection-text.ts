import { commandErrorText, teamMessages } from "@/platform/messages";
import type { ResolveOnTheSpotState } from "./actions";

/** The rejection in words – naming who triaged first (story review 2026-10-03), else the catalogue's text. */
export function rejectionText(state: NonNullable<ResolveOnTheSpotState>): string {
  if (state.error === "already-triaged" && state.triagedBy) {
    return teamMessages.resolveOnTheSpot.alreadyTriagedBy(state.triagedBy);
  }
  return commandErrorText(teamMessages, state.error);
}

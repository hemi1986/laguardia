import { commandErrorText, teamMessages, type TeamCommandErrorCode } from "@/platform/messages";

/**
 * A rejected triage form in words (ST-018 ff.): who triaged first, when that is the reason and known – else the
 * catalogue's text for the error. Its own file, without server code: the client forms import it.
 */
export function triageRejectionText(state: { error: TeamCommandErrorCode; triagedBy?: string }): string {
  if (state.error === "already-triaged" && state.triagedBy) return teamMessages.triage.alreadyTriagedBy(state.triagedBy);
  return commandErrorText(teamMessages, state.error);
}

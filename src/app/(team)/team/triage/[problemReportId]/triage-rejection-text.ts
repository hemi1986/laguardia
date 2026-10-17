import { teamMessages, type TeamCommandErrorCode } from "@/platform/messages";
import { rejectionText } from "@/app/_actions/rejection-text";

/**
 * A rejected triage form in words (ST-018 ff.): who triaged first, when that is the reason and known – else the
 * shared rejection text. Its own file, without server code: the client forms import it.
 */
export function triageRejectionText(state: { error: TeamCommandErrorCode; triagedBy?: string }): string {
  return rejectionText(
    state.error,
    state.triagedBy ? { "already-triaged": teamMessages.triage.alreadyTriagedBy(state.triagedBy) } : {},
  );
}

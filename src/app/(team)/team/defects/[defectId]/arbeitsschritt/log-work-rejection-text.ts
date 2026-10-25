import { photosRejectionText } from "@/app/_actions/rejection-text";
import { teamMessages, type TeamCommandErrorCode } from "@/platform/messages";

const { defects: texts } = teamMessages;

/**
 * A rejected „Arbeitsschritt eintragen“ in words (ST-024, ST-032): a change made meanwhile asks to send again with the
 * texts kept – and, when photos were attached, says in the same sentence that they must be chosen again; any other
 * rejection that was not about the photos is followed by the photo sentence (G8a).
 */
export function logWorkRejectionText(state: { error: TeamCommandErrorCode; photoAgain?: true }): string {
  if (state.error === "version-conflict" && state.photoAgain) return texts.logWorkConflictWithPhotos;
  return photosRejectionText(state, { "version-conflict": texts.logWorkConflict });
}

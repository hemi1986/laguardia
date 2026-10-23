import { teamMessages, type TeamCommandErrorCode } from "@/platform/messages";
import { photoRejectionText } from "@/app/_actions/rejection-text";

/**
 * A rejected form that reports and triages in the same step, in words (ST-023, ST-052): the shared rejection text for
 * the error – naming the machine when it was retired meanwhile –, and after it that the photo must be chosen again
 * (G8a). Its own file, without server code: the client forms import it.
 */
export function rejectionText(state: { error: TeamCommandErrorCode; photoAgain?: true }, museumNumber: string): string {
  return photoRejectionText(state, { "machine-retired": teamMessages.recordDefect.retiredMeanwhile(museumNumber) });
}

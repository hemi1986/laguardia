import { teamMessages, type TeamCommandErrorCode } from "@/platform/messages";
import { rejectionText as formRejectionText } from "@/app/_actions/rejection-text";

const { reportAndTriage: texts, recordDefect } = teamMessages;

/**
 * A rejected form that reports and triages in the same step, in words (ST-023, ST-052): the shared rejection text for
 * the error – naming the machine when it was retired meanwhile –, and after it that the photo must be chosen again when
 * the action marked the rejection so (G8a). Its own file, without server code: the client forms import it.
 */
export function rejectionText(
  state: { error: TeamCommandErrorCode; photoAgain?: boolean },
  museumNumber: string,
): string {
  const reason = formRejectionText(state.error, { "machine-retired": recordDefect.retiredMeanwhile(museumNumber) });
  return state.photoAgain ? `${reason} ${texts.photoAgain}` : reason;
}

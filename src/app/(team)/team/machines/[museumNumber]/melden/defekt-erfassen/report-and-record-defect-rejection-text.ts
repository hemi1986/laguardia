import { commandErrorText, teamMessages, type TeamCommandErrorCode } from "@/platform/messages";

const { reportAndRecordDefect: texts, recordDefect } = teamMessages;

/**
 * A rejected form „Problem melden und Defekt erfassen“ in words (ST-023): the catalogue's text for the error – naming
 * the machine when it was retired meanwhile –, and after it that the photo must be chosen again when the action marked
 * the rejection so (G8a). Its own file, without server code: the client form imports it.
 */
export function rejectionText(
  state: { error: TeamCommandErrorCode; photoAgain?: boolean },
  museumNumber: string,
): string {
  const reason =
    state.error === "machine-retired"
      ? recordDefect.retiredMeanwhile(museumNumber)
      : commandErrorText(teamMessages, state.error);
  return state.photoAgain ? `${reason} ${texts.photoAgain}` : reason;
}

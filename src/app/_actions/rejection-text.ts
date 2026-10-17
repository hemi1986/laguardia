import { commandErrorText, teamMessages, type TeamCommandErrorCode } from "@/platform/messages";

/**
 * A rejected form on the form runner in words (architecture review 2026-10-17): the runner keeps what was typed and
 * the page shows the aggregate as it is now, so a conflict asks to send again – not to reload, which would throw the
 * input away (G8, G13). A form passes its own text for an error where it knows more (who triaged first, a machine
 * retired meanwhile). One-tap buttons have nothing to keep and show the catalogue's text directly.
 * Its own file, without server code: the client forms import it.
 */
export function rejectionText(
  error: TeamCommandErrorCode,
  overrides: Partial<Record<TeamCommandErrorCode, string>> = {},
): string {
  return (
    overrides[error] ??
    (error === "version-conflict" ? teamMessages.forms.conflict : commandErrorText(teamMessages, error))
  );
}

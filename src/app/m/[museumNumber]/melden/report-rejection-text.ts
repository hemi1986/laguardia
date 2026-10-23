import { commandErrorText, type VisitorMessages } from "@/platform/messages";
import type { ReportProblemState } from "./actions";

/**
 * A rejected report form in words (ST-013, ST-084): the reason, and after it that the photo must be chosen again when
 * the form had one attached (G8a) – the runner's photo step marks it. Its own file, without server code: the client
 * form imports it.
 */
export function reportRejectionText(
  state: NonNullable<ReportProblemState>,
  messages: Pick<VisitorMessages, "reportForm" | "commandErrors">,
): string {
  const reason = commandErrorText(messages, state.error);
  return state.photoAgain ? `${reason} ${messages.reportForm.photoAgain}` : reason;
}

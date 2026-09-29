import { visitorDe, type VisitorMessages } from "./visitor.de";
import { visitorEn } from "./visitor.en";

/**
 * Message catalogs (ST-003): the team UI is German; visitor pages are German or English.
 * Choosing the visitor's language from the browser comes with the visitor machine page (ST-010).
 */
export { teamMessages } from "./team.de";
export type { VisitorMessages } from "./visitor.de";

export type VisitorLocale = "de" | "en";

export function visitorMessages(locale: VisitorLocale): VisitorMessages {
  return locale === "en" ? visitorEn : visitorDe;
}

/** The error codes a visitor page can show – a command whose errors are not all here fails the type check. */
export type CommandErrorCode = keyof VisitorMessages["commandErrors"];

/** "Command errors map to catalog texts by their kebab-case code" (ST-003, ST-073). */
export function commandErrorText(messages: VisitorMessages, code: CommandErrorCode): string {
  return messages.commandErrors[code];
}

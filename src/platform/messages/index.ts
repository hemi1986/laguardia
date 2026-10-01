import { teamMessages } from "./team.de";
import { visitorDe, type VisitorMessages } from "./visitor.de";
import { visitorEn } from "./visitor.en";

/**
 * Message catalogs (ST-003): the team UI is German; visitor pages are German or English.
 * Choosing the visitor's language from the browser comes with the visitor machine page (ST-010).
 */
export { teamMessages };
export type { VisitorMessages } from "./visitor.de";

export type VisitorLocale = "de" | "en";

export function visitorMessages(locale: VisitorLocale): VisitorMessages {
  return locale === "en" ? visitorEn : visitorDe;
}

/** A catalog with texts for rejected commands: the visitor catalogs and the team catalog (ST-006). */
type CommandErrorCatalog = { commandErrors: Readonly<Record<string, string>> };

/** The error codes a visitor page can show – a command whose errors are not all here fails the type check. */
export type CommandErrorCode = keyof VisitorMessages["commandErrors"];

/** The same for the team UI (ST-006). */
export type TeamCommandErrorCode = keyof (typeof teamMessages)["commandErrors"];

/** "Command errors map to catalog texts by their kebab-case code" (ST-003, ST-073, ST-006). */
export function commandErrorText<Catalog extends CommandErrorCatalog>(
  messages: Catalog,
  code: keyof Catalog["commandErrors"] & string,
): string {
  return messages.commandErrors[code];
}

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

import type { VisitorLocale } from "./index";

const locales: readonly VisitorLocale[] = ["de", "en"];

/** The cookie the language switch of the visitor pages sets (ST-010) – remembered for a year. */
export const VISITOR_LOCALE_COOKIE = "visitor-locale";

/**
 * The language of the visitor pages (ST-010, ADR 0001): the one the visitor chose with the switch; otherwise the
 * browser's highest-ranked of German and English, wherever it stands in `Accept-Language` ("fr, de;q=0.8" → German);
 * otherwise English (user, 2026-10-02).
 */
export function visitorLocale(acceptLanguage: string | undefined, remembered: string | undefined): VisitorLocale {
  const chosen = locales.find((locale) => locale === remembered);
  if (chosen) return chosen;
  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((entry, position) => {
      const [tag, ...parameters] = entry.trim().split(";");
      const q = Number(parameters.find((p) => p.trim().startsWith("q="))?.trim().slice(2) ?? "1");
      return { language: tag.trim().toLowerCase().split("-")[0], q: Number.isFinite(q) ? q : 0, position };
    })
    .filter((entry) => entry.q > 0)
    .sort((a, b) => b.q - a.q || a.position - b.position);
  const best = ranked.find((entry) => locales.some((locale) => locale === entry.language));
  return (best?.language as VisitorLocale | undefined) ?? "en";
}

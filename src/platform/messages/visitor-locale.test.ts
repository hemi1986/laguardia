import { describe, expect, it } from "vitest";
import { visitorLocale } from "./visitor-locale";

/**
 * The language of the visitor pages (ST-010, ADR 0001): the language the visitor chose with the switch, otherwise the
 * browser's highest-ranked of German and English, otherwise English (user, 2026-10-02).
 */
describe("the visitor's language", () => {
  it.each([
    ["German browser", "de-DE,de;q=0.9", undefined, "de"],
    ["English browser", "en-GB,en;q=0.9", undefined, "en"],
    ["French browser", "fr-FR,fr;q=0.9", undefined, "en"],
    ["French first, German second", "fr-FR,fr;q=0.9,de;q=0.8", undefined, "de"],
    ["German ranked above English by q", "en;q=0.5,de;q=0.9", undefined, "de"],
    ["no header", undefined, undefined, "en"],
    ["garbage header", ";;;q=x", undefined, "en"],
    ["the switch beats the browser", "de-DE", "en", "en"],
    ["an unknown remembered value is ignored", "de-DE", "fr", "de"],
  ])("%s", (_case, acceptLanguage, remembered, expected) => {
    expect(visitorLocale(acceptLanguage, remembered)).toBe(expected);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { photoErrors } from "@/photo";
import { teamMessages, visitorMessages } from ".";

/** `_UI (de)_` wording per glossary term in CONTEXT.md, e.g. "Machine" → "Gerät". */
function glossaryUiTerms(): Map<string, string> {
  const context = readFileSync("CONTEXT.md", "utf8");
  const terms = new Map<string, string>();
  for (const [, term, ui] of context.matchAll(/\*\*([^*]+)\*\*:?\n(?:.*\n)*?_UI \(de\)_: (.+)/g)) {
    terms.set(term.trim(), ui.trim());
  }
  return terms;
}

function keysOf(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keysOf(child, prefix ? `${prefix}.${key}` : key));
}

describe("message catalogs", () => {
  it("team UI terms use the German wording of the glossary", () => {
    const glossary = glossaryUiTerms();

    for (const [term, wording] of Object.entries(teamMessages.terms)) {
      expect(glossary.get(term), `glossary term "${term}"`).toBe(wording);
    }
    expect(teamMessages.terms.Machine).toBe("Gerät");
  });

  it("visitor texts exist in German and English with the same keys", () => {
    expect(keysOf(visitorMessages("en")).sort()).toEqual(keysOf(visitorMessages("de")).sort());
    expect(visitorMessages("de").home.teamLogin).toBe("Anmeldung fürs Team");
    expect(visitorMessages("en").home.teamLogin).toBe("Team login");
  });

  it("every photo error has a text in the team catalog and in both visitor catalogs (ST-016)", () => {
    for (const code of photoErrors) {
      expect(teamMessages.commandErrors[code], `team: ${code}`).toMatch(/\S/);
      expect(visitorMessages("de").commandErrors[code], `visitor de: ${code}`).toMatch(/\S/);
      expect(visitorMessages("en").commandErrors[code], `visitor en: ${code}`).toMatch(/\S/);
    }
    expect(visitorMessages("de").commandErrors["too-large"]).toContain("20 MB");
    expect(visitorMessages("en").commandErrors["too-large"]).toContain("20 MB");
  });
});

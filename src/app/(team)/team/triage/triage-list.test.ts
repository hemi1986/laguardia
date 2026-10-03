import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { teamMessages } from "@/platform/messages";
import { TriageListView } from "./triage-list";

/** The triage list's empty state – the good state, still said in words (G7); no database shares it reliably. */
describe("the empty triage list", () => {
  it("ST-017: Nothing waits for triage", () => {
    const html = renderToStaticMarkup(createElement(TriageListView, { data: { entries: [] } }));

    expect(html).toContain("Nichts wartet auf die Sichtung – alle Meldungen sind gesichtet.");
    expect(html).not.toContain("<li");
  });
});

describe("how long a problem report has been waiting, in words", () => {
  it.each([
    [0, "wartet seit weniger als 1 Stunde"],
    [1, "wartet seit 1 Stunde"],
    [23, "wartet seit 23 Stunden"],
    [24, "wartet seit 1 Tag"],
    [73, "wartet seit 3 Tagen"],
  ])("%i hours → %s", (hours, words) => {
    expect(teamMessages.triage.waitingFor(hours)).toBe(words);
  });

  it("says how many wait, one in the singular", () => {
    expect(teamMessages.triage.waiting(1)).toBe("1 Meldung wartet auf die Sichtung.");
    expect(teamMessages.triage.waiting(2)).toBe("2 Meldungen warten auf die Sichtung.");
  });
});

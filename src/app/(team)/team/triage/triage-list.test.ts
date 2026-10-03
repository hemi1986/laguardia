import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TriageListView } from "./triage-list";

/** The triage list's empty state – the good state, still said in words (G7); no database shares it reliably. */
describe("the empty triage list", () => {
  it("ST-017: Nothing waits for triage", () => {
    const html = renderToStaticMarkup(createElement(TriageListView, { data: { entries: [] } }));

    expect(html).toContain("Nichts wartet auf die Sichtung – alle Meldungen sind gesichtet.");
    expect(html).not.toContain("<li");
  });
});

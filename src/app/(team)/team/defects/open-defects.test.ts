import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { openDefectsFilterOf, type OpenDefectsData, type OpenDefectsFilter } from "./open-defects-data";
import { OpenDefectsView } from "./open-defects";

function view(data: Partial<OpenDefectsData>): string {
  return renderToStaticMarkup(
    createElement(OpenDefectsView, { data: { entries: [], total: 0, machines: [], filter: {}, ...data } }),
  );
}

/** The empty open defects list – the good state, still said in words (G7); no database shares it reliably. */
describe("the empty open defects list", () => {
  it("ST-021: No defect is open", () => {
    const html = view({});

    expect(html).toContain("Kein Defekt ist offen.");
    expect(html).toMatch(/<a [^>]*href="\/team\/triage"[^>]*>Zur Sichtung<\/a>/);
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<li");
  });
});

describe("a filter that matches nothing, in its own words", () => {
  it.each<[OpenDefectsFilter, string]>([
    [{ museumNumber: "LG-042" }, "LG-042 hat keine offenen Defekte."],
    [{ priority: "low" }, "Kein offener Defekt hat die Priorität niedrig."],
    [{ suitableForHelpers: true }, "Kein offener Defekt ist für Helfer:innen geeignet."],
    [{ priority: "high", suitableForHelpers: true }, "Kein offener Defekt passt zu diesem Filter."],
  ])("%o → %s", (filter, text) => {
    expect(view({ total: 3, filter })).toContain(text);
  });
});

describe("the filter of the open defects list, from the address", () => {
  it.each([
    [{}, {}],
    [{ machine: "LG-042" }, { museumNumber: "LG-042" }],
    [{ machine: "  " }, {}],
    [{ priority: "high" }, { priority: "high" }],
    [{ priority: "urgent" }, {}],
    [{ helpers: "1" }, { suitableForHelpers: true }],
    [{ helpers: "yes" }, {}],
    [
      { machine: ["LG-042", "LG-007"], priority: "low", helpers: "1" },
      { museumNumber: "LG-042", priority: "low", suitableForHelpers: true },
    ],
  ])("%o → %o", (params, filter) => {
    expect(openDefectsFilterOf(params)).toEqual(filter);
  });
});

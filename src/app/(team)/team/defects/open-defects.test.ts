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

describe("the machine filter", () => {
  it("keeps a machine the address names even when it has no open defects, so the form says what is filtered", () => {
    const html = view({
      total: 3,
      machines: [{ museumNumber: "LG-042", machineModelTitle: "Medieval Madness" }],
      filter: { museumNumber: "LG-100" },
    });

    expect(html).toMatch(/<option value="LG-100" selected="">LG-100<\/option>/);
    expect(html).toContain('<option value="LG-042">LG-042 · Medieval Madness</option>');
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

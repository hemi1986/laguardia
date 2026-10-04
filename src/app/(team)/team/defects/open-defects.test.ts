import { describe, expect, it } from "vitest";
import { openDefectsFilterOf } from "./open-defects-data";

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

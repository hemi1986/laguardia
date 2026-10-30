import { describe, expect, it } from "vitest";
import { byYear } from "./history-by-year";

/**
 * A machine's history by year (G24, architecture review 2026-10-30): the Berlin calendar year of each entry, the
 * newest year first, each year's entries in the order they came – whatever order the years came in.
 */
describe("a machine's history by year", () => {
  const at = (when: string) => ({ when });

  it.each([
    ["no entries, no years", [], []],
    [
      "one year",
      [at("2026-03-01T10:00:00Z"), at("2026-01-01T10:00:00Z")],
      [["2026", ["2026-03-01T10:00:00Z", "2026-01-01T10:00:00Z"]]],
    ],
    [
      "the newest year first",
      [at("2026-05-10T09:00:00Z"), at("2025-09-01T09:00:00Z"), at("2025-03-01T09:00:00Z")],
      [
        ["2026", ["2026-05-10T09:00:00Z"]],
        ["2025", ["2025-09-01T09:00:00Z", "2025-03-01T09:00:00Z"]],
      ],
    ],
    [
      "years that come mixed up are still one group each, entries kept in order",
      [at("2025-02-01T09:00:00Z"), at("2026-02-01T09:00:00Z"), at("2025-01-01T09:00:00Z")],
      [
        ["2026", ["2026-02-01T09:00:00Z"]],
        ["2025", ["2025-02-01T09:00:00Z", "2025-01-01T09:00:00Z"]],
      ],
    ],
    // 00:30 on 1 January 2026 in Berlin is 23:30 on 31 December 2025 in UTC.
    [
      "the year in Berlin",
      [at("2025-12-31T23:30:00Z"), at("2025-12-31T22:30:00Z")],
      [
        ["2026", ["2025-12-31T23:30:00Z"]],
        ["2025", ["2025-12-31T22:30:00Z"]],
      ],
    ],
    [
      "a calendar date is its own year",
      [at("2026-01-01"), at("2025-12-31")],
      [
        ["2026", ["2026-01-01"]],
        ["2025", ["2025-12-31"]],
      ],
    ],
  ] as const)("%s", (_case, entries, expected) => {
    const years = byYear(entries, (entry) => (entry.when.length === 10 ? entry.when : new Date(entry.when)));
    expect(years.map(({ year, entries: inYear }) => [year, inYear.map((entry) => entry.when)])).toEqual(expected);
  });
});

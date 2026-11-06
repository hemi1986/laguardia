import { describe, expect, it } from "vitest";
import { fileOverviewAddress, fileOverviewQueryOf, strictFileOverviewQueryOf } from "./file-overview-query";
import { searchWordsOf } from "./search-words";

describe("the words of a file search (ST-118)", () => {
  it.each([
    ["LG-042", ["lg", "042"]],
    ["medieval_manual-v2.pdf", ["medieval", "manual", "v2", "pdf"]],
    ["Medieval  MADNESS medieval", ["medieval", "madness"]],
    ["Spulen für Relais", ["spulen", "für", "relais"]],
    ["", []],
    ["  -- .. „“ ", []],
  ])("%j has the words %j", (search, words) => {
    expect(searchWordsOf(search)).toEqual(words);
  });

  it("counts at most a few words and cuts a long one", () => {
    expect(searchWordsOf("a b c d e f g h i j k")).toHaveLength(8);
    expect(searchWordsOf("x".repeat(100))[0]).toHaveLength(40);
  });
});

describe("the search in the address of the file overview (ST-118)", () => {
  it("is kept as typed, first in the address, and a search of punctuation only is left out", () => {
    expect(fileOverviewQueryOf({ search: " Medieval Spule ", fileCategory: "manual" })).toEqual({
      search: "Medieval Spule",
      fileCategory: "manual",
    });
    expect(fileOverviewAddress({ search: "Medieval Spule", fileCategory: "manual", page: 2 })).toBe(
      "/team/dateien?search=Medieval+Spule&fileCategory=manual&page=2",
    );
    expect(fileOverviewQueryOf({ search: "-- ." })).toEqual({});
  });

  it("is part of a known origin only exactly as the overview builds it", () => {
    expect(strictFileOverviewQueryOf(new URLSearchParams("search=Medieval+Spule&page=2"))).toEqual({
      search: "Medieval Spule",
      page: 2,
    });
    expect(strictFileOverviewQueryOf(new URLSearchParams("search=+Medieval"))).toBeUndefined();
    expect(strictFileOverviewQueryOf(new URLSearchParams("search=a&search=b"))).toBeUndefined();
  });
});

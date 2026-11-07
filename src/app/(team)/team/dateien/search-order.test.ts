import { describe, expect, it } from "vitest";
import type { FileOverviewEntry } from "@/modules/collection";
import { searched } from "./search-order";

/** A file of the overview, named by its ID, with the per-word ranks of its own text (`null`: not found there). */
function entry(id: string, ownRanks: (number | null)[]): FileOverviewEntry {
  return {
    id,
    title: id,
    fileCategory: "manual",
    mediaType: "pdf",
    size: 1,
    addedAt: new Date("2026-11-01T10:00:00Z"),
    ownRanks,
  };
}

/** What AI assistance found: per word, the files with a passage that holds it and the rank of the best one. */
const content = (...perWord: [string, number][][]) => perWord.map((files) => new Map(files));

const ids = (entries: FileOverviewEntry[]) => entries.map((e) => e.id);

describe("the order of a search (ST-118)", () => {
  it("keeps a file whose every word is found, in either place – not all in the same one", () => {
    const files = [entry("own", [0.1, 0.1]), entry("split", [0.1, null]), entry("none", [null, null])];
    expect(ids(searched(files, content([], [["split", 0.2]])))).toEqual(["own", "split"]);
  });

  it("drops a file that lacks one word in both places", () => {
    const files = [entry("a", [0.5, null])];
    expect(searched(files, content([], []))).toEqual([]);
  });

  it("puts the file with more words in its own text first", () => {
    const files = [entry("one", [0.9, null]), entry("two", [0.1, 0.1])];
    expect(ids(searched(files, content([], [["one", 0.5]])))).toEqual(["two", "one"]);
  });

  it("orders files with as many own words by the rank of those words", () => {
    const files = [entry("low", [0.1]), entry("high", [0.4])];
    expect(ids(searched(files, content([])))).toEqual(["high", "low"]);
  });

  it("orders files tied on their own text by the rank of the content", () => {
    const files = [entry("a", [null]), entry("b", [null])];
    expect(
      ids(
        searched(
          files,
          content([
            ["a", 0.1],
            ["b", 0.3],
          ]),
        ),
      ),
    ).toEqual(["b", "a"]);
  });

  it("never adds the two ranks up: with as many own words, the own rank decides whatever the content holds", () => {
    const files = [entry("content", [0.1]), entry("own", [0.4])];
    expect(ids(searched(files, content([["content", 99]])))).toEqual(["own", "content"]);
  });

  it("keeps the order the files came in when everything ties", () => {
    const files = [entry("newest", [0.2]), entry("middle", [0.2]), entry("oldest", [0.2])];
    expect(ids(searched(files, content([])))).toEqual(["newest", "middle", "oldest"]);
  });

  it("lets a stop word pass: rank 0 in its own text counts as found", () => {
    const files = [entry("a", [0, 0.2])];
    expect(ids(searched(files, content([], [])))).toEqual(["a"]);
  });
});

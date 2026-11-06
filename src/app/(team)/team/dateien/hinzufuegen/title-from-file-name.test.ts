import { describe, expect, it } from "vitest";
import { titleFromFileName } from "./title-from-file-name";

describe("the title a chosen file proposes (ST-119)", () => {
  it.each([
    ["medieval_manual-v2.pdf", "medieval_manual-v2"],
    ["Bedienungsanleitung.final.pdf", "Bedienungsanleitung.final"],
    ["README", "README"],
    [".gitignore", ".gitignore"],
    ["scan.", "scan"],
  ])("%s proposes %s", (fileName, title) => {
    expect(titleFromFileName(fileName)).toBe(title);
  });
});

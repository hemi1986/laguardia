import { describe, expect, it } from "vitest";
import { attachedNowParts, filesCount } from "./file-plurals";

describe("the count of files (G4)", () => {
  it.each([
    [0, "0 Dateien"],
    [1, "1 Datei"],
    [2, "2 Dateien"],
    [42, "42 Dateien"],
  ])("%i files read „%s“", (files, text) => {
    expect(filesCount(files)).toBe(text);
  });
});

describe("what a file hangs on after attaching (ST-115)", () => {
  it.each([
    [0, 0, []],
    [1, 0, ["1 Gerät"]],
    [3, 0, ["3 Geräten"]],
    [0, 1, ["1 Modell"]],
    [0, 2, ["2 Modellen"]],
    [1, 1, ["1 Gerät", "1 Modell"]],
    [2, 3, ["2 Geräten", "3 Modellen"]],
  ])("%i machines and %i machine models name %j", (machines, models, parts) => {
    expect(attachedNowParts(machines, models)).toEqual(parts);
  });
});

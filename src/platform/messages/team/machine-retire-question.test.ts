import { describe, expect, it } from "vitest";
import { teamMessages } from "..";

/** The question before retiring (ST-039, G10): it names what will happen; a part with zero is left out. */
describe("the retirement question", () => {
  it.each([
    [
      1,
      2,
      "LG-013 ausmustern? 1 offener Defekt wird geschlossen, 2 Meldungen werden verworfen. Das lässt sich nicht rückgängig machen.",
    ],
    [
      3,
      1,
      "LG-013 ausmustern? 3 offene Defekte werden geschlossen, 1 Meldung wird verworfen. Das lässt sich nicht rückgängig machen.",
    ],
    [2, 0, "LG-013 ausmustern? 2 offene Defekte werden geschlossen. Das lässt sich nicht rückgängig machen."],
    [0, 1, "LG-013 ausmustern? 1 Meldung wird verworfen. Das lässt sich nicht rückgängig machen."],
    [0, 0, "LG-013 ausmustern? Das lässt sich nicht rückgängig machen."],
  ])("%i open defects, %i problem reports", (openDefects, problemReports, question) => {
    expect(teamMessages.machineRetire.question("LG-013", openDefects, problemReports)).toBe(question);
  });
});

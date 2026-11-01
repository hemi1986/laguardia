import { describe, expect, it } from "vitest";
import { parseAiAssessmentAnswer } from "./ai-assessment-writing";

/**
 * The structured-answer parser (ST-107, a seam the story names outside the catalog): the chat model's content becomes
 * the AI assessment's parts, or is *answer unusable* – OpenRouter's prose never reaches the domain (ADR 0014).
 */
describe("reading the chat model's answer", () => {
  it("reads the summary, the ranked causes, what to check first and the references", () => {
    const answer = parseAiAssessmentAnswer(
      JSON.stringify({
        summary: "Die Spule ist schwach.",
        probableCauses: ["Die Spule ist verschlissen.", "Der Kontakt ist oxidiert."],
        whatToCheckFirst: ["Die Spule messen.", "Den Kontakt prüfen."],
        references: [{ file: "f1", page: 12 }, { file: "f2" }],
      }),
    );

    expect(answer).toEqual({
      summary: "Die Spule ist schwach.",
      probableCauses: ["Die Spule ist verschlissen.", "Der Kontakt ist oxidiert."],
      whatToCheckFirst: ["Die Spule messen.", "Den Kontakt prüfen."],
      references: [{ fileId: "f1", page: 12 }, { fileId: "f2" }],
    });
  });

  it("is unusable without a summary, and for content that is not an answer at all", () => {
    expect(parseAiAssessmentAnswer("")).toBeUndefined();
    expect(parseAiAssessmentAnswer("not json")).toBeUndefined();
    expect(parseAiAssessmentAnswer("[]")).toBeUndefined();
    expect(parseAiAssessmentAnswer(JSON.stringify({ summary: "   " }))).toBeUndefined();
  });

  it("leaves out empty texts and pages that are no page", () => {
    const answer = parseAiAssessmentAnswer(
      JSON.stringify({
        summary: "Kurz.",
        probableCauses: ["Eine Ursache", "  ", 7],
        whatToCheckFirst: "keine Liste",
        references: [{ file: "f1", page: 0 }, { file: "f1", page: -2 }, { page: 3 }, { file: "" }],
      }),
    );

    expect(answer).toEqual({
      summary: "Kurz.",
      probableCauses: ["Eine Ursache"],
      whatToCheckFirst: [],
      // The parser keeps what the model named; the writer drops foreign files and keeps each reference once.
      references: [{ fileId: "f1" }, { fileId: "f1" }],
    });
  });

  it("bounds an answer the model makes arbitrarily large", () => {
    const answer = parseAiAssessmentAnswer(
      JSON.stringify({
        summary: "x".repeat(10_000),
        probableCauses: Array.from({ length: 100 }, () => "y".repeat(5_000)),
        whatToCheckFirst: Array.from({ length: 100 }, () => "z"),
        references: Array.from({ length: 100 }, (_, index) => ({ file: `f${index}` })),
      }),
    );

    expect(answer?.summary).toHaveLength(4000);
    expect(answer?.probableCauses).toHaveLength(20);
    expect(answer?.probableCauses[0]).toHaveLength(500);
    expect(answer?.whatToCheckFirst).toHaveLength(20);
    expect(answer?.references).toHaveLength(20);
  });
});

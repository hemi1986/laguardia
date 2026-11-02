import { describe, expect, it } from "vitest";
import {
  aiAssessmentChatRequest,
  foundImagesToSend,
  outcomeOfChat,
  parseAiAssessmentAnswer,
  reportPhotosToSend,
  searchTextOf,
  uniqueHits,
  type AiAssessmentMaterial,
} from "./ai-assessment-writing";
import type { AiIndexHit } from "./ai-index-search";

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

describe("what an AI assessment searches with and sends", () => {
  const report = (description: string, photo: string | undefined, day: number) => ({
    description,
    photo,
    reportedAt: new Date(Date.UTC(2026, 10, day)),
  });
  const aDefect = (problemReports: ReturnType<typeof report>[]) =>
    ({
      machineId: "machine",
      title: "Left flipper weak",
      priority: undefined,
      problemReports,
      workLog: [],
      latestResolved: [],
    }) as unknown as AiAssessmentMaterial["defect"];
  const hit = (id: string): AiIndexHit => ({ id, fileId: "file", kind: "page-image", page: 1 });
  const bytes = (value: number) => new Uint8Array([value]);

  function material(over: Partial<AiAssessmentMaterial>): AiAssessmentMaterial {
    return {
      defect: aDefect([]),
      machineModel: { title: "Eight Ball" } as AiAssessmentMaterial["machineModel"],
      files: [],
      note: undefined,
      passages: [],
      foundImages: [],
      reportPhotos: [],
      requestPhotos: [],
      ...over,
    };
  }

  it("searches with the title, the descriptions and the note, leaving out what is blank", () => {
    const defect = aDefect([report("Weak", undefined, 1), report("  ", undefined, 2)]);
    expect(searchTextOf(defect, "Coil gets hot")).toBe("Left flipper weak\n\nWeak\n\nCoil gets hot");
    expect(searchTextOf(defect, undefined)).toBe("Left flipper weak\n\nWeak");
  });

  it("sends the photos of the 10 newest problem reports that have one, the newest first", () => {
    const reports = Array.from({ length: 12 }, (_, day) => report(`${day}`, `photo-${day + 1}`, day + 1));
    const sent = reportPhotosToSend(aDefect([report("no photo", undefined, 30), ...reports]));
    expect(sent).toHaveLength(10);
    expect(sent[0]).toBe("photo-12");
    expect(sent[9]).toBe("photo-3");
  });

  it("takes each found item once and at most 12 found images, the first found", () => {
    const hits = Array.from({ length: 14 }, (_, at) => hit(`hit-${at}`));
    expect(uniqueHits([hit("a"), hit("b"), hit("a")]).map(({ id }) => id)).toEqual(["a", "b"]);
    expect(foundImagesToSend([hits[0], ...hits]).map(({ id }) => id)).toEqual(hits.slice(0, 12).map(({ id }) => id));
  });

  it("sends the found images, then the reports' photos, then the request's, and names only what is sent", () => {
    const image = { bytes: bytes(1), contentType: "image/png" };
    const { images, text } = aiAssessmentChatRequest(
      material({
        foundImages: [
          { hit: hit("gone"), image: undefined },
          { hit: { ...hit("kept"), fileId: "kept-file" }, image },
        ],
        reportPhotos: [undefined, bytes(2)],
        requestPhotos: [bytes(3), undefined, bytes(4)],
      }),
    );
    expect(images).toEqual([
      image,
      { bytes: bytes(2), contentType: "image/jpeg" },
      { bytes: bytes(3), contentType: "image/jpeg" },
      { bytes: bytes(4), contentType: "image/jpeg" },
    ]);
    expect(text).toContain('"datei": "kept-file"');
    expect(text).not.toContain('"datei": "file"');
    expect(text).toContain("Fotos der Meldungen (als Bilder mitgeschickt, danach): 1");
    expect(text).toContain("Fotos der Anfrage (als Bilder mitgeschickt, zuletzt): 2");
  });
});

describe("what a chat request comes to", () => {
  it("fails as AI off when the session stopped, and with the seam's reason when the chat failed", () => {
    expect(outcomeOfChat("stopped")).toEqual({ failure: "ai-off" });
    expect(outcomeOfChat({ failure: "credit-used-up" })).toEqual({ failure: "credit-used-up" });
  });

  it("fails as answer unusable when the content cannot be read", () => {
    expect(outcomeOfChat({ content: "not json", cost: 0.01 })).toEqual({ failure: "answer-unusable" });
  });

  it("reads a usable answer as the assessment's parts", () => {
    expect(outcomeOfChat({ content: JSON.stringify({ summary: "Die Spule." }), cost: 0.01 })).toMatchObject({
      summary: "Die Spule.",
    });
  });
});

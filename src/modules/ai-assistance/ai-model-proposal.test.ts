import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { writeAiModelProposal, type AiModelProposalAnswer, type AiModelProposalState } from "./ai-model-proposal";
import { answerOfChat, parseAiModelProposalAnswer } from "./ai-model-proposal-writing";

/** The rules of CMD-WriteAiModelProposal over many cases (ST-124) – the scenarios themselves run at the run seam. */
const requested: AiModelProposalState = {
  id: "proposal-1",
  description: "Flipper High Speed Williams",
  requestedBy: "00000000-0000-4000-8000-000000000001",
  requestedAt: new Date("2026-11-07T12:00:00Z"),
  chatModel: "google/gemini-2.5-flash",
  state: "requested",
};
const context = { actor: { kind: "system" as const }, clock: fixedClock("2026-11-07T12:01:00Z"), newId: () => "id" };

const answer = (given: Partial<AiModelProposalAnswer> = {}): AiModelProposalAnswer => ({
  title: "High Speed",
  manufacturer: "Williams",
  year: "1986",
  machineCategory: "pinball",
  technology: "solid-state",
  sources: [],
  documents: [],
  ...given,
});

function written(given: Partial<AiModelProposalAnswer>) {
  const decision = writeAiModelProposal(requested, { answer: answer(given), cost: 0.05 }, context);
  if (!decision.ok) throw new Error(decision.error);
  return decision.state;
}

describe("writeAiModelProposal", () => {
  it.each([
    [
      "a machine category of none of the three",
      { machineCategory: "jukebox" },
      { technology: undefined, machineCategory: undefined },
    ],
    [
      "a technology that does not fit the machine category",
      { machineCategory: "arcade", technology: "dmd" },
      { technology: undefined },
    ],
    [
      "a technology of a machine category that has none",
      { machineCategory: "other", technology: "lcd" },
      { technology: undefined },
    ],
    [
      "a technology without a machine category",
      { machineCategory: undefined },
      { technology: undefined, machineCategory: undefined },
    ],
    ["a year that is not four digits", { year: "86" }, { year: undefined }],
    ["a year with text", { year: "ca. 1986" }, { year: undefined }],
    ["a blank title", { title: "  " }, { title: undefined }],
  ])("leaves %s empty, not repaired", (_, given, expected) => {
    const state = written(given);

    // The field is absent, not repaired; everything else the AI named stays as it named it.
    for (const field of Object.keys(expected)) expect(state).not.toHaveProperty(field);
    expect(state.manufacturer).toBe("Williams");
  });

  it("keeps only https links, once each, and at most ten documents", () => {
    const documents = [
      { title: "Plain http", fileCategory: "manual", link: "http://example.org/a.pdf" },
      { title: "Script", fileCategory: "manual", link: "javascript:alert(1)" },
      { title: "A file", fileCategory: "manual", link: "file:///etc/passwd" },
      { title: "Not a link", fileCategory: "manual", link: "example.org" },
      { title: "No title", fileCategory: "manual", link: "https://example.org/untitled.pdf" },
      { title: "Manual", fileCategory: "manual", link: "https://example.org/manual.pdf" },
      { title: "Manual again", fileCategory: "schematic", link: "https://example.org/manual.pdf" },
      ...Array.from({ length: 12 }, (_, index) => ({
        title: `Other ${index}`,
        fileCategory: "other",
        link: `https://example.org/${index}.pdf`,
      })),
    ].map((document) => (document.title === "No title" ? { ...document, title: " " } : document));

    const state = written({ documents, sources: ["http://example.org/not-secure", "https://example.org/source"] });

    expect(state.documents).toHaveLength(10);
    expect(state.documents?.[0]).toEqual({
      kind: "link",
      title: "Manual",
      fileCategory: "manual",
      link: "https://example.org/manual.pdf",
    });
    expect(state.documents?.every((document) => document.link.startsWith("https://"))).toBe(true);
    expect(state.sources).toEqual(["https://example.org/source"]);
  });

  it("gives a file category the AI invented the category Other", () => {
    const state = written({
      documents: [{ title: "Doc", fileCategory: "datasheet", link: "https://example.org/d.pdf" }],
    });

    expect(state.documents?.[0].fileCategory).toBe("other");
  });

  it("leaves out images and video: a photo, a picture address, a film address", () => {
    const state = written({
      documents: [
        { title: "Photo", fileCategory: "photo", link: "https://example.org/p.pdf" },
        { title: "Picture", fileCategory: "other", link: "https://example.org/backglass.JPG" },
        { title: "Film", fileCategory: "other", link: "https://example.org/demo.mp4?x=1" },
        { title: "Manual", fileCategory: "manual", link: "https://example.org/manual.pdf" },
      ],
    });

    expect(state.documents?.map(({ title }) => title)).toEqual(["Manual"]);
  });

  it("writes only a proposal still requested – a late result after it failed records nothing", () => {
    for (const late of ["written", "failed", "accepted", "discarded"] as const) {
      expect(writeAiModelProposal({ ...requested, state: late }, { answer: answer(), cost: 0 }, context)).toEqual({
        ok: false,
        error: "not-requested",
      });
    }
  });
});

describe("the chat model's answer", () => {
  it("is read as plain values, a year named as a number included", () => {
    expect(
      parseAiModelProposalAnswer(JSON.stringify({ title: "High Speed", year: 1986, sources: ["https://a.org"] })),
    ).toEqual({
      title: "High Speed",
      year: "1986",
      sources: ["https://a.org"],
      documents: [],
    });
  });

  it.each(["not json", "[]", "null", '"text"'])("is unusable when it is not a JSON object: %s", (content) => {
    expect(answerOfChat({ content, cost: 0.01 })).toBe("unusable");
  });

  it("ignores what is not the agreed form inside a usable answer", () => {
    const parsed = parseAiModelProposalAnswer(
      JSON.stringify({
        title: 7,
        sources: "https://a.org",
        documents: [null, "x", { title: "No link" }, { title: "T", link: "https://a.org/t.pdf" }],
      }),
    );

    expect(parsed).toEqual({
      sources: [],
      documents: [{ title: "T", link: "https://a.org/t.pdf", fileCategory: "" }],
    });
  });

  it("is told apart from a stop and a failure", () => {
    expect(answerOfChat("stopped")).toBe("stopped");
    expect(answerOfChat({ failure: "timed-out" })).toEqual({ failure: "timed-out" });
  });
});

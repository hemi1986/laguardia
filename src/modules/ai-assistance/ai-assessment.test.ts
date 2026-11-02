import { describe, expect, it } from "vitest";
import { MAX_WORK_LOG_PHOTOS } from "@/modules/repair";
import { MAX_AI_ASSESSMENT_PHOTOS, requestRefusal, type RequestAiAssessmentFacts } from "./ai-assessment";

/** The request's photos are "photos as on a work log entry" (ST-107) – the two limits must not drift apart. */
describe("the request's photo limit", () => {
  it("is the work log entry's", () => {
    expect(MAX_AI_ASSESSMENT_PHOTOS).toBe(MAX_WORK_LOG_PHOTOS);
  });
});

describe("requestRefusal – the first reason that holds, for the page and the decision alike (G11)", () => {
  const helper = { role: "helper" } as const;
  const technician = { role: "technician" } as const;
  const open = { state: "open", suitableForHelpers: true } as const;
  const notForHelpers = { state: "open", suitableForHelpers: false } as const;
  const facts = (over: Partial<RequestAiAssessmentFacts>): RequestAiAssessmentFacts => ({
    chatModel: "x/y",
    defect: open,
    beingWritten: false,
    ...over,
  });

  it.each([
    ["nothing against it", facts({}), technician, undefined],
    [
      "AI off before a defect that is not open",
      facts({ chatModel: undefined, defect: undefined }),
      technician,
      "ai-assessment-ai-off",
    ],
    [
      "a defect not open before the helper's rule",
      facts({ defect: undefined }),
      helper,
      "ai-assessment-defect-not-open",
    ],
    [
      "the helper's rule before one being written",
      facts({ defect: notForHelpers, beingWritten: true }),
      helper,
      "ai-assessment-not-allowed-for-helpers",
    ],
    [
      "nobody looking before one being written",
      facts({ beingWritten: true }),
      undefined,
      "ai-assessment-not-allowed-for-helpers",
    ],
    ["one being written", facts({ beingWritten: true }), technician, "ai-assessment-being-written"],
    ["a technician on a defect not for helpers", facts({ defect: notForHelpers }), technician, undefined],
  ] as const)("%s", (_case, given, person, refusal) => {
    expect(requestRefusal(given, person)).toBe(refusal);
  });
});

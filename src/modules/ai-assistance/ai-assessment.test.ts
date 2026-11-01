import { describe, expect, it } from "vitest";
import { MAX_WORK_LOG_PHOTOS } from "@/modules/repair";
import { MAX_AI_ASSESSMENT_PHOTOS } from "./ai-assessment";

/** The request's photos are "photos as on a work log entry" (ST-107) – the two limits must not drift apart. */
describe("the request's photo limit", () => {
  it("is the work log entry's", () => {
    expect(MAX_AI_ASSESSMENT_PHOTOS).toBe(MAX_WORK_LOG_PHOTOS);
  });
});

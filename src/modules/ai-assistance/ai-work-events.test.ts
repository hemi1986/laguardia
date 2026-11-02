import { describe, expect, it } from "vitest";
import { makesAiWork } from "./ai-work-events";

const settingsChanged = (...changedParts: string[]) => ({ type: "EVT-AiSettingsChanged", data: { changedParts } });

describe("which committed events leave AI work to do", () => {
  it.each([
    ["a file attached", { type: "EVT-FileAttached", data: {} }, true],
    ["an AI assessment requested", { type: "EVT-AiAssessmentRequested", data: {} }, true],
    ["a file tried again", { type: "EVT-FileIndexingRetried", data: {} }, true],
    ["a key saved", settingsChanged("key-saved"), true],
    ["a chat model changed", settingsChanged("chat-model"), true],
    ["an embedding model changed", settingsChanged("embedding-model"), true],
    ["the key removed", settingsChanged("key-removed"), false],
    ["a file left the AI index", { type: "EVT-FileLeftAiIndex", data: {} }, false],
    ["an event of another context", { type: "EVT-DefectClaimed", data: {} }, false],
  ])("%s", (_case, event, expected) => {
    expect(makesAiWork([event])).toBe(expected);
  });

  it("one such event among others is enough, and none is nothing", () => {
    expect(
      makesAiWork([
        { type: "EVT-DefectClaimed", data: {} },
        { type: "EVT-FileAttached", data: {} },
      ]),
    ).toBe(true);
    expect(makesAiWork([])).toBe(false);
  });
});

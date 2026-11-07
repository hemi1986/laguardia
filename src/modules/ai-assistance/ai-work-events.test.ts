import { describe, expect, it } from "vitest";
import { makesAiWork } from "./ai-work-events";

const settingsChanged = (...changedParts: string[]) => ({ type: "EVT-AiSettingsChanged", data: { changedParts } });

describe("which committed events leave AI work to do", () => {
  it.each([
    ["a file added", { type: "EVT-FileAdded", data: {} }, true],
    ["a file attached (ADR 0018: attaching causes no indexing)", { type: "EVT-FileAttached", data: {} }, false],
    ["an AI assessment requested", { type: "EVT-AiAssessmentRequested", data: {} }, true],
    ["an AI model proposal requested (ST-124)", { type: "EVT-AiModelProposalRequested", data: {} }, true],
    ["an AI model proposal written", { type: "EVT-AiModelProposalWritten", data: {} }, false],
    ["a file tried again", { type: "EVT-FileIndexingRetried", data: {} }, true],
    ["a failed link tried again (ST-130)", { type: "EVT-ProposedDocumentLoadingRetried", data: {} }, true],
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
        { type: "EVT-FileAdded", data: {} },
      ]),
    ).toBe(true);
    expect(makesAiWork([])).toBe(false);
  });
});

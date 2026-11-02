import { after } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { startAiWorkForCommitted } from "./ai-work";

vi.mock("next/server", () => ({ after: vi.fn() }));

describe("what follows a form's command", () => {
  beforeEach(() => vi.mocked(after).mockClear());

  it("starts one run after the response when the command made AI work", () => {
    startAiWorkForCommitted([{ type: "EVT-FileAttached", data: {} }]);
    expect(after).toHaveBeenCalledOnce();
  });

  it("starts nothing when it made none", () => {
    startAiWorkForCommitted([{ type: "EVT-ProblemReported", data: {} }]);
    expect(after).not.toHaveBeenCalled();
  });
});

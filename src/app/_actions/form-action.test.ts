import { describe, expect, it, vi } from "vitest";
import { startAiWorkForCommitted } from "@/app/ai-work";
import { formRunner } from "./form-runner";

vi.mock("./form-runner", () => ({ formRunner: vi.fn() }));
vi.mock("./current-person", () => ({ currentPerson: vi.fn() }));

describe("formAction", () => {
  it("starts the AI work for every form's command: the runner is bound to it", async () => {
    await import("./form-action");

    expect(formRunner).toHaveBeenCalledWith(expect.objectContaining({ afterCommit: startAiWorkForCommitted }));
  });
});

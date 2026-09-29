import { describe, expect, it } from "vitest";
import { TEST_MACHINE_ID } from "@/spike/test-machine";
import { reportProblemInput } from "./report-problem-input";

/** Q19: form data becomes command input through a typed function – it reads and converts, the decision decides. */
describe("the input of the problem report form", () => {
  it("passes the typed description to CMD-ReportProblem for the test machine", () => {
    expect(reportProblemInput({ description: "  Left flipper is weak " })).toEqual({
      machineId: TEST_MACHINE_ID,
      description: "  Left flipper is weak ",
    });
  });

  it("turns a missing description into an empty one, which the decision rejects – no exception", () => {
    expect(reportProblemInput({ description: undefined })).toEqual({ machineId: TEST_MACHINE_ID, description: "" });
  });
});

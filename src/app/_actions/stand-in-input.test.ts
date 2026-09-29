import { describe, expect, it } from "vitest";
import { reportWithPriorityInput } from "./stand-in.test-support";

/** Q19 for fields that are not free text: a missing ID or enumeration value is "no value given", never a default. */
describe("the input function of a form with an ID and an enumeration field", () => {
  it("turns a post without both fields into input with no value given for both", () => {
    expect(reportWithPriorityInput({ machineId: undefined, priority: undefined })).toEqual({
      machineId: undefined,
      priority: undefined,
    });
  });

  it("treats an empty ID and an unknown enumeration value as no value given", () => {
    expect(reportWithPriorityInput({ machineId: "", priority: "very-high" })).toEqual({
      machineId: undefined,
      priority: undefined,
    });
  });

  it("passes given values through", () => {
    expect(reportWithPriorityInput({ machineId: "m-1", priority: "high" })).toEqual({
      machineId: "m-1",
      priority: "high",
    });
  });
});

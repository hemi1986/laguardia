import { describe, expect, it } from "vitest";
import { reportWithUrgencyInput } from "./stand-in.test-support";

/** Q19 for fields that are not free text: a missing ID or enumeration value is "no value given", never a default. */
describe("the input function of a form with an ID and an enumeration field", () => {
  it("turns a post without both fields into input with no value given for both", () => {
    expect(reportWithUrgencyInput({ machineId: undefined, urgency: undefined })).toEqual({
      machineId: undefined,
      urgency: undefined,
    });
  });

  it("treats an empty ID and an unknown enumeration value as no value given", () => {
    expect(reportWithUrgencyInput({ machineId: "", urgency: "urgent" })).toEqual({
      machineId: undefined,
      urgency: undefined,
    });
  });

  it("passes given values through", () => {
    expect(reportWithUrgencyInput({ machineId: "m-1", urgency: "high" })).toEqual({ machineId: "m-1", urgency: "high" });
  });
});

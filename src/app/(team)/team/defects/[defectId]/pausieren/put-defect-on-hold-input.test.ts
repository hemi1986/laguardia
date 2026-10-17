import { describe, expect, it } from "vitest";
import { putDefectOnHoldInput } from "./put-defect-on-hold-input";

describe("putDefectOnHoldInput – reading the form „Defekt pausieren“ (ST-029)", () => {
  it("reads the chosen reason, the note and the version", () => {
    expect(putDefectOnHoldInput({ version: "3", reason: "waiting-for-part", note: "Ordered" }, "d-1")).toEqual({
      defectId: "d-1",
      version: 3,
      reason: "waiting-for-part",
      note: "Ordered",
    });
  });

  it("reads no reason chosen – or a forged one – as no reason given, never a default", () => {
    expect(putDefectOnHoldInput({ version: "0", reason: "", note: undefined }, "d-1").reason).toBeUndefined();
    expect(putDefectOnHoldInput({ version: "0", reason: "spam", note: undefined }, "d-1").reason).toBeUndefined();
  });

  it("reads a version that is no whole number as one nobody saw", () => {
    expect(putDefectOnHoldInput({ version: "x", reason: "other", note: undefined }, "d-1").version).toBe(-1);
  });
});

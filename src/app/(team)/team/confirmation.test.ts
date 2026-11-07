import { describe, expect, it } from "vitest";
import { oneOf } from "./confirmation";

describe("a parameter of the address that asks for a confirmation (G3)", () => {
  it("is the one value it has", () => {
    expect(oneOf("a")).toBe("a");
  });

  it("is none when it is missing", () => {
    expect(oneOf(undefined)).toBeUndefined();
  });

  it("is none when the address gives it twice", () => {
    expect(oneOf(["a", "b"])).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { sameSitePath } from "./same-site-path";

/** The language switch follows only a path of this site back (ST-010 review: hardening of the redirect). */
describe("the path the language switch goes back to", () => {
  it.each([
    ["/m/LG-042", "/m/LG-042"],
    ["/", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["/\tevil.example", "/"],
    ["https://evil.example", "/"],
    ["javascript:alert(1)", "/"],
    ["", "/"],
  ])("%j → %j", (back, expected) => {
    expect(sameSitePath(back)).toBe(expected);
  });
});

import { describe, expect, it } from "vitest";
import { newAccountRejection, passwordRejection } from "./account-rules";

describe("what an account needs", () => {
  const valid = { name: "Anna Berger", username: "anna", password: "anna-secret-10" };

  it.each([
    ["accepts a name, a username and a password", valid, undefined],
    ["needs a name", { ...valid, name: "   " }, "name-required"],
    ["needs a username of at least 3 characters", { ...valid, username: "an" }, "username-invalid"],
    ["allows at most 30 characters in a username", { ...valid, username: "a".repeat(31) }, "username-invalid"],
    ["allows only letters, digits, _ and . in a username", { ...valid, username: "anna berger" }, "username-invalid"],
    ["allows _ and . in a username", { ...valid, username: "anna.berger_2" }, undefined],
    ["needs 10 characters in the password", { ...valid, password: "short-one" }, "password-too-short"],
  ])("%s", (_what, input, expected) => {
    expect(newAccountRejection(input)).toBe(expected);
  });

  it("checks a password on its own the same way", () => {
    expect(passwordRejection("short-one")).toBe("password-too-short");
    expect(passwordRejection("long-enough-10")).toBeUndefined();
  });
});

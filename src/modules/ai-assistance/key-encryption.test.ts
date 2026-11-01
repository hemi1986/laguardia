import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptKey, encryptKey, encryptionKeyOf } from "./key-encryption";

/**
 * The saved OpenRouter key is kept only encrypted (ADR 0014: AES-256-GCM with `AI_SETTINGS_ENCRYPTION_KEY`). Tested at
 * the pure functions (seam decided by the user, ST-104 test plan).
 */
const environmentKey = randomBytes(32);
const apiKey = "sk-or-v1-0123456789abcdef0123456789abcdefa1b2";

describe("key encryption", () => {
  it("gives the key back with the environment key it was encrypted with", () => {
    expect(decryptKey(environmentKey, encryptKey(environmentKey, apiKey))).toBe(apiKey);
  });

  it("never contains the key, and encrypts the same key differently every time", () => {
    const once = encryptKey(environmentKey, apiKey);
    const twice = encryptKey(environmentKey, apiKey);

    expect(once).not.toContain("a1b2");
    expect(once).not.toContain(Buffer.from(apiKey).toString("base64"));
    expect(once).not.toBe(twice);
  });

  it("cannot decrypt with another environment key – the saved key then counts as none", () => {
    expect(decryptKey(randomBytes(32), encryptKey(environmentKey, apiKey))).toBeUndefined();
  });

  it("cannot decrypt a changed ciphertext", () => {
    const encrypted = encryptKey(environmentKey, apiKey);
    const [version, iv, tag, data] = encrypted.split(":");
    const changed = Buffer.from(data, "base64");
    changed[0] ^= 1;

    expect(decryptKey(environmentKey, [version, iv, tag, changed.toString("base64")].join(":"))).toBeUndefined();
    expect(decryptKey(environmentKey, "not a ciphertext")).toBeUndefined();
    // A shortened authentication tag is no tag (GCM with 16 bytes only).
    const shortTag = Buffer.from(tag, "base64").subarray(0, 4).toString("base64");
    expect(decryptKey(environmentKey, [version, iv, shortTag, data].join(":"))).toBeUndefined();
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["too short", randomBytes(16).toString("base64")],
    ["not base64 of 32 bytes", "x".repeat(44)],
  ])("reads no environment key when it is %s", (_case, value) => {
    expect(encryptionKeyOf(value)).toBeUndefined();
  });

  it("reads 32 random bytes in base64 as the environment key", () => {
    expect(encryptionKeyOf(environmentKey.toString("base64"))).toEqual(environmentKey);
  });
});

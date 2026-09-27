import { describe, expect, it } from "vitest";
import { PHOTO_LIMITS } from "./limits";
import { PhotoTooLargeError, preparePhoto, scaledSize } from "./prepare-photo";

describe("scaledSize", () => {
  it.each([
    [4032, 3024, 2048, 1536],
    [3024, 4032, 1536, 2048],
    [2048, 1000, 2048, 1000],
    [800, 600, 800, 600],
    [5000, 5000, 2048, 2048],
  ])("scales %i×%i so the long edge is at most 2048 → %i×%i", (width, height, w, h) => {
    expect(scaledSize(width, height, 2048)).toEqual({ width: w, height: h });
  });
});

describe("preparePhoto", () => {
  it("rejects originals above the maximum original size before reading them", async () => {
    const tooLarge = new Blob([new Uint8Array(PHOTO_LIMITS.maxOriginalBytes + 1)], { type: "image/jpeg" });

    await expect(preparePhoto(tooLarge)).rejects.toBeInstanceOf(PhotoTooLargeError);
  });
});

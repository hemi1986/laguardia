import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { acceptPhoto } from "./accept-photo";
import { PHOTO_LIMITS } from "./limits";

function image(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } } });
}

/** A phone-like JPEG: stored sideways with EXIF orientation 6 (rotate 90° clockwise) and a GPS location. */
async function phoneJpeg(width: number, height: number): Promise<Buffer> {
  return image(width, height)
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExifMerge({ IFD0: { Make: "TestPhone" }, IFD3: { GPSLatitudeRef: "N", GPSLongitudeRef: "E" } })
    .toBuffer();
}

/** Random noise compresses badly: a worst case for the stored size (fixed seed, so the test is stable). */
async function noisyJpeg(width: number, height: number): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3);
  let seed = 42;
  for (let i = 0; i < pixels.length; i++) pixels[i] = (seed = (seed * 1103515245 + 12345) & 0x7fffffff) >> 16;
  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 40 })
    .toBuffer();
}

/** EXIF tag 0x8825 points to the GPS IFD (either byte order). */
function hasGpsIfd(exif: Buffer | undefined): boolean {
  return !!exif && (exif.includes(Buffer.from([0x88, 0x25])) || exif.includes(Buffer.from([0x25, 0x88])));
}

describe("acceptPhoto", () => {
  it("the test fixture really carries EXIF with GPS and orientation", async () => {
    const meta = await sharp(await phoneJpeg(400, 200)).metadata();
    expect(meta.orientation).toBe(6);
    expect(meta.exif?.toString("latin1")).toContain("TestPhone");
    expect(hasGpsIfd(meta.exif)).toBe(true);
  });

  it("re-encodes as JPEG, rotated by its EXIF orientation, without any metadata", async () => {
    const result = await acceptPhoto(await phoneJpeg(400, 200));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const meta = await sharp(result.photo.bytes).metadata();
    expect(meta.format).toBe("jpeg");
    expect([meta.width, meta.height]).toEqual([200, 400]);
    expect(meta.orientation).toBeUndefined();
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(result.photo).toMatchObject({ contentType: "image/jpeg", width: 200, height: 400 });
  });

  it("downscales so the long edge is at most the maximum", async () => {
    const big = await image(4000, 3000).png().toBuffer();

    const result = await acceptPhoto(big);

    expect(result.ok && [result.photo.width, result.photo.height]).toEqual([PHOTO_LIMITS.maxEdgePx, 1536]);
  });

  it("stores at most the maximum stored size, even for photos that compress badly", async () => {
    const noisy = await noisyJpeg(2048, 1536);
    expect(noisy.byteLength).toBeLessThanOrEqual(PHOTO_LIMITS.maxUploadBytes);

    const result = await acceptPhoto(noisy);

    expect(result.ok && result.photo.bytes.byteLength).toBeLessThanOrEqual(PHOTO_LIMITS.maxStoredBytes);
  });

  it("keeps small photos at their size", async () => {
    const result = await acceptPhoto(await image(640, 480).webp().toBuffer());

    expect(result.ok && [result.photo.width, result.photo.height]).toEqual([640, 480]);
  });

  it("puts transparent images on a white background", async () => {
    const transparent = await sharp({
      create: { width: 20, height: 20, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();

    const result = await acceptPhoto(transparent);

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    const { data } = await sharp(result.photo.bytes).raw().toBuffer({ resolveWithObject: true });
    expect(Math.min(...data.subarray(0, 3))).toBeGreaterThan(245);
  });

  it("rejects content that is not an image", async () => {
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj << >> endobj\n%%EOF\n");

    expect(await acceptPhoto(pdf)).toEqual({ ok: false, error: "not-an-image" });
  });

  it("rejects image formats other than JPEG, PNG and WebP", async () => {
    const gif = await image(10, 10).gif().toBuffer();

    expect(await acceptPhoto(gif)).toEqual({ ok: false, error: "unsupported-format" });
  });

  it("rejects a corrupt image instead of failing", async () => {
    const jpeg = await image(400, 300).jpeg().toBuffer();
    const truncated = jpeg.subarray(0, Math.floor(jpeg.byteLength / 2));

    expect(await acceptPhoto(truncated)).toEqual({ ok: false, error: "not-an-image" });
  });

  it("rejects HEIF/AVIF, which the server cannot handle for phone photos", async () => {
    const avif = await image(64, 64).avif().toBuffer();

    expect(await acceptPhoto(avif)).toEqual({ ok: false, error: "unsupported-format" });
  });

  it("rejects images with more pixels than the maximum before decoding them", async () => {
    const huge = await sharp({ create: { width: 8000, height: 8000, channels: 3, background: "#fff" } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    expect(huge.byteLength).toBeLessThanOrEqual(PHOTO_LIMITS.maxUploadBytes);

    expect(await acceptPhoto(huge)).toEqual({ ok: false, error: "too-large" });
  });

  it("rejects photos above the maximum upload size before decoding them", async () => {
    const tooLarge = Buffer.alloc(PHOTO_LIMITS.maxUploadBytes + 1);

    expect(await acceptPhoto(tooLarge)).toEqual({ ok: false, error: "too-large" });
  });
});

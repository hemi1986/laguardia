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

  it("keeps small photos at their size", async () => {
    const result = await acceptPhoto(await image(640, 480).webp().toBuffer());

    expect(result.ok && [result.photo.width, result.photo.height]).toEqual([640, 480]);
  });

  it("rejects content that is not an image", async () => {
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj << >> endobj\n%%EOF\n");

    expect(await acceptPhoto(pdf)).toEqual({ ok: false, error: "not-an-image" });
  });

  it("rejects image formats other than JPEG, PNG and WebP", async () => {
    const gif = await image(10, 10).gif().toBuffer();

    expect(await acceptPhoto(gif)).toEqual({ ok: false, error: "unsupported-format" });
  });

  it("rejects photos above the maximum upload size before decoding them", async () => {
    const tooLarge = Buffer.alloc(PHOTO_LIMITS.maxUploadBytes + 1);

    expect(await acceptPhoto(tooLarge)).toEqual({ ok: false, error: "too-large" });
  });
});

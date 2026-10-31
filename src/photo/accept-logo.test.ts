import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { acceptLogo } from "./accept-logo";

/**
 * The logo acceptance (ST-102, *What is stored*) beyond the scenarios: a phone photo upright, an animated image its first
 * frame, a small image never enlarged, and each of the three formats kept.
 */
const image = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 4, background: { r: 10, g: 120, b: 40, alpha: 0.5 } } });

describe("accepting a logo", () => {
  it("applies a JPEG's orientation and drops its metadata", async () => {
    const sideways = await image(300, 100)
      .flatten()
      .jpeg()
      .withMetadata({ orientation: 6 })
      .withExifMerge({ IFD0: { Make: "TestPhone" } })
      .toBuffer();

    const accepted = await acceptLogo(sideways);

    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.logo.contentType).toBe("image/jpeg");
    const meta = await sharp(accepted.logo.bytes).metadata();
    expect(meta).toMatchObject({ format: "jpeg", width: 100, height: 300 });
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
  });

  it("keeps only the first frame of an animated image", async () => {
    const frames = Buffer.concat([
      await image(80, 40).raw().toBuffer(),
      await image(80, 40).negate({ alpha: false }).raw().toBuffer(),
    ]);
    const animated = await sharp(frames, { raw: { width: 80, height: 80, channels: 4, pageHeight: 40 } })
      .webp({ loop: 0, delay: [100, 100] })
      .toBuffer();
    expect((await sharp(animated).metadata()).pages).toBe(2);

    const accepted = await acceptLogo(animated);

    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    const meta = await sharp(accepted.logo.bytes).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 80, height: 40, hasAlpha: true });
    expect(meta.pages ?? 1).toBe(1);
  });

  it.each([
    ["png", "image/png"],
    ["webp", "image/webp"],
  ] as const)("never enlarges a small %s and keeps its format", async (format, contentType) => {
    const accepted = await acceptLogo(await image(120, 60).toFormat(format).toBuffer());

    expect(accepted).toMatchObject({ ok: true, logo: { contentType } });
    if (accepted.ok) expect(await sharp(accepted.logo.bytes).metadata()).toMatchObject({ width: 120, height: 60 });
  });

  it.each([
    ["nothing", new Uint8Array()],
    ["text", new TextEncoder().encode("not an image")],
  ])("rejects %s as no image", async (_case, bytes) => {
    expect(await acceptLogo(bytes)).toEqual({ ok: false, error: "not-a-logo-image" });
  });
});

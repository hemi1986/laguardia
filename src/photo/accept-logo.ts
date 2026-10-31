import "server-only";
import sharp, { type Metadata } from "sharp";
import { LOGO_LIMITS, PHOTO_LIMITS } from "./limits";

/** Every way a logo can fail – each with a text in the team catalog (ST-102). */
export const logoErrors = ["logo-too-large", "not-a-logo-image", "logo-not-stored"] as const;
export type LogoError = (typeof logoErrors)[number];

export type AcceptedLogo = { bytes: Buffer; contentType: "image/png" | "image/jpeg" | "image/webp"; extension: string };

const formats = {
  png: { contentType: "image/png", extension: "png" },
  jpeg: { contentType: "image/jpeg", extension: "jpg" },
  webp: { contentType: "image/webp", extension: "webp" },
} as const;

const isLogoFormat = (format: string | undefined): format is keyof typeof formats =>
  !!format && Object.hasOwn(formats, format);

/**
 * The logo's acceptance (ST-102), next to the photo acceptance – which turns every image into a JPEG on white and would
 * destroy a logo's transparency: the file at most 2 MB; really a PNG, JPEG or WebP image (by its content, not its name –
 * SVG never) within the photo module's pixel limit; then scaled down to at most 1000 px on its long edge (never
 * enlarged), a JPEG's orientation applied, every metadata dropped, an animated image its first frame, and stored in its
 * own format, so a PNG or WebP keeps its transparency. Never throws for bad input.
 */
export async function acceptLogo(input: Uint8Array): Promise<{ ok: true; logo: AcceptedLogo } | { ok: false; error: LogoError }> {
  if (input.byteLength > LOGO_LIMITS.maxUploadBytes) return { ok: false, error: "logo-too-large" };
  if (input.byteLength === 0) return { ok: false, error: "not-a-logo-image" };

  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    return { ok: false, error: "not-a-logo-image" };
  }
  if (!isLogoFormat(meta.format) || !meta.width || !meta.height) return { ok: false, error: "not-a-logo-image" };
  // A small file can have huge dimensions – the same text as any other image that is not accepted (user, 2026-10-31).
  const frameHeight = meta.pageHeight ?? meta.height;
  if (meta.width * frameHeight > PHOTO_LIMITS.maxInputPixels) return { ok: false, error: "not-a-logo-image" };

  const { contentType, extension } = formats[meta.format];
  try {
    // Only the first frame (pages: 1); sharp keeps no metadata unless told to, .rotate() applies the EXIF orientation.
    const image = sharp(input, { pages: 1, limitInputPixels: PHOTO_LIMITS.maxInputPixels })
      .rotate()
      .resize({ width: LOGO_LIMITS.maxEdgePx, height: LOGO_LIMITS.maxEdgePx, fit: "inside", withoutEnlargement: true });
    const encoded =
      meta.format === "png"
        ? image.png({ compressionLevel: 9 })
        : meta.format === "webp"
          ? image.webp({ quality: 90 })
          : image.jpeg({ quality: 85, mozjpeg: true });
    return { ok: true, logo: { bytes: await encoded.toBuffer(), contentType, extension } };
  } catch {
    return { ok: false, error: "not-a-logo-image" };
  }
}

import "server-only";
import sharp, { type Metadata } from "sharp";
import { PHOTO_LIMITS } from "./limits";

export type AcceptedPhoto = { bytes: Buffer; contentType: "image/jpeg"; width: number; height: number };

export type AcceptPhotoResult =
  { ok: true; photo: AcceptedPhoto } | { ok: false; error: "too-large" | "not-an-image" | "unsupported-format" };

const SIZE_STEPS = 4;
const QUALITIES = [82, 72, 62, 50];

/**
 * Server-side check of every received photo: size and pixel limits, real image of an accepted format, then
 * re-encoded as JPEG – rotated by its EXIF orientation first, downscaled, transparent areas white, and without
 * any metadata (EXIF incl. GPS, ICC, XMP). Never throws for bad input: corrupt files are "not-an-image".
 */
export async function acceptPhoto(input: Uint8Array): Promise<AcceptPhotoResult> {
  if (input.byteLength > PHOTO_LIMITS.maxUploadBytes) return { ok: false, error: "too-large" };

  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    return { ok: false, error: "not-an-image" };
  }
  if (!(PHOTO_LIMITS.acceptedFormats as readonly string[]).includes(meta.format ?? "")) {
    return { ok: false, error: "unsupported-format" };
  }
  if (!meta.width || !meta.height) return { ok: false, error: "not-an-image" };
  if (meta.width * meta.height > PHOTO_LIMITS.maxInputPixels) return { ok: false, error: "too-large" };

  try {
    let maxEdge: number = PHOTO_LIMITS.maxEdgePx;
    for (let step = 0; step < SIZE_STEPS; step++) {
      // Decode once per size step; sharp keeps no metadata unless told to, .rotate() applies the EXIF orientation.
      const { data: pixels, info } = await sharp(input, { limitInputPixels: PHOTO_LIMITS.maxInputPixels })
        .rotate()
        .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" })
        .raw()
        .toBuffer({ resolveWithObject: true });
      const raw = { width: info.width, height: info.height, channels: info.channels };
      for (const quality of QUALITIES) {
        const bytes = await sharp(pixels, { raw }).jpeg({ quality, mozjpeg: true }).toBuffer();
        if (bytes.byteLength <= PHOTO_LIMITS.maxStoredBytes) {
          return { ok: true, photo: { bytes, contentType: "image/jpeg", width: info.width, height: info.height } };
        }
      }
      maxEdge = Math.round(maxEdge * 0.75);
    }
    return { ok: false, error: "too-large" };
  } catch {
    return { ok: false, error: "not-an-image" };
  }
}

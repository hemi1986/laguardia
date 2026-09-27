import "server-only";
import sharp from "sharp";
import { PHOTO_LIMITS } from "./limits";

export type AcceptedPhoto = { bytes: Buffer; contentType: "image/jpeg"; width: number; height: number };

export type AcceptPhotoResult =
  { ok: true; photo: AcceptedPhoto } | { ok: false; error: "too-large" | "not-an-image" | "unsupported-format" };

/**
 * Server-side check of every received photo: size limit, real image of an accepted format, then re-encoded as
 * JPEG – rotated by its EXIF orientation first, downscaled, and without any metadata (EXIF incl. GPS, ICC, XMP).
 */
export async function acceptPhoto(input: Uint8Array): Promise<AcceptPhotoResult> {
  if (input.byteLength > PHOTO_LIMITS.maxUploadBytes) return { ok: false, error: "too-large" };

  let format: string | undefined;
  try {
    format = (await sharp(input).metadata()).format;
  } catch {
    return { ok: false, error: "not-an-image" };
  }
  if (!(PHOTO_LIMITS.acceptedFormats as readonly string[]).includes(format ?? "")) {
    return { ok: false, error: "unsupported-format" };
  }

  // sharp drops all metadata unless told to keep it; .rotate() without arguments applies the EXIF orientation.
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: PHOTO_LIMITS.maxEdgePx, height: PHOTO_LIMITS.maxEdgePx, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { ok: true, photo: { bytes: data, contentType: "image/jpeg", width: info.width, height: info.height } };
}

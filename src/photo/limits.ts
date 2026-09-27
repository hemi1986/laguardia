/**
 * Limits for photos of problem reports (ST-016), work log entries (ST-032) and files of the category Photo (ST-054).
 * Decided in the ST-002 spike: the browser downscales to maxEdgePx and re-encodes as JPEG of at most
 * clientTargetBytes; the server accepts at most maxUploadBytes and re-encodes again.
 */
export const PHOTO_LIMITS = {
  maxEdgePx: 2048,
  clientTargetBytes: 1_000_000,
  maxUploadBytes: 2_000_000,
  acceptedFormats: ["jpeg", "png", "webp"],
} as const;

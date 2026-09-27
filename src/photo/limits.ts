/**
 * Limits for photos of problem reports (ST-016), work log entries (ST-032) and files of the category Photo (ST-054).
 * Decided in the ST-002 spike: the browser accepts originals up to maxOriginalBytes (the limit shown to people),
 * downscales to maxEdgePx and re-encodes as JPEG of at most maxStoredBytes; the server accepts at most
 * maxUploadBytes and re-encodes again, guaranteeing maxEdgePx and maxStoredBytes.
 */
export const PHOTO_LIMITS = {
  maxOriginalBytes: 20_000_000,
  maxEdgePx: 2048,
  maxStoredBytes: 1_000_000,
  maxUploadBytes: 2_000_000,
  acceptedFormats: ["jpeg", "png", "webp"],
} as const;

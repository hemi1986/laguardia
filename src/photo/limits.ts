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
  /**
   * What the browser prepares each photo of a form with several to (ST-032, user 2026-10-25): 5 photos of a work log
   * entry must fit one Server Action body (4 MB in next.config.ts, below Vercel's 4.5 MB). The server's limits stay.
   */
  maxPreparedBytesOfSeveral: 600_000,
  maxUploadBytes: 2_000_000,
  /** Decoding guard (≈ 5000 × 5000); prepared photos are at most 2048 × 2048. */
  maxInputPixels: 25_000_000,
  acceptedFormats: ["jpeg", "png", "webp"],
} as const;

/**
 * What the museum's logo may be (ST-102, user 2026-10-31): the chosen file at most 2 MB, stored at most 1000 px on its
 * long edge – the welcome page shows it at most a third of the screen's height.
 */
export const LOGO_LIMITS = { maxUploadBytes: 2_000_000, maxEdgePx: 1000 } as const;

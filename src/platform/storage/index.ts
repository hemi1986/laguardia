/**
 * The storage seam (ST-016, architecture review 2026-09-27 Q8/Q16, ADR 0007): where photo and file content lives,
 * outside the database. One interface, two adapters – Vercel Blob in production (`blobStorage`), in memory in
 * integration tests (`memoryStorage`) – injected like the clock and the ID generator. Names come from the caller
 * (from the injected ID generator); this seam decides nothing about who may store or see what.
 */
export type ContentStorage = {
  /** Stores private content under its name. */
  write(name: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** Removes the content for good – Blob has no restore (ADR 0006), so only for deliberate removal or a failed command. */
  delete(name: string): Promise<void>;
  /** An address to show the content, valid until the given time – only issued after the page's access check. */
  viewAddress(name: string, validUntil: Date): Promise<string>;
};

export { memoryStorage, type MemoryStorage } from "./memory-storage";
export { blobStorage } from "./blob-storage";

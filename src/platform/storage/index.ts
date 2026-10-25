/**
 * The storage seam (ST-016, architecture review 2026-09-27 Q8/Q16, ADR 0009): where photo and file content lives,
 * outside the database. One interface, two adapters – Vercel Blob in production (`blobStorage`), in memory in
 * integration tests (`memoryStorage`) – injected like the clock and the ID generator. Names come from the caller
 * (from the injected ID generator); this seam decides nothing about who may store or see what.
 */
export type ContentStorage = {
  /** Stores private content under its name. */
  write(name: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** Removes the content for good – Blob has no restore (ADR 0006), so only for deliberate removal or a failed command. */
  delete(name: string): Promise<void>;
  /**
   * Addresses to show content, valid until the given time – one call per page, however many it shows. Only issued
   * after the page's access check. With `download`, the browser saves the content instead of opening it (ST-037).
   */
  viewAddresses(
    names: readonly string[],
    validUntil: Date,
    options?: { download?: boolean },
  ): Promise<Map<string, string>>;
  /**
   * A permission for the browser to upload content of at most `maximumSize` bytes under exactly this name, until the
   * given time (ST-085, ADR 0009) – the content then goes straight to the store, never through a function. Only issued
   * after the server's own access check; the size limit is the caller's. Blob refuses more only for an upload in one
   * piece – an upload in parts (above 20 MB) is not held to it (found in ST-085), so whoever attaches checks `size`.
   */
  uploadAddress(name: string, limits: UploadLimits): Promise<UploadAddress>;
  /**
   * What the store says about the content under a name – its size in bytes and its media type – or undefined when
   * nothing is stored there. Blob holds an upload in parts to no size limit (ST-085), so whoever attaches uploaded
   * content checks its size here; the media type is the one the store keeps, not what a form claims (ST-037).
   */
  details(name: string): Promise<ContentDetails | undefined>;
};

export type ContentDetails = { size: number; contentType: string };

export type UploadLimits = { maximumSize: number; validUntil: Date };

/** What the browser needs to upload under one name – passed through to it as JSON, opaque to everyone else. */
export type UploadAddress = object;

export { memoryStorage, type MemoryStorage } from "./memory-storage";
export { blobStorage } from "./blob-storage";

/**
 * Deletes content a command removed on purpose – a spam dismissal's photo (ST-020), a removed file's content (ST-038),
 * ADR 0009 – after that command was committed, so the removal stands whatever happens here. A failed delete is logged
 * by the content's stored name only, never with the content or anyone's text, so it can be deleted by hand later; the
 * person still gets their answer.
 */
export async function deleteRemovedContent(storage: ContentStorage, name: string): Promise<void> {
  try {
    await storage.delete(name);
  } catch (error) {
    console.error(`content not deleted, delete it by hand: ${name}:`, error instanceof Error ? error.message : error);
  }
}

/**
 * The storage seam (ST-016, architecture review 2026-09-27 Q8/Q16, ADR 0009): where photo and file content lives,
 * outside the database. One interface, two adapters – S3 on Vercel and locally (`s3Storage`, ADR 0012), in memory in
 * integration tests (`memoryStorage`) – injected like the clock and the ID generator. Names come from the caller
 * (from the injected ID generator); this seam decides nothing about who may store or see what.
 */
export type ContentStorage = {
  /** Stores private content under its name. */
  write(name: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** Removes the content for good – the bucket has no restore (ADR 0012), so only for deliberate removal or a failed command. */
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
   * A permission for the browser to upload content of exactly the declared size and media type under exactly this
   * name, once, until the given time (ST-085, ST-099, ADR 0009/0012) – the content then goes straight to the store,
   * never through a function. Only issued after the server's own access check, which also holds the declared size to
   * the caller's limit: the store refuses any other length, name or media type, and a late request.
   */
  uploadAddress(name: string, declared: DeclaredUpload): Promise<UploadAddress>;
  /**
   * What the store says about the content under a name – its size in bytes and its media type – or undefined when
   * nothing is stored there. Whoever attaches uploaded content checks it here once more (ADR 0009); the media type is
   * the one the store keeps, not what a form claims (ST-037).
   */
  details(name: string): Promise<ContentDetails | undefined>;
};

export type ContentDetails = { size: number; contentType: string };

/** What the browser declared it will upload – its exact size in bytes and its media type –, and until when. */
export type DeclaredUpload = { size: number; contentType: string; validUntil: Date };

/**
 * What the browser needs to upload under one name: one PUT of the content to `url` with these `headers` (ST-099). It
 * goes to the browser as JSON.
 */
export type UploadAddress = { url: string; headers: Record<string, string> };

export { memoryStorage, type MemoryStorage } from "./memory-storage";
export { s3Storage } from "./s3-storage";
export { s3Settings, storeOrigin, type S3Settings } from "./s3-settings";
export { deleteRemovedContent } from "./delete-removed-content";

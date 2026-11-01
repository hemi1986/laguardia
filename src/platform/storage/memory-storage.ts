import type { ContentStorage, DeclaredUpload, UploadAddress } from ".";

export type MemoryStorage = ContentStorage & {
  /** What is stored under a name – undefined when nothing is (never written, or deleted). */
  read(name: string): { bytes: Uint8Array; contentType: string } | undefined;
  /** The names of everything stored. */
  names(): string[];
  /**
   * What the browser does with an upload address (ST-085, ST-099): stores the content under the address's name –
   * refused, like the S3 store refuses it, when the address is no longer valid at `at`, when the content's length or
   * media type is not the declared one, or when something is already stored under the name.
   */
  upload(address: UploadAddress, bytes: Uint8Array, contentType: string, at: Date): Promise<void>;
};

/**
 * The in-memory adapter of the storage seam (ST-016, Q16): integration tests use it, so they never reach a store.
 * Its view address only names the content and its validity – there is nothing behind it to open.
 */
export function memoryStorage(): MemoryStorage {
  const stored = new Map<string, { bytes: Uint8Array; contentType: string }>();
  const issued = new Map<string, { name: string } & DeclaredUpload>();
  return {
    async write(name, bytes, contentType) {
      stored.set(name, { bytes, contentType });
    },
    async delete(name) {
      stored.delete(name);
    },
    async viewAddresses(names, validUntil, { download = false } = {}) {
      const suffix = download ? "&download=1" : "";
      return new Map(names.map((name) => [name, `memory://${name}?valid-until=${validUntil.toISOString()}${suffix}`]));
    },
    async uploadAddress(name, declared) {
      const url = `memory://${name}?upload-until=${declared.validUntil.toISOString()}&size=${declared.size}`;
      issued.set(url, { name, ...declared });
      return { url, headers: { "Content-Type": declared.contentType, "If-None-Match": "*" } };
    },
    async upload(address, bytes, contentType, at) {
      const declared = issued.get(address.url);
      if (!declared) throw new Error("not an upload address of this store");
      if (at.getTime() > declared.validUntil.getTime()) throw new Error("upload address expired");
      if (bytes.length !== declared.size) throw new Error("content length differs from the declared size");
      if (contentType !== declared.contentType) throw new Error("media type differs from the declared one");
      if (stored.has(declared.name)) throw new Error("content already stored under the name");
      stored.set(declared.name, { bytes, contentType });
    },
    async details(name) {
      const content = stored.get(name);
      return content && { size: content.bytes.length, contentType: content.contentType };
    },
    async readContent(name) {
      return stored.get(name)?.bytes;
    },
    read: (name) => stored.get(name),
    names: () => [...stored.keys()],
  };
}

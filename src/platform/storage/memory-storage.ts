import type { ContentStorage, UploadAddress } from ".";

export type MemoryStorage = ContentStorage & {
  /** What is stored under a name – undefined when nothing is (never written, or deleted). */
  read(name: string): { bytes: Uint8Array; contentType: string } | undefined;
  /** The names of everything stored. */
  names(): string[];
  /**
   * What the browser does with an upload address (ST-085): stores the content under the address's name – refused, like
   * Blob refuses it, when the content is larger than the address allows or the address is no longer valid at `at`.
   */
  upload(address: UploadAddress, bytes: Uint8Array, contentType: string, at: Date): Promise<void>;
};

/**
 * The in-memory adapter of the storage seam (ST-016, Q16): integration tests use it, so they never reach Vercel Blob.
 * Its view address only names the content and its validity – there is nothing behind it to open.
 */
export function memoryStorage(): MemoryStorage {
  const stored = new Map<string, { bytes: Uint8Array; contentType: string }>();
  return {
    async write(name, bytes, contentType) {
      stored.set(name, { bytes, contentType });
    },
    async delete(name) {
      stored.delete(name);
    },
    async viewAddresses(names, validUntil) {
      return new Map(names.map((name) => [name, `memory://${name}?valid-until=${validUntil.toISOString()}`]));
    },
    async uploadAddress(name, { maximumSize, validUntil }) {
      return { name, maximumSize, validUntil: validUntil.toISOString() };
    },
    async upload(address, bytes, contentType, at) {
      const { name, maximumSize, validUntil } = address as { name: string; maximumSize: number; validUntil: string };
      if (at.getTime() > new Date(validUntil).getTime()) throw new Error("upload address expired");
      if (bytes.length > maximumSize) throw new Error("content too large for the upload address");
      stored.set(name, { bytes, contentType });
    },
    async size(name) {
      return stored.get(name)?.bytes.length;
    },
    read: (name) => stored.get(name),
    names: () => [...stored.keys()],
  };
}

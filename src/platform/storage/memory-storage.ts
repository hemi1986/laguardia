import type { ContentStorage } from ".";

export type MemoryStorage = ContentStorage & {
  /** What is stored under a name – undefined when nothing is (never written, or deleted). */
  read(name: string): { bytes: Uint8Array; contentType: string } | undefined;
  /** The names of everything stored. */
  names(): string[];
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
    read: (name) => stored.get(name),
    names: () => [...stored.keys()],
  };
}

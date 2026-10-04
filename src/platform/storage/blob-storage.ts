import "server-only";
import { del, issueSignedToken, presignUrl, put } from "@vercel/blob";
import type { ContentStorage } from ".";

/**
 * The Vercel Blob adapter of the storage seam (ST-016, ADR 0006/0007) – the only file that may import `@vercel/blob`
 * (lint). Content goes into the private store under the caller's name; it is read only through presigned addresses.
 * Credentials come from the environment (`BLOB_STORE_ID` with OIDC on Vercel, `BLOB_READ_WRITE_TOKEN` locally).
 */
export function blobStorage(): ContentStorage {
  return {
    async write(name, bytes, contentType) {
      await put(name, Buffer.from(bytes), { access: "private", contentType, addRandomSuffix: false });
    },
    async delete(name) {
      await del(name);
    },
    async viewAddresses(names, validUntil) {
      if (names.length === 0) return new Map();
      const until = validUntil.getTime();
      // One request for a read token per page; every address is then signed here. The signing key stays on the
      // server – an address only carries the delegation, so it opens its own content and nothing else.
      const token = await issueSignedToken({ pathname: "*", operations: ["get"], validUntil: until });
      const signed = await Promise.all(
        names.map(async (name) => {
          const { presignedUrl } = await presignUrl(token, {
            operation: "get",
            pathname: name,
            access: "private",
            validUntil: until,
          });
          return [name, presignedUrl] as const;
        }),
      );
      return new Map(signed);
    },
  };
}

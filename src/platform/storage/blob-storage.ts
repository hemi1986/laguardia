import "server-only";
import { BlobNotFoundError, del, head, issueSignedToken, presignUrl, put } from "@vercel/blob";
import { handleUploadPresigned } from "@vercel/blob/client";
import type { ContentStorage } from ".";

/**
 * The Vercel Blob adapter of the storage seam (ST-016, ST-085, ADR 0006/0009) – the only file that may import `@vercel/blob`
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
    async uploadAddress(name, { maximumSize, validUntil }) {
      const until = validUntil.getTime();
      // The delegation itself carries the name, the size limit and the time: Blob refuses a larger body, another name
      // or a late request, whatever the browser sends (ADR 0006/0009). Without overwriting, a name is used once.
      const token = await issueSignedToken({
        pathname: name,
        operations: ["put"],
        maximumSizeInBytes: maximumSize,
        validUntil: until,
      });
      // handleUploadPresigned is the library's one public way to turn the delegation into what `uploadPresigned` in the
      // browser expects. Only its issuing branch runs here: no completion callback is registered or accepted, so the
      // webhook key it insists on is never used.
      const issued = await handleUploadPresigned({
        body: {
          type: "blob.generate-presigned-url",
          payload: { pathname: name, multipart: true, clientPayload: null },
        },
        request: new Request("https://upload-address.invalid/"),
        webhookPublicKey: "unused – no upload completion callbacks",
        getSignedToken: async () => ({
          token,
          urlOptions: {
            maximumSizeInBytes: maximumSize,
            validUntil: until,
            allowOverwrite: false,
            addRandomSuffix: false,
          },
        }),
      });
      if (issued.type !== "blob.generate-presigned-url") throw new Error("Blob issued no upload address");
      return issued.presignedUrlPayload;
    },
    async details(name) {
      try {
        const { size, contentType } = await head(name);
        return { size, contentType };
      } catch (error) {
        if (error instanceof BlobNotFoundError) return undefined;
        throw error;
      }
    },
  };
}

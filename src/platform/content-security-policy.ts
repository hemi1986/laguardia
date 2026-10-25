import { randomBytes } from "node:crypto";

/**
 * The Content Security Policy of every page (ST-070): scripts only with the request's nonce – what they load follows
 * through `'strict-dynamic'` –, styles only from the application or with the nonce, nothing framed, no plugins. Next.js
 * reads the nonce from the request's policy and puts it on its own scripts, so every page is rendered per request.
 */
export function contentSecurityPolicy({
  nonce,
  development,
  blobStoreHost,
}: {
  nonce: string;
  /** `next dev` – React needs `eval` there for its debugging information, never on a preview or in production. */
  development: boolean;
  /** The private Vercel Blob store's host – photos and files are shown from and uploaded to it (ADR 0006). */
  blobStoreHost: string | undefined;
}): string {
  const blob = blobStoreHost ? ` https://${blobStoreHost}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' blob: data:${blob}`,
    `connect-src 'self'${blob}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** A fresh, unpredictable nonce: 128 bits, base64 (ST-070). */
export function newNonce(): string {
  return randomBytes(16).toString("base64");
}

/**
 * The host of the private Blob store this deployment uses: from `BLOB_STORE_ID` on Vercel (OIDC), else from the store
 * ID inside `BLOB_READ_WRITE_TOKEN` (`vercel_blob_rw_<store ID>_<secret>`, locally) – no general wildcard.
 */
export function blobStoreHost(environment: Record<string, string | undefined> = process.env): string | undefined {
  const storeId = environment.BLOB_STORE_ID?.trim() || environment.BLOB_READ_WRITE_TOKEN?.split("_")[3];
  if (!storeId) return undefined;
  return `${storeId.replace(/^store_/, "").toLowerCase()}.private.blob.vercel-storage.com`;
}

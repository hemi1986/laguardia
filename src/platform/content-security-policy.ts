import { randomBytes } from "node:crypto";

/**
 * The Content Security Policy of every page (ST-070): scripts only with the request's nonce – what they load follows
 * through `'strict-dynamic'` –, styles only from the application or with the nonce, nothing framed, no plugins. Next.js
 * reads the nonce from the request's policy and puts it on its own scripts, so every page is rendered per request.
 */
export function contentSecurityPolicy({
  nonce,
  development,
  storeOrigin,
}: {
  nonce: string;
  /**
   * `next dev` – React needs `eval` there for its debugging information, and the Next.js dev tools insert `<style>`
   * elements without the nonce; never on a preview or in production.
   */
  development: boolean;
  /**
   * The origin of the deployment's private bucket – photos and files are shown from and uploaded to it, and nothing
   * else outside the application (ST-099, ADR 0012). From the S3 adapter's settings (`storeOrigin`), never a wildcard.
   */
  storeOrigin: string | undefined;
}): string {
  const store = storeOrigin ? ` ${storeOrigin}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    development ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    // A nonce does not cover `style` attributes, which React renders from `style` props and Base UI sets on its
    // controls; they may be inline – `<style>` elements still need the nonce, and scripts stay strict (ST-070, user
    // 2026-10-25).
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' blob: data:${store}`,
    `connect-src 'self'${store}`,
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


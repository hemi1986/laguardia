/**
 * Whether a request comes from a page of this site (CSRF, ST-003): its Origin must name the host it was sent to. A
 * forged cross-site request from a victim's browser can set neither the Origin nor `x-forwarded-host`, which Vercel's
 * edge sets (as Next.js's own Server Action check uses it). A request without an Origin is not from our pages.
 */
export function isSameOrigin(headers: Headers): boolean {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  const origin = headers.get("origin");
  return Boolean(origin && host && originHost(origin) === host);
}

function originHost(origin: string): string | undefined {
  try {
    return new URL(origin).host;
  } catch {
    return undefined;
  }
}

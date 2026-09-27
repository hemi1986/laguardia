import "server-only";
import type { Database } from "@/platform/command";
import { authFor } from "./auth";

/**
 * Better Auth sets the session cookie's lifetime only when it issues it (90 days) – and Next.js does not let it
 * re-issue the cookie while a page renders. So the browser would drop the cookie 90 days after login even while the
 * session in the database slides with every use (ST-004: "90 days without use"). The proxy calls this on every page
 * request and sends the cookie again with a fresh 90 days; the database still decides whether the session is valid.
 */
export async function renewedSessionCookie({
  db,
  cookieHeader,
}: {
  db: Database;
  cookieHeader: string;
}): Promise<{ name: string; value: string; attributes: Record<string, unknown> } | undefined> {
  const { authCookies } = await authFor(db, true).$context;
  const { name, attributes } = authCookies.sessionToken;
  const value = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  return value ? { name, value, attributes } : undefined;
}

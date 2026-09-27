import { NextResponse, type NextRequest } from "next/server";
import { renewedSessionCookie } from "@/modules/team";
import { database } from "@/platform/database";

/**
 * CSRF protection for commands (ST-003). Every command is a Server Action: a POST to a page route.
 * Next.js rejects a Server Action whose Origin differs from the host, but lets a request without an Origin
 * through. Here every POST to a page must carry the page's own origin.
 * Route handlers under /api check their own signatures (e.g. Vercel Blob callbacks) and are not matched.
 */
export async function proxy(request: NextRequest) {
  if (request.method !== "POST") return withRenewedSessionCookie(request, NextResponse.next());
  // x-forwarded-host is set by Vercel's edge (as Next.js's own Server Action check uses it); a forged cross-site
  // request from a victim's browser can set neither it nor the Origin.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const origin = request.headers.get("origin");
  if (!origin || !host || originHost(origin) !== host) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return withRenewedSessionCookie(request, NextResponse.next());
}

/** The session cookie slides with every page request – 90 days without use (ST-004, src/modules/team/session-cookie.ts). */
async function withRenewedSessionCookie(request: NextRequest, response: NextResponse): Promise<NextResponse> {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return response;
  const renewed = await renewedSessionCookie({ db: database(), cookieHeader });
  if (renewed) response.cookies.set(renewed.name, renewed.value, renewed.attributes);
  return response;
}

function originHost(origin: string): string | undefined {
  try {
    return new URL(origin).host;
  } catch {
    return undefined;
  }
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};

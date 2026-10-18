import { NextResponse, type NextRequest } from "next/server";
import { renewedSessionCookie } from "@/modules/team";
import { database } from "@/platform/database";
import { isSameOrigin } from "@/platform/same-origin";

/**
 * CSRF protection for commands (ST-003). Every command is a Server Action: a POST to a page route.
 * Next.js rejects a Server Action whose Origin differs from the host, but lets a request without an Origin
 * through. Here every POST to a page must carry the page's own origin.
 * Route handlers under /api are not matched – they check the Origin themselves (`isSameOrigin`, e.g. the upload
 * address route of ST-085) or their own signatures.
 */
export async function proxy(request: NextRequest) {
  if (request.method !== "POST") return withRenewedSessionCookie(request, NextResponse.next());
  if (!isSameOrigin(request.headers)) return new NextResponse("Forbidden", { status: 403 });
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


export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};

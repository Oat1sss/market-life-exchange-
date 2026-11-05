/**
 * Proxy (formerly middleware) — Next 16 renamed the convention; see
 * docs/ARCHITECTURE.md §Authentication.
 *
 * Optimistic gate only: it redirects clearly-unauthenticated requests away
 * from /play/*. Every protected page, server action, and route handler still
 * re-verifies the session with requireUserId()/auth(), because a matcher can
 * silently miss rewritten or prefetched requests (Next 16 docs, Data Security).
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Cookie name Auth.js v5 issues for a JWT stateless session. */
const SESSION_COOKIE = "authjs.session-token";

export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const login = new URL("/login", request.url);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/play/:path*"],
};

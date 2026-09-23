import { NextRequest, NextResponse } from "next/server";

/**
 * Forwards the request's pathname as a header so the root layout — a Server
 * Component, with no direct pathname access — can let `/login` through the
 * "in progress" gate while every other route sees the wall. Nothing here
 * makes an auth decision: middleware is Edge runtime and can't reach
 * Postgres (see arts-collective's src/middleware.ts for the same
 * constraint), so the actual owner/admin check happens in layout.tsx.
 */
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};

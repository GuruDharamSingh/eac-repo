import { NextResponse, type NextRequest } from "next/server";
import { FROM_COOKIE } from "@/config/network";

/**
 * Remember which app in the network sent this visitor here.
 *
 * Next 16's `proxy.ts` — the same request hook the old `middleware.ts` was.
 *
 * The handover from IFAC (or any org site) is several redirects long — apply,
 * sign in, back to the studio — and the `?from=` that started it is gone after
 * the first of them. Recording it once, here, is what lets every page
 * downstream still offer the way back.
 *
 * Also republishes the request URL as a header so a server component can read
 * the query string it was rendered for; Next gives layouts no other access to
 * it.
 */
export default function proxy(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-market-url", req.nextUrl.toString());

  const res = NextResponse.next({ request: { headers } });
  const from = req.nextUrl.searchParams.get("from");
  if (from && /^[a-z0-9_-]{1,32}$/i.test(from)) {
    res.cookies.set(FROM_COOKIE, from.toLowerCase(), {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 6,
    });
  }
  return res;
}

export const config = {
  // Everything a person can see, and nothing a machine fetches: rewriting
  // headers on media and static assets would cost an invocation per image for
  // no benefit.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

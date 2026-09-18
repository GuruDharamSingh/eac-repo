import { NextResponse, type NextRequest } from "next/server";
import { NETWORK_URL } from "@/lib/site";

/**
 * The forum's /login is a forwarder. Sign-in lives on the network site; this
 * sends the reader there with a return address, and the network's login form
 * brings them back through /api/auth/handoff/accept carrying the session.
 *
 * `next` is where to land afterwards — from the query (the handoff's own
 * failure path sets it), else the page they came from, else the home. Only a
 * path: the return address is always on this host.
 */
export const dynamic = "force-dynamic";

function publicOrigin(request: NextRequest): string {
  const url = new URL(request.url);
  const proto = (request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")).split(",")[0].trim();
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host).split(",")[0].trim();
  return `${proto}://${host}`;
}

export function GET(request: NextRequest) {
  const here = publicOrigin(request);
  let next = request.nextUrl.searchParams.get("next") ?? "";
  if (!next) {
    const ref = request.headers.get("referer");
    if (ref) {
      try {
        const u = new URL(ref);
        if (u.origin === here) next = `${u.pathname}${u.search}`;
      } catch { /* not a URL */ }
    }
  }
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) next = "/";
  const q = new URLSearchParams({ next: `${here}${next}` });
  if (request.nextUrl.searchParams.get("error")) q.set("error", request.nextUrl.searchParams.get("error")!);
  return NextResponse.redirect(`${NETWORK_URL}/login?${q.toString()}`, 307);
}

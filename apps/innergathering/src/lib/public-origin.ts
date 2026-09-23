import type { NextRequest } from "next/server";

/**
 * The origin to put in a URL someone else will send a browser back to.
 *
 * NOT `request.nextUrl.origin`. The server is started with `-H 0.0.0.0`, so
 * that reports `0.0.0.0:3015` — verified live, where a redirect built from it
 * came out as `https://0.0.0.0:3015/…`. Harmless for an internal fetch, but
 * this origin goes to Stripe as the success and cancel URL, so a buyer would
 * pay and then land nowhere. The proxy's forwarded headers carry the hostname
 * the browser actually used.
 */
export function publicOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host && !host.startsWith("0.0.0.0")) {
    const proto =
      request.headers.get("x-forwarded-proto") ??
      (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
}

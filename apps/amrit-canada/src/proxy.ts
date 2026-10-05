import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ssoProxy } from "@elkdonis/auth-server/sso-proxy";

/**
 * Next 16 request hook. Network SSO on arrival: signs a visitor in from the
 * network host, or mirrors this site's sign-in to it, once per visit — see
 * packages/auth-server/src/sso-proxy.ts.
 *
 * Plain http is sent to https first. The edge does not upgrade this host, and
 * the SSO "once per visit" cookie is Secure after any https visit, so an http
 * request never carried it and redirected through the network host in a loop
 * (seen 2026-09-26, edge log for amritcanada.ca). Only when the edge says
 * http: direct container requests carry no X-Forwarded-Proto.
 */
export default async function proxy(req: NextRequest) {
  if (req.headers.get("x-forwarded-proto") === "http" && (req.method === "GET" || req.method === "HEAD")) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (host) {
      return NextResponse.redirect(`https://${host}${req.nextUrl.pathname}${req.nextUrl.search}`, 308);
    }
  }
  return (await ssoProxy(req)) ?? NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

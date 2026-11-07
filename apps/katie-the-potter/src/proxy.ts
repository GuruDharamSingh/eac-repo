import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ssoProxy } from "@elkdonis/auth-server/sso-proxy";

/**
 * Next 16 request hook. Network SSO on arrival: signs a visitor in from the
 * network host, or mirrors this site's sign-in to it, once per visit — see
 * packages/auth-server/src/sso-proxy.ts.
 */
export default async function proxy(req: NextRequest) {
  return (await ssoProxy(req)) ?? NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

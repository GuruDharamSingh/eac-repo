import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ssoProxy } from "@elkdonis/auth-server/sso-proxy";

/**
 * Network SSO on arrival, as every app of the network (auth-server/src/sso-proxy.ts). Also
 * hands the gate the requested path (basePath stripped) so a signed-out visitor returns to it.
 */
export default async function proxy(req: NextRequest) {
  const sso = await ssoProxy(req);
  if (sso) return sso;
  const headers = new Headers(req.headers);
  headers.set("x-dev-path", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

import { handleOAuthCallback } from "@elkdonis/auth-server";
import { type NextRequest, NextResponse } from "next/server";
import { siteConfig } from "@/config/site";

/**
 * Completes the Google PKCE flow started by signInWithGoogle(). Without this
 * route Google sign-in lands on a 404 and the exchange never happens.
 *
 * Behind Nginx Proxy Manager the internal request.url is
 * http://0.0.0.0:3019/... — handleOAuthCallback builds its redirects from
 * `url`, so proxy the request to report the PUBLIC origin while leaving
 * .cookies intact. Same shim amrit-canada carries, for the same reason.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const fwdProto = (request.headers.get("x-forwarded-proto") ?? "https").split(",")[0].trim();
  const fwdHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const internalUrl = new URL(request.url);
  const publicUrl = `${fwdProto}://${fwdHost}${internalUrl.pathname}${internalUrl.search}`;

  const proxied = new Proxy(request, {
    get(target, prop) {
      if (prop === "url") return publicUrl;
      const val = (target as unknown as Record<string, unknown>)[prop as string];
      return typeof val === "function" ? val.bind(target) : val;
    },
  });

  return handleOAuthCallback(proxied as NextRequest, {
    // Must agree with the password-signup route next door, or the role a new
    // account gets depends on which button they pressed.
    defaultOrgs: [{ id: siteConfig.orgId, role: "viewer" }],
  });
}

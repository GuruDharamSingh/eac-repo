import { handleOAuthCallback } from "@elkdonis/auth-server";
import { type NextRequest, NextResponse } from "next/server";

// Completes the Google PKCE flow started by signInWithGoogle() in
// @elkdonis/auth-client.
//
// Wrapped in a real async function rather than bare-exported: a bare
// `export { handleOAuthCallback as GET }` only satisfies Next's generated
// route-handler type by coincidence, when the shared function happens to
// take exactly one parameter — it breaks the moment handleOAuthCallback
// gains a second (options) parameter, which it now has so per-app callers
// can scope which orgs a fresh Google signup joins. No options passed here
// — unchanged behaviour (the shared network defaults), since ArtDirect is
// the cross-org directory, not scoped to one org's membership.
//
// Behind Nginx Proxy Manager the internal request.url is http://0.0.0.0:3013/...
// Proxy the NextRequest so `url` reports the public origin (which
// handleOAuthCallback uses to build redirects) while .cookies stays intact.
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

  return handleOAuthCallback(proxied as NextRequest);
}

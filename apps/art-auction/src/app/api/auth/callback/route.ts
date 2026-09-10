import { handleOAuthCallback } from "@elkdonis/auth-server";
import { type NextRequest, NextResponse } from "next/server";

// Completes the Google PKCE flow started by signInWithGoogle() in
// @elkdonis/auth-client — the same route ArtDirect and IFAC carry, so one
// Google account signs into every centralising site.
//
// Wrapped in a real async function rather than bare-exported: a bare
// `export { handleOAuthCallback as GET }` only satisfies Next's route-handler
// type by coincidence and breaks as soon as the shared function takes an
// options parameter (which it does). No options passed — the marketplace is
// cross-org, not scoped to one org's membership.
//
// Behind the reverse proxy the internal request.url is http://0.0.0.0:3009/...
// Proxy the NextRequest so `url` reports the public origin (used to build
// redirects) while .cookies stays intact.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const fwdProto = (request.headers.get("x-forwarded-proto") ?? "http").split(",")[0].trim();
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

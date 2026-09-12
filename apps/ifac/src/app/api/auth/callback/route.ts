import { handleOAuthCallback } from "@elkdonis/auth-server";
import { type NextRequest, NextResponse } from "next/server";
import { siteConfig } from "@/config/site";

// Completes the Google PKCE flow started by signInWithGoogle() in
// @elkdonis/auth-client. Without this route Google sign-in redirects back to
// a 404 and the exchange never happens — IFAC had no callback route at all
// (and no Google sign-in UI) before this.
//
// Behind Nginx Proxy Manager the internal request.url is http://0.0.0.0:3008/...
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

  // A fresh Google signup here joins 'ifac' as a VIEWER — a follower with
  // read access — matching the password-signup route, which has always said
  // viewer. This said `member` until 2026-09-12, so whether a new account
  // could write depended on which button they signed up with. Membership is
  // something the org grants (admin console / invite), not something signing
  // in confers. The org scoping itself still matters: without defaultOrgs a
  // first-time Google sign-in would join the shared network defaults instead
  // and never appear in getIfacUsers().
  return handleOAuthCallback(proxied as NextRequest, {
    defaultOrgs: [{ id: siteConfig.orgId, role: "viewer" }],
  });
}

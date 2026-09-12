import type { NextRequest } from "next/server";
import { handleOAuthCallback } from "@elkdonis/auth-server";
import { siteConfig } from "@/config/site";

// Completes the Google PKCE flow started by signInWithGoogle() in
// @elkdonis/auth-client. handleOAuthCallback rebuilds the public origin from
// the x-forwarded-* headers itself, so no request proxying is needed here.
// A first-time Google sign-in joins elastrocal as viewer, matching signup.
export async function GET(request: NextRequest) {
  return handleOAuthCallback(request, {
    defaultOrgs: [{ id: siteConfig.orgId, role: "viewer" }],
  });
}

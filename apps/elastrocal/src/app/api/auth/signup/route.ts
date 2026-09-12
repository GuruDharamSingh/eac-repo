import type { NextRequest } from "next/server";
import { handleSignup } from "@elkdonis/auth-server";
import { siteConfig } from "@/config/site";

/**
 * Wrapped rather than re-exported bare:
 *
 * 1. Someone signing up here wants to keep their charts, not to join a
 *    community, so they land as `viewer` on elastrocal only (the network's
 *    "follower" level) instead of the shared handler's default EAC orgs.
 *    Saving charts needs no role at all — it is gated by owner_id.
 * 2. handleSignup's second parameter doesn't match the route-handler context
 *    signature Next 16 type-checks against, so a bare re-export won't compile.
 */
export async function POST(request: NextRequest) {
  return handleSignup(request, {
    defaultOrgs: [{ id: siteConfig.orgId, role: "viewer" }],
  });
}

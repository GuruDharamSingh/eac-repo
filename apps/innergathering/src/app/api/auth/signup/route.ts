import type { NextRequest } from "next/server";
import { handleSignup } from "@elkdonis/auth-server";
import { siteConfig } from "@/config/site";

/**
 * Wrapped rather than re-exported bare, for two reasons:
 *
 * 1. Someone signing up here is joining THIS community. The shared handler
 *    otherwise defaults new accounts into the EAC network orgs (elkdonis +
 *    inner_group); scoping to amrit_canada keeps membership meaningful —
 *    `member` here, and no role anywhere else. The account itself still works
 *    network-wide, since auth is one shared GoTrue instance.
 * 2. handleSignup's second parameter is an options object, which doesn't match
 *    the route-handler context signature Next 16 type-checks against, so the
 *    bare `export { handleSignup as POST }` the other apps use fails to
 *    compile here.
 */
export async function POST(request: NextRequest) {
  return handleSignup(request, {
    // A signup is a follower (viewer role), not a member — CENTER_PAGE_BRIEF_2026-09-09.md, decision 2.
    defaultOrgs: [{ id: siteConfig.orgId, role: "viewer" }],
  });
}

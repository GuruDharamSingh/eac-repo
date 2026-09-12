import { NextRequest } from "next/server";
import { handleSignup } from "@elkdonis/auth-server";

/**
 * Public self-signup scoped to this site's group: new accounts join only the
 * 'hidden-enneagram' org as members (not the wider EAC network).
 */
export async function POST(req: NextRequest) {
  return handleSignup(req, {
    // A signup is a follower (viewer role), not a member — CENTER_PAGE_BRIEF_2026-09-09.md, decision 2.
    defaultOrgs: [{ id: "hidden-enneagram", role: "viewer" }],
  });
}

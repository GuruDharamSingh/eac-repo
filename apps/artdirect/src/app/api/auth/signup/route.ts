import { NextRequest } from "next/server";
import { handleSignup } from "@elkdonis/auth-server";

/**
 * Public self-signup.
 *
 * No `defaultOrgs`, so an account joins the shared network defaults — the same
 * decision ./callback already made and states: ArtDirect is the cross-org
 * directory, not a site scoped to one group's membership. An org-scoped app
 * (IFAC, hidden-enneagram) passes its own org here instead.
 *
 * Wrapped rather than re-exported: Next passes the route context as the second
 * argument, which `handleSignup` would read as its options, and the production
 * build's route type check rejects the bare export (2026-10-19).
 */
export async function POST(req: NextRequest) {
  return handleSignup(req);
}

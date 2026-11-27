import { NextRequest } from "next/server";
import { handleSignup } from "@elkdonis/auth-server";

/**
 * Public self-signup.
 *
 * No `defaultOrgs`, so an account joins the shared default: a viewer of `oad`
 * (since 2026-11-24; it was `inner_group`). ArtDirect is the artist directory,
 * and `oad` is the org it is built on. An org-scoped app (IFAC,
 * hidden-enneagram) passes its own org here instead.
 *
 * Wrapped rather than re-exported: Next passes the route context as the second
 * argument, which `handleSignup` would read as its options, and the production
 * build's route type check rejects the bare export (2026-10-19).
 */
export async function POST(req: NextRequest) {
  return handleSignup(req);
}

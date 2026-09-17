import { handleSignup } from "@elkdonis/auth-server";

/**
 * Public self-signup.
 *
 * No `defaultOrgs`, so an account joins the shared network defaults — the same
 * decision ./callback already made and states: ArtDirect is the cross-org
 * directory, not a site scoped to one group's membership. An org-scoped app
 * (IFAC, hidden-enneagram) passes its own org here instead.
 */
export { handleSignup as POST };

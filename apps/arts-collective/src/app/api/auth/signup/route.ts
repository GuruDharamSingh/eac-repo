import { handleSignup } from "@elkdonis/auth-server";
import { type NextRequest } from "next/server";

// Wrapped in a real async function rather than bare-exported, for the same
// reason as the OAuth callback next door: `export { handleSignup as POST }`
// only satisfies Next's generated route-handler type by coincidence, while
// the shared function takes exactly one parameter. handleSignup now takes a
// second (options) parameter so per-app callers can scope which orgs a fresh
// signup joins, and Next's checker rejects that shape — the build fails with
// "Type '{ params: Promise<{}>; }' has no properties in common with type
// 'SignupOrgOptions'".
//
// Default org `oad` as a viewer (developer decision, 2026-11-24; it was none
// from 2026-10-29, and `inner_group` before that). A fresh sign-up is a visitor
// to the artist directory, not a follower of the core member group, which is
// what labelled every new person a follower of `inner_group` and hid the "start
// an organisation" cards. The getting-started course's first tasks raise the
// `oad` row to `member` (gainSpace) and, if they want one, give them an
// organisation.
export async function POST(request: NextRequest) {
  return handleSignup(request, { defaultOrgs: [{ id: "oad", role: "viewer" }] });
}

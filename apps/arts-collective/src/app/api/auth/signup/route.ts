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
// No default org (developer decision, 2026-10-29): a fresh sign-up on the
// network holds no membership at all. Before this it joined the core member
// group as a viewer, which labelled every new person a follower of that group
// and hid the "start an organisation" cards. The getting-started course's
// first tasks give them their own space (org `oad`) and, if they want one,
// an organisation.
export async function POST(request: NextRequest) {
  return handleSignup(request, { defaultOrgs: [] });
}

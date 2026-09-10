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
// No options passed: unchanged behaviour (the shared network defaults), since
// arts-collective's own org model — one org per member, created through the
// wizard — doesn't map onto a single defaultOrgs list the way a single-org
// site's does.
export async function POST(request: NextRequest) {
  return handleSignup(request);
}

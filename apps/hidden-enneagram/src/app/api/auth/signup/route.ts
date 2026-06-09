import { NextRequest } from "next/server";
import { handleSignup } from "@elkdonis/auth-server";

/**
 * Public self-signup scoped to this site's group: new accounts join only the
 * 'hidden-enneagram' org as members (not the wider EAC network).
 */
export async function POST(req: NextRequest) {
  return handleSignup(req, {
    defaultOrgs: [{ id: "hidden-enneagram", role: "member" }],
    profileOrgId: "hidden-enneagram",
  });
}

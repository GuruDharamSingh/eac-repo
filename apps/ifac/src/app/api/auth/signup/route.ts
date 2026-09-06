import { NextRequest } from "next/server";
import { handleSignup } from "@elkdonis/auth-server";
import { siteConfig } from "@/config/site";

/**
 * Public self-signup scoped to this site's group: new accounts join only the
 * 'ifac' org as members.
 *
 * Previously called handleSignup with no options at all, which falls back to
 * the shared network defaults (elkdonis + inner_group) — every IFAC signup
 * was joining the wrong orgs and never appearing in getIfacUsers() (INNER
 * JOINs on org_id='ifac'), so an admin had no way to even see, let alone
 * promote or match, someone who'd just signed up here.
 */
export async function POST(req: NextRequest) {
  return handleSignup(req, {
    defaultOrgs: [{ id: siteConfig.orgId, role: "member" }],
  });
}

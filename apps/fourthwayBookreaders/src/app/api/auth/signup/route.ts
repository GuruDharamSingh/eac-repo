import type { NextRequest } from "next/server";
import { handleSignup } from "@elkdonis/auth-server";
import { siteConfig } from "@/config/site";

/**
 * Someone signing up HERE is joining this circle. Left to its defaults the
 * shared handler enrols new accounts in the network orgs (elkdonis +
 * inner_group); scoping to this org keeps membership meaningful.
 *
 * `viewer`, not `member`: signing up makes you a follower. Membership is
 * granted, not self-served — CENTER_PAGE_BRIEF_2026-09-09.md, decision 2.
 */
export async function POST(request: NextRequest) {
  return handleSignup(request, {
    defaultOrgs: [{ id: siteConfig.orgId, role: "viewer" }],
  });
}

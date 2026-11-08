"use server";

// The tenant hub cards' one write door (same shape as ifac's app/hub/actions.ts):
// every card write runs via 'app', audited as the person, limited to the
// mounted cards' entries, and bound to the org whose HOST the request came in
// on. The org is read from the middleware's x-org-slug header, never from the
// action's arguments, so a page on one org's host cannot write to another.

import { performHubAction } from "@elkdonis/actions/server";
import { MEMBERS_ACTIONS } from "@elkdonis/hub/members/model";
import { REVIEW_ACTIONS } from "@elkdonis/hub/review/model";
import { getCurrentUser } from "@/lib/session";
import { loadTenantHub, tenantSlugFromRequest } from "@/lib/tenant-hub";

const ALLOW: readonly string[] = [...MEMBERS_ACTIONS, ...REVIEW_ACTIONS];

export async function runTenantHubAction(id: string, input: Record<string, unknown>) {
  const slug = await tenantSlugFromRequest();
  if (!slug) return { ok: false as const, error: "This can only be done from the organisation’s own site." };
  const hub = await loadTenantHub(slug);
  if (!hub) return { ok: false as const, error: "That organisation could not be found." };
  const user = await getCurrentUser();
  const actor = user ? { userId: user.id, email: user.email } : null;
  const result = await performHubAction(hub.site, actor, id, input, ALLOW);
  if (result.ok) return { ok: true as const };
  return { ok: false as const, error: "error" in result ? result.error : "That could not be done." };
}

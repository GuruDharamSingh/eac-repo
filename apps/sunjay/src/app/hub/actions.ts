"use server";

// The hub cards' one write door on Para Theater (architect review 2026-11-08):
// a host server action (via 'app', audited as the person), bound to this
// site's org, limited to the mounted cards' entries, with this app's page
// adapter for the Site Builder entries.

import { performHubAction } from "@elkdonis/actions/server";
import { SITE_BUILDER_ACTIONS } from "@elkdonis/hub/site-builder/model";
import { getServerSession } from "@elkdonis/auth-server";
import { hubSite } from "@/lib/hub-site";
import { siteAdapter } from "@/lib/hub-site-adapter";

const ALLOW: readonly string[] = [...SITE_BUILDER_ACTIONS];

export async function runHubAction(id: string, input: Record<string, unknown>) {
  const session = await getServerSession();
  const user = session.user;
  const actor = user ? { userId: user.db_user_id ?? user.id, email: user.email } : null;
  const result = await performHubAction(hubSite, actor, id, input, ALLOW, siteAdapter);
  if (result.ok) return { ok: true as const, value: result.data };
  return { ok: false as const, error: "error" in result ? result.error : "That could not be done." };
}

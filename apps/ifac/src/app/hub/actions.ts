"use server";

// The hub cards' one write door on IFAC (architect review 2026-11-08): a host
// server action, so every card write is via 'app' (audited as the person),
// bound to this site's org, and limited to the mounted cards' entries.

import { performHubAction } from "@elkdonis/actions/server";
import { MEMBERS_ACTIONS } from "@elkdonis/hub/members/model";
import { getServerSession } from "@elkdonis/auth-server";
import { hubSite } from "@/lib/hub-site";

const ALLOW: readonly string[] = [...MEMBERS_ACTIONS];

export async function runHubAction(id: string, input: Record<string, unknown>) {
  const session = await getServerSession();
  const user = session.user;
  const actor = user ? { userId: user.db_user_id ?? user.id, email: user.email } : null;
  const result = await performHubAction(hubSite, actor, id, input, ALLOW);
  if (result.ok) return { ok: true as const };
  return { ok: false as const, error: "error" in result ? result.error : "That could not be done." };
}

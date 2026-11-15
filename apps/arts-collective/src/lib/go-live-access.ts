import "server-only";
import { isAdmin } from "@elkdonis/auth-server";
import { db } from "@elkdonis/db";

/**
 * Who may use the Studio's Go live card (Video kind), 2026-11-14 on the developer's word:
 * network admins, as before, and anyone who owns an organisation (`user_organizations.role =
 * 'owner'`). The two differ in what they reach:
 *
 *   admin  the whole relay (every saved destination, feeds in, chat, history), the OBS console
 *          (/studio/broadcast, the booth desktop, scenes, graphics, recordings);
 *   owner  only the card: claim the one OBS instance's lease, stream to the destinations they
 *          saved themselves (`stream_destinations.set_by`, see DestinationScope in
 *          @elkdonis/services/relay), stop. No console, no feeds, no chat, their own history.
 *
 * The lease still allows one person at a time; an owner cannot take it from a holder.
 */
export type GoLiveRole = "admin" | "owner";

export async function goLiveRole(userId: string | null | undefined): Promise<GoLiveRole | null> {
  if (!userId) return null;
  if (await isAdmin(userId)) return "admin";
  const [row] = await db<Array<{ one: number }>>`
    SELECT 1 AS one FROM user_organizations WHERE user_id = ${userId} AND role = 'owner' LIMIT 1
  `;
  return row ? "owner" : null;
}

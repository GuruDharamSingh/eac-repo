import "server-only";
import { db } from "@elkdonis/db";
import type { ChannelNextMove } from "@elkdonis/actions";
import { loadChannelModel } from "./load";
import { channelNextMoves, type ChannelNext } from "./next";

/**
 * The registry's reader for `channel-next` (packages/actions ActionSources.channelNext;
 * 2026-11-07): the /channel loader's model, then the same derivation Channel Home's next
 * row uses (next.ts), so the dock, GET /api/actions/channel-next and the row agree.
 *
 * `userId` comes from the caller's verified session (the dock route, actionRoutes' `who`);
 * `orgId` is the org channel actionOrgId settled (owner or guide), or null for the
 * person's own channel. The loader runs about fifteen reads, so callers keep this to
 * the paths where publishing is the work (server/dock.ts `channelDockPath`).
 * Page-only fields (the quick sheet's input, the to-do id) are left off the wire.
 */
export async function channelNextSource(q: { userId: string; orgId: string | null; limit: number }): Promise<ChannelNextMove[]> {
  const [u] = await db<Array<{ email: string | null }>>`SELECT email FROM users WHERE id = ${q.userId} LIMIT 1`;
  if (!u) return [];
  const model = await loadChannelModel({ id: q.userId, authUserId: q.userId, email: u.email ?? "" }, { org: q.orgId ?? undefined });
  return channelNextMoves(model, { limit: q.limit }).map(wire);
}

function wire(m: ChannelNext): ChannelNextMove {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sheet, todoId, urgent, ...move } = m;
  return move;
}

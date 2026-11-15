import "server-only";
import { db } from "@elkdonis/db";
import type { ChannelNextMove, ChannelPlanProposal } from "@elkdonis/actions";
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
export async function channelNextSource(q: { userId: string; orgId: string | null; limit: number; pieceKey?: string | null }): Promise<ChannelNextMove[]> {
  const [u] = await db<Array<{ email: string | null }>>`SELECT email FROM users WHERE id = ${q.userId} LIMIT 1`;
  if (!u) return [];
  const model = await loadChannelModel({ id: q.userId, email: u.email ?? "" }, { org: q.orgId ?? undefined });
  return channelNextMoves(model, { limit: q.limit, pieceKey: q.pieceKey }).map(wire);
}

function wire(m: ChannelNext): ChannelNextMove {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sheet, todoId, urgent, ...move } = m;
  return move;
}

/**
 * The registry's reader for `channel-plan` (ActionSources.channelPlanProposals; 2026-11-12):
 * the steps the Queue would suggest for one piece. They are the loader's own suggestions
 * (load.ts "routines, slots and suggestions": gap, cadence and placement rules, dismissed
 * outlets and "never suggest" rules already applied), read off the piece, so the registry
 * carries no second copy of the rules. Null when the piece is not on this board.
 */
export async function channelPlanProposalsSource(q: { userId: string; orgId: string | null; pieceKey: string }): Promise<ChannelPlanProposal[] | null> {
  const [u] = await db<Array<{ email: string | null }>>`SELECT email FROM users WHERE id = ${q.userId} LIMIT 1`;
  if (!u) return null;
  const model = await loadChannelModel({ id: q.userId, email: u.email ?? "" }, { org: q.orgId ?? undefined });
  const piece = model.pieces.find((p) => p.key === q.pieceKey);
  if (!piece) return null;
  return piece.suggestions.map((s) => ({ outlet: s.outlet, text: s.text, reason: s.reason, at: s.at }));
}

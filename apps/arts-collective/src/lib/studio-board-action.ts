"use server";

// ============================================================================
// The Studio's Board sheet loader (2026-11-11). One item's state in Channel,
// for the signed-in person only: the person comes from the session, and the
// item must be among the pieces their own Channel lists (loadChannelModel
// scopes to orgs they own or guide, else their artist scope), so a sent id
// or org cannot reach anyone else's piece. Read-only.
//
// It reads the whole channel to find one piece, as /channel/piece does; the
// per-item loader of docs/open/CONTENT_LIBRARY_COMPONENT_2026-11-08.md
// (pass 2) replaces that.
// ============================================================================

import type { StudioBoardView } from "@elkdonis/studio";
import { getCurrentUser } from "@/lib/session";
import { loadChannelModel } from "@/lib/channel/load";
import { channelPieceToDetail } from "@/lib/channel/content-detail";
import { studioBoardView } from "@/lib/channel/studio-board";

const CHANNEL_BASE = "/channel";

export async function loadStudioBoardAction(ref: { store: string; id: string; orgId: string | null }): Promise<StudioBoardView | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const store = ref?.store === "thread" || ref?.store === "artwork" ? ref.store : null;
  const id = typeof ref?.id === "string" ? ref.id.slice(0, 64) : "";
  if (!store || !id) return null;
  const org = typeof ref.orgId === "string" && ref.orgId ? ref.orgId.slice(0, 64) : undefined;

  const model = await loadChannelModel(user, { org });
  const piece = model.pieces.find((p) => p.key === `${store}:${id}`);
  if (!piece) return null;

  // The same scoped links ChannelFrame builds (ChannelFrame.tsx `href`).
  const scopeOrg = model.scope.kind === "org" ? model.scope.orgId : null;
  const href = (path: string, params: Record<string, string | null | undefined> = {}) => {
    const q = new URLSearchParams();
    if (scopeOrg) q.set("org", scopeOrg);
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    const s = q.toString();
    return `${path}${s ? `?${s}` : ""}`;
  };
  const detail = channelPieceToDetail(piece, model, { href, base: CHANNEL_BASE });
  return studioBoardView(detail, { href, base: CHANNEL_BASE });
}

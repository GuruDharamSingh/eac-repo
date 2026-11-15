"use server";

// ============================================================================
// The Studio's piece summary loader (canvas C, 2026-11-14;
// docs/sessions/2026-11-14_studio-create-summary.md). Same scope and path as
// the Board sheet's loader (studio-board-action.ts): the signed-in person
// only, the piece must be on their own Channel, read-only. From Channel's
// piece detail (the passport Channel's pop-up draws) it takes the cover, text,
// where it went and the links; "Next for this piece" is channelNextMoves with
// the piece's key (the dock's and `channel-next`'s list). The form adds its
// own labelled facts in the browser (packages/studio/src/summary/gate.tsx).
// ============================================================================

import type { ContentDetailModel } from "@elkdonis/content/model";
import { typeLabel } from "@elkdonis/content/registry";
import type { PieceSummaryView } from "@elkdonis/content/summary";
import { getCurrentUser } from "@/lib/session";
import { loadChannelModel } from "@/lib/channel/load";
import { channelPieceToDetail } from "@/lib/channel/content-detail";
import { studioBoardView } from "@/lib/channel/studio-board";
import { channelNextMoves } from "@/lib/channel/next";

const CHANNEL_BASE = "/channel";
/** Lanes that are a place the piece went (not its plan, edits, comments or dates). */
const OUT_LANES = new Set(["site", "social", "email", "video", "writing", "live", "market"]);
const OUT_STATES = new Set(["published", "live", "scheduled", "failed"]);
const DATED = new Set(["meeting", "event", "workshop", "series"]);

export async function loadStudioSummaryAction(ref: { store: string; id: string; orgId: string | null }): Promise<PieceSummaryView | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const store = ref?.store === "thread" || ref?.store === "artwork" ? ref.store : null;
  const id = typeof ref?.id === "string" ? ref.id.slice(0, 64) : "";
  if (!store || !id) return null;
  const org = typeof ref.orgId === "string" && ref.orgId ? ref.orgId.slice(0, 64) : undefined;

  const model = await loadChannelModel(user, { org });
  const piece = model.pieces.find((p) => p.key === `${store}:${id}`);
  if (!piece) return null;

  // The same scoped links ChannelFrame builds (as studio-board-action.ts).
  const scopeOrg = model.scope.kind === "org" ? model.scope.orgId : null;
  const href = (path: string, params: Record<string, string | null | undefined> = {}) => {
    const q = new URLSearchParams();
    if (scopeOrg) q.set("org", scopeOrg);
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    const s = q.toString();
    return `${path}${s ? `?${s}` : ""}`;
  };
  const detail = channelPieceToDetail(piece, model, { href, base: CHANNEL_BASE });
  const board = studioBoardView(detail, { href, base: CHANNEL_BASE });
  const moves = channelNextMoves(model, { pieceKey: detail.key, limit: 4 });

  return {
    key: detail.key,
    type: detail.type,
    typeLabel: typeLabel(detail.type),
    byline: bylineOf(detail),
    title: detail.title,
    excerpt: detail.excerpt?.trim() || null,
    meta: detail.meta?.trim() || null,
    ...picturesOf(detail),
    facts: DATED.has(detail.type) && detail.dates.next ? [{ label: "When", value: whenOf(detail.dates.next, detail.timeZone) }] : [],
    status: { label: detail.status.label, at: detail.dates.published },
    out: detail.timeline
      .filter((e) => OUT_LANES.has(e.lane) && OUT_STATES.has(e.state))
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
      .slice(0, 6)
      .map((e) => ({ id: e.id, label: e.label, sub: e.sub || null, at: e.at, state: e.state, href: e.href ?? null })),
    next: moves.map((m) => ({
      id: m.id,
      title: m.title,
      reason: m.reason ?? m.kicker,
      label: m.open?.label ?? "Open",
      // Moves the summary cannot run in place (accept, slot-fill) open the piece's board.
      href: m.href ?? board.links.board,
    })),
    links: { view: detail.links.public, channel: board.links.board, plan: board.links.plan },
  };
}

/** "Katie the Potter · credited to Noa": who presents it, and the maker when that is someone else. */
function bylineOf(d: ContentDetailModel): string | null {
  const presenter = d.presentedBy?.name ?? d.site.name ?? null;
  const owner = d.owner && d.owner.name !== presenter ? (d.owner.shortName === "You" ? "you" : d.owner.name) : null;
  return [presenter, owner ? `credited to ${owner}` : null].filter(Boolean).join(" · ") || null;
}

function picturesOf(d: ContentDetailModel): { pictures: string[]; pictureCount: number } {
  const all = [d.media.cover, ...(d.media.images ?? [])].filter((u): u is string => typeof u === "string" && u.length > 0);
  const unique = [...new Set(all)];
  return { pictures: unique.slice(0, 3), pictureCount: unique.length };
}

/** "Wed 19 Nov · 18:30" in the channel's time zone. */
function whenOf(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(d);
  return `${day.replace(",", "")} · ${time}`;
}

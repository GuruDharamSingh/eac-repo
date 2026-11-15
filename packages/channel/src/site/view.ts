import type { ChannelModel, DayItem, Outlet, Piece, PieceKind, TimelineEntry } from "../model";

/**
 * What a site's Channel tabs draw from the shared Channel model (2026-11-14; design canvas
 * "Studio pipeline frame" round 3, artboards D Queue, D2 Board, E Out; first on katie-the-potter,
 * then sunjay). Pure: no reads, safe in client and "use server" modules.
 * Board = confirmed only (published, scheduled, planned drafts), never suggestions.
 */

/** The Channel moves a site's door offers (within @elkdonis/actions SITE_CHANNEL_ACTIONS). Plans only. */
export const SITE_DOOR_ALLOW: readonly string[] = [
  "channel-suggestion-accept",
  "channel-suggestion-dismiss",
  "channel-slot-fill",
  "channel-plan-step",
  "channel-plan",
  "channel-delivery-save",
];

/** The moves the Home tab's Next row performs here (the rest open where they are finished). */
export const SITE_NEXT_RUNS: readonly string[] = ["channel-suggestion-accept", "channel-slot-fill", "channel-plan-step", "channel-plan"];

/** The page's link builders, handed to the tab components (all through the hand-off where they leave the site). */
export interface SiteLinks {
  /** This page with a tab and params. */
  tab(tab: string, extra?: Record<string, string | null | undefined>): string;
  /** Network Studio for a kind/id, carrying `back` to this Channel. */
  studio(o?: { kind?: string | null; id?: string | null }): string;
  /** Network Studio's Make into (`/studio/make?from=&to=`), carrying `back`. */
  makeInto(pieceKey: string, to: string): string;
  /** A path on the network host (Channel's own pages), through the hand-off. */
  network(path: string): string;
}

/** The Board's columns, as the canvas draws them (D2): Site, Shop, ArtDirect, Instagram, Facebook, Letter. */
export const BOARD_COLUMNS: ReadonlyArray<{ id: string; label: string; title: string; outlets: readonly Outlet[] }> = [
  { id: "site", label: "Site", title: "This site", outlets: ["site"] },
  { id: "shop", label: "Shop", title: "Collect Art listing", outlets: ["market"] },
  { id: "artdirect", label: "ArtDirect", title: "A person's ArtDirect page", outlets: ["page"] },
  { id: "instagram", label: "Instagram", title: "Instagram", outlets: ["instagram"] },
  { id: "facebook", label: "Facebook", title: "Facebook and Threads", outlets: ["facebook", "threads"] },
  { id: "letter", label: "Letter", title: "Letters to followers", outlets: ["newsletter"] },
];

export type MarkState = "out" | "scheduled" | "planned" | "draft";

export interface BoardMark {
  state: MarkState;
  at: string | null;
  href: string | null;
  label: string;
}

const asc = (a: TimelineEntry, b: TimelineEntry) => (a.at ?? "").localeCompare(b.at ?? "");
const desc = (a: TimelineEntry, b: TimelineEntry) => (b.at ?? "").localeCompare(a.at ?? "");

/** A confirmed entry's mark: out (published), scheduled (incl. going live), planned (an accepted draft), draft (the piece itself unpublished). */
export function markOf(e: TimelineEntry): MarkState | null {
  if (e.state === "published") return "out";
  if (e.state === "scheduled" || e.state === "live") return "scheduled";
  if (e.state === "draft") return e.deliveryId ? "planned" : "draft";
  return null;
}

/** One Board cell: the latest thing out, else the soonest scheduled, else a planned draft, else a draft. */
export function boardMark(piece: Piece, outlets: readonly Outlet[]): BoardMark | null {
  const es = piece.timeline.filter((e) => outlets.includes(e.outlet));
  const of = (m: MarkState) => es.filter((e) => markOf(e) === m);
  const pick = of("out").sort(desc)[0] ?? of("scheduled").sort(asc)[0] ?? of("planned").sort(asc)[0] ?? of("draft").sort(desc)[0];
  if (!pick) return null;
  return { state: markOf(pick)!, at: pick.at, href: pick.href, label: pick.label };
}

/** "Where it went" on the summary: every confirmed entry, newest first. */
export function wentWhere(piece: Piece): Array<TimelineEntry & { mark: MarkState }> {
  return piece.timeline
    .map((e) => ({ ...e, mark: markOf(e) }))
    .filter((e): e is TimelineEntry & { mark: MarkState } => e.mark !== null)
    .sort(desc);
}

export const MARK_LABEL: Record<MarkState, string> = { out: "out", scheduled: "sched.", planned: "planned", draft: "draft" };

/** Out (E): what went out or failed, newest first, within `days`. */
export interface OutRow {
  id: string;
  piece: Piece;
  entry: TimelineEntry;
}
export function outRows(model: ChannelModel, days = 30): OutRow[] {
  const since = new Date(Date.parse(model.now) - days * 86_400_000).toISOString();
  const rows: OutRow[] = [];
  for (const piece of model.pieces)
    for (const entry of piece.timeline)
      if ((entry.state === "published" || entry.state === "failed") && (entry.at ?? "") >= since) rows.push({ id: `${piece.key}|${entry.id}`, piece, entry });
  return rows.sort((a, b) => (b.entry.at ?? "").localeCompare(a.entry.at ?? ""));
}

/** Out's outlet groups (E's left list), in the order the canvas names them. */
export const OUT_OUTLETS: ReadonlyArray<{ id: string; label: string; outlets: readonly Outlet[]; connect?: "instagram" | "facebook" }> = [
  { id: "site", label: "This site", outlets: ["site"] },
  { id: "shop", label: "Collect Art", outlets: ["market"] },
  { id: "page", label: "ArtDirect pages", outlets: ["page"] },
  { id: "instagram", label: "Instagram", outlets: ["instagram"], connect: "instagram" },
  { id: "facebook", label: "Facebook", outlets: ["facebook", "threads"], connect: "facebook" },
  { id: "letter", label: "Letters", outlets: ["newsletter"] },
];

/** Today's routine slots that are still open (the Queue's "Today" card, D). */
export function todaySlots(model: ChannelModel): Array<Extract<DayItem, { type: "slot" }>> {
  const day = model.week.days.find((d) => d.isToday);
  return (day?.items ?? []).filter((i): i is Extract<DayItem, { type: "slot" }> => i.type === "slot");
}

/** Studio's form kind for a piece (StudioApp STUDIO_KIND_OF; meeting since 2026-11-14). */
export function studioKindOf(kind: PieceKind): string | null {
  switch (kind) {
    case "artwork":
    case "product":
      return "artwork-form";
    case "meeting":
      return "meeting";
    case "writing":
    case "series":
    case "event":
    case "workshop":
      return "writing";
    case "video":
      return "video";
    default:
      return null;
  }
}

/** Make into targets by source kind (canvas A's Library chips), as Studio's `to` kinds. */
export const MAKE_INTO: Partial<Record<PieceKind, Array<{ to: string; label: string }>>> = {
  artwork: [
    { to: "post", label: "Post" },
    { to: "video", label: "Clip" },
    { to: "writing", label: "Essay" },
  ],
  product: [
    { to: "post", label: "Post" },
    { to: "video", label: "Clip" },
  ],
  meeting: [
    { to: "post", label: "Reminder post" },
    { to: "meeting", label: "Next session" },
    { to: "writing", label: "Essay" },
  ],
  writing: [
    { to: "artwork-form", label: "Artwork" },
    { to: "video", label: "Clip" },
    { to: "post", label: "Post" },
  ],
  video: [
    { to: "post", label: "Post" },
    { to: "writing", label: "Transcript essay" },
  ],
};

/** Queue filter chips (D): the piece kinds present, with counts. */
export function kindCounts(pieces: Piece[]): Array<{ kind: PieceKind; n: number }> {
  const m = new Map<PieceKind, number>();
  for (const p of pieces) m.set(p.kind, (m.get(p.kind) ?? 0) + 1);
  return [...m.entries()].map(([kind, n]) => ({ kind, n }));
}

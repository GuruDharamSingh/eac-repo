import { db } from "@elkdonis/db";
import type { LotPhase, WireBid, WireLot, WireStats } from "@/blocks/auction-types";

// ============================================================================
// Public auction reads for the page blocks and /api/auction/live.
//
// Own queries rather than commerce's `listLiveLots`: that one returns the
// artist's email when there is no display name, and these rows are shown to
// anyone. Lots are listed only for ACTIVE stores. Bidders are never named: a
// bid carries a paddle number derived from the bidder's id, stable across the
// auction and traceable to no one.
//
// A lot is "live" here when it is within its window, not when its status says
// so: `status` flips from scheduled to live on the FIRST bid
// (packages/commerce/src/server/index.ts `placeBid`), so a lot nobody has bid
// on yet would otherwise read as not started.
//
// An auction "event" is a tag in `auction_lot.metadata.event` (jsonb, no
// migration). No tag means every lot.
// ============================================================================

type Row = Record<string, unknown>;
const n = (v: unknown) => (v == null ? null : Number(v));
const iso = (v: unknown) => new Date(v as string).toISOString();

export type LotScope = "open" | "closing" | "closed" | "all";

const phaseOf = (status: string, start: number, end: number, now: number): LotPhase =>
  ["sold", "passed", "ended", "cancelled"].includes(status) || now >= end ? "closed" : now < start ? "upcoming" : "open";

const eventFilter = (event?: string) => (event ? db`AND al.metadata->>'event' = ${event}` : db``);

const LOT_SELECT = db`
  al.id, al.status, al.start_at, al.end_at, al.starting_bid_minor, al.current_bid_minor, al.bid_count,
  al.bid_increment_minor, al.currency, al.metadata->>'event' AS event,
  a.title AS art_title, pm.url AS image, pm.alt AS image_alt,
  COALESCE(u.display_name, o.name) AS artist_name
`;
const LOT_FROM = db`
  FROM auction_lot al
  JOIN artwork_variant av ON av.id = al.artwork_variant_id
  JOIN artwork a ON a.id = av.artwork_id
  JOIN store s ON s.id = a.store_id AND s.status = 'active'
  LEFT JOIN organizations o ON o.id = s.owner_org_id
  LEFT JOIN users u ON u.id = a.artist_user_id
  LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
`;

function mapLot(r: Row, now: number): WireLot {
  const start = new Date(r.start_at as string).getTime();
  const end = new Date(r.end_at as string).getTime();
  const status = String(r.status);
  const current = n(r.current_bid_minor);
  return {
    id: String(r.id),
    title: String(r.art_title),
    artist: (r.artist_name as string | null) ?? null,
    image: (r.image as string | null) ?? null,
    imageAlt: (r.image_alt as string | null) ?? null,
    status,
    phase: phaseOf(status, start, end, now),
    startAt: iso(r.start_at),
    endAt: iso(r.end_at),
    startingBidMinor: Number(r.starting_bid_minor),
    currentBidMinor: current,
    bidCount: Number(r.bid_count),
    incrementMinor: Number(r.bid_increment_minor),
    currency: String(r.currency).trim(),
    event: (r.event as string | null) ?? null,
    href: `/lots/${r.id}`,
    soldMinor: status === "sold" ? current : null,
  };
}

export async function loadLots(opts: { event?: string; scope?: LotScope; limit?: number } = {}): Promise<WireLot[]> {
  const limit = Math.min(Math.max(opts.limit ?? 12, 1), 60);
  const scope = opts.scope ?? "open";
  const now = Date.now();
  const where =
    scope === "open"
      ? db`al.status IN ('scheduled','live') AND al.end_at > now()`
      : scope === "closing"
        ? db`al.status IN ('scheduled','live') AND al.end_at > now() AND al.end_at < now() + interval '60 minutes'`
        : scope === "closed"
          ? db`(al.status IN ('sold','passed','ended') OR (al.status IN ('scheduled','live') AND al.end_at <= now()))`
          : db`al.status <> 'cancelled'`;
  const order = scope === "closed" ? db`al.end_at DESC` : db`al.end_at ASC`;
  try {
    const rows = (await db`
      SELECT ${LOT_SELECT} ${LOT_FROM}
      WHERE ${where} ${eventFilter(opts.event)}
      ORDER BY ${order}
      LIMIT ${limit}
    `) as unknown as Row[];
    return rows.map((r) => mapLot(r, now));
  } catch (err) {
    console.error("[art-auction] loadLots:", err);
    return [];
  }
}

/** A stable "Paddle 214" for one bidder: three digits from their id. */
export function paddleFor(bidderId: string): string {
  const num = parseInt(bidderId.replace(/-/g, "").slice(0, 6), 16);
  return `Paddle ${(Number.isFinite(num) ? num : 0) % 900 + 100}`;
}

export async function loadBids(opts: { event?: string; limit?: number } = {}): Promise<WireBid[]> {
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 40);
  try {
    const rows = (await db`
      SELECT b.id, b.lot_id, b.bidder_id, b.amount_minor, b.placed_at, al.currency, a.title AS art_title
      FROM bid b
      JOIN auction_lot al ON al.id = b.lot_id
      JOIN artwork_variant av ON av.id = al.artwork_variant_id
      JOIN artwork a ON a.id = av.artwork_id
      JOIN store s ON s.id = a.store_id AND s.status = 'active'
      WHERE b.status <> 'retracted' AND al.status <> 'cancelled' ${eventFilter(opts.event)}
      ORDER BY b.placed_at DESC
      LIMIT ${limit}
    `) as unknown as Row[];
    return rows.map((r) => ({
      id: String(r.id),
      lotId: String(r.lot_id),
      lotTitle: String(r.art_title),
      lotHref: `/lots/${r.lot_id}`,
      amountMinor: Number(r.amount_minor),
      currency: String(r.currency).trim(),
      paddle: paddleFor(String(r.bidder_id)),
      at: iso(r.placed_at),
    }));
  } catch (err) {
    console.error("[art-auction] loadBids:", err);
    return [];
  }
}

export async function loadStats(opts: { event?: string } = {}): Promise<WireStats> {
  const empty: WireStats = { lotsOpen: 0, bids: 0, bidders: 0, highBidMinor: null, currency: "CAD", nextEndAt: null, lastEndAt: null };
  try {
    const [row] = (await db`
      SELECT
        count(*) AS lots_open,
        COALESCE(sum(al.bid_count), 0) AS bids,
        max(al.current_bid_minor) AS high,
        min(al.end_at) AS next_end,
        max(al.end_at) AS last_end,
        COALESCE(max(al.currency), 'CAD') AS currency,
        (SELECT count(DISTINCT b.bidder_id)
           FROM bid b JOIN auction_lot x ON x.id = b.lot_id
          WHERE x.status IN ('scheduled','live') AND x.end_at > now() AND b.status <> 'retracted'
            ${opts.event ? db`AND x.metadata->>'event' = ${opts.event}` : db``}) AS bidders
      ${LOT_FROM}
      WHERE al.status IN ('scheduled','live') AND al.end_at > now() ${eventFilter(opts.event)}
    `) as unknown as Row[];
    if (!row) return empty;
    return {
      lotsOpen: Number(row.lots_open),
      bids: Number(row.bids),
      bidders: Number(row.bidders ?? 0),
      highBidMinor: n(row.high),
      currency: String(row.currency).trim(),
      nextEndAt: row.next_end ? iso(row.next_end) : null,
      lastEndAt: row.last_end ? iso(row.last_end) : null,
    };
  } catch (err) {
    console.error("[art-auction] loadStats:", err);
    return empty;
  }
}

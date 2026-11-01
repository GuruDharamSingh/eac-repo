import { db } from "@elkdonis/db";

// Read side of auction series (migration 190 + 209). Public pages, the
// presenter board and the manage pages read from here.

type Row = Record<string, unknown>;

export type SeriesPhase = "draft" | "announced" | "silent" | "live" | "closed";

export interface AuctionSeries {
  id: string;
  orgId: string;
  slug: string;
  title: string;
  subtitle: string | null;
  descriptionHtml: string | null;
  presenterOrgId: string | null;
  presenterName: string | null;
  hostOrgId: string | null;
  hostName: string | null;
  status: "draft" | "published" | "closed";
  announceAt: string | null;
  silentOpensAt: string | null;
  liveAt: string | null;
  weekCount: number;
  closeMode: "single" | "staggered";
  staggerSeconds: number;
  softCloseMinutes: number;
  paymentWindowHours: number;
  card: { eyebrow?: string; blurb?: string; imageUrl?: string };
  theme: Record<string, unknown>;
  phase: SeriesPhase;
  lotCount: number;
}

export interface SeriesWeek {
  weekNo: number;
  title: string;
  focus: string | null;
  brief: string | null;
}

export interface SeriesLot {
  id: string;
  lotNumber: number | null;
  status: string;
  startAt: string;
  endAt: string;
  startingBidMinor: number;
  currentBidMinor: number | null;
  reserveMinor: number | null;
  buyNowMinor: number | null;
  bidCount: number;
  currency: string;
  artworkId: string;
  title: string;
  artistName: string | null;
  imageUrl: string | null;
  estimateLowMinor: number | null;
  estimateHighMinor: number | null;
  /** The current winning bidder's paddle: a short code derived from the id, never a name. */
  leaderPaddle: string | null;
}

export interface SeriesMember {
  userId: string;
  role: "editor" | "contributor";
  displayName: string | null;
  email: string | null;
}

const iso = (v: unknown) => (v == null ? null : new Date(v as string).toISOString());

export function phaseOf(s: { status: string; announceAt: string | null; silentOpensAt: string | null; liveAt: string | null }, now = Date.now()): SeriesPhase {
  if (s.status === "closed") return "closed";
  if (s.status !== "published") return "draft";
  const t = (v: string | null) => (v ? new Date(v).getTime() : null);
  const live = t(s.liveAt), silent = t(s.silentOpensAt), ann = t(s.announceAt);
  if (live != null && now >= live) return "live";
  if (silent != null && now >= silent) return "silent";
  // Publishing is the act that makes a series public; announce_at is shown on
  // the page but no longer hides a published series before that date
  // (2026-10-28: a series published three days before its announce date was
  // missing from the home page and 404ing for visitors).
  void ann;
  return "announced";
}

function mapSeries(r: Row): AuctionSeries {
  const base = {
    status: r.status as AuctionSeries["status"],
    announceAt: iso(r.announce_at),
    silentOpensAt: iso(r.silent_opens_at),
    liveAt: iso(r.live_at),
  };
  return {
    id: r.id as string,
    orgId: r.org_id as string,
    slug: r.slug as string,
    title: r.title as string,
    subtitle: (r.subtitle as string | null) ?? null,
    descriptionHtml: (r.description_html as string | null) ?? null,
    presenterOrgId: (r.presenter_org_id as string | null) ?? null,
    presenterName: (r.presenter_name as string | null) ?? null,
    hostOrgId: (r.host_org_id as string | null) ?? null,
    hostName: (r.host_name as string | null) ?? null,
    ...base,
    weekCount: Number(r.week_count),
    closeMode: (r.close_mode as AuctionSeries["closeMode"]) ?? "staggered",
    staggerSeconds: Number(r.stagger_seconds ?? 90),
    softCloseMinutes: Number(r.soft_close_minutes ?? 5),
    paymentWindowHours: Number(r.payment_window_hours ?? 72),
    card: (r.card as AuctionSeries["card"]) ?? {},
    theme: (r.theme as Record<string, unknown>) ?? {},
    phase: phaseOf(base),
    lotCount: Number(r.lot_count ?? 0),
  };
}

const SERIES_SELECT = db`
  s.*, po.name AS presenter_name, ho.name AS host_name,
  (SELECT COUNT(*) FROM auction_lot al WHERE al.series_id = s.id) AS lot_count
`;
const SERIES_JOIN = db`
  LEFT JOIN organizations po ON po.id = s.presenter_org_id
  LEFT JOIN organizations ho ON ho.id = s.host_org_id
`;

export async function listSeries(opts: { orgId?: string; publishedOnly?: boolean } = {}): Promise<AuctionSeries[]> {
  const rows = (await db`
    SELECT ${SERIES_SELECT} FROM auction_series s ${SERIES_JOIN}
    WHERE 1 = 1
      ${opts.orgId ? db`AND s.org_id = ${opts.orgId}` : db``}
      ${opts.publishedOnly ? db`AND s.status = 'published'` : db``}
    ORDER BY COALESCE(s.live_at, s.created_at) DESC
  `) as unknown as Row[];
  return rows.map(mapSeries);
}

export async function getSeriesBySlug(slug: string, orgId = "market"): Promise<AuctionSeries | null> {
  const [row] = (await db`
    SELECT ${SERIES_SELECT} FROM auction_series s ${SERIES_JOIN}
    WHERE s.slug = ${slug} AND s.org_id = ${orgId} LIMIT 1
  `) as unknown as Row[];
  return row ? mapSeries(row) : null;
}

export async function getSeriesById(id: string): Promise<AuctionSeries | null> {
  const [row] = (await db`
    SELECT ${SERIES_SELECT} FROM auction_series s ${SERIES_JOIN} WHERE s.id = ${id} LIMIT 1
  `) as unknown as Row[];
  return row ? mapSeries(row) : null;
}

/** The published series to feature on the marketplace home: the one closest to or in its live phase. */
export async function getFeaturedSeries(orgId = "market"): Promise<AuctionSeries | null> {
  const list = await listSeries({ orgId, publishedOnly: true });
  const open = list.filter((s) => s.phase !== "closed");
  return open[0] ?? null;
}

export async function listSeriesWeeks(seriesId: string): Promise<SeriesWeek[]> {
  const rows = (await db`
    SELECT week_no, title, focus, brief FROM auction_series_slot
    WHERE series_id = ${seriesId} AND stage = 'week' AND position = 0
    ORDER BY week_no ASC
  `) as unknown as Row[];
  return rows.map((r) => ({
    weekNo: Number(r.week_no),
    title: r.title as string,
    focus: (r.focus as string | null) ?? null,
    brief: (r.brief as string | null) ?? null,
  }));
}

/** A bidder's paddle number: stable, derived from the id, traceable to nobody. */
export function paddleFor(userId: string | null): string | null {
  if (!userId) return null;
  let h = 0;
  for (const ch of userId) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return `Paddle ${String(100 + (h % 900))}`;
}

export async function listSeriesLots(seriesId: string): Promise<SeriesLot[]> {
  const rows = (await db`
    SELECT al.id, al.lot_number, al.status, al.start_at, al.end_at, al.starting_bid_minor, al.current_bid_minor,
           al.reserve_minor, al.buy_now_minor, al.bid_count, al.currency, al.winner_user_id,
           a.id AS artwork_id, a.title, a.estimate_low_minor, a.estimate_high_minor,
           COALESCE(u.display_name, cu.display_name, a.metadata->>'artistName', o.name) AS artist_name,
           pm.url AS image_url
    FROM auction_lot al
    JOIN artwork_variant av ON av.id = al.artwork_variant_id
    JOIN artwork a ON a.id = av.artwork_id
    JOIN store s ON s.id = a.store_id
    LEFT JOIN organizations o ON o.id = s.owner_org_id
    LEFT JOIN users u ON u.id = a.artist_user_id
    LEFT JOIN users cu ON cu.id = a.credited_artist_user_id AND a.credit_status = 'credited'
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    WHERE al.series_id = ${seriesId}
    ORDER BY al.lot_number ASC NULLS LAST, al.end_at ASC
  `) as unknown as Row[];
  return rows.map((r) => ({
    id: r.id as string,
    lotNumber: r.lot_number == null ? null : Number(r.lot_number),
    status: r.status as string,
    startAt: iso(r.start_at)!,
    endAt: iso(r.end_at)!,
    startingBidMinor: Number(r.starting_bid_minor),
    currentBidMinor: r.current_bid_minor == null ? null : Number(r.current_bid_minor),
    reserveMinor: r.reserve_minor == null ? null : Number(r.reserve_minor),
    buyNowMinor: r.buy_now_minor == null ? null : Number(r.buy_now_minor),
    bidCount: Number(r.bid_count),
    currency: String(r.currency).trim(),
    artworkId: r.artwork_id as string,
    title: r.title as string,
    artistName: (r.artist_name as string | null) ?? null,
    imageUrl: (r.image_url as string | null) ?? null,
    estimateLowMinor: r.estimate_low_minor == null ? null : Number(r.estimate_low_minor),
    estimateHighMinor: r.estimate_high_minor == null ? null : Number(r.estimate_high_minor),
    leaderPaddle: paddleFor((r.winner_user_id as string | null) ?? null),
  }));
}

export async function listSeriesMembers(seriesId: string): Promise<SeriesMember[]> {
  const rows = (await db`
    SELECT m.user_id, m.role, u.display_name, u.email
    FROM auction_series_member m JOIN users u ON u.id = m.user_id
    WHERE m.series_id = ${seriesId}
    ORDER BY m.role ASC, u.display_name ASC NULLS LAST
  `) as unknown as Row[];
  return rows.map((r) => ({
    userId: r.user_id as string,
    role: r.role as SeriesMember["role"],
    displayName: (r.display_name as string | null) ?? null,
    email: (r.email as string | null) ?? null,
  }));
}

/** Open lots not yet in any series, for the manage page's "add a lot" picker. */
export async function listUnassignedOpenLots(orgId = "market"): Promise<Array<{ id: string; title: string; artistName: string | null; endAt: string }>> {
  const rows = (await db`
    SELECT al.id, al.end_at, a.title, COALESCE(u.display_name, o.name) AS artist_name
    FROM auction_lot al
    JOIN artwork_variant av ON av.id = al.artwork_variant_id
    JOIN artwork a ON a.id = av.artwork_id
    JOIN store s ON s.id = a.store_id
    LEFT JOIN organizations o ON o.id = s.owner_org_id
    LEFT JOIN users u ON u.id = a.artist_user_id
    WHERE al.series_id IS NULL AND al.status IN ('scheduled', 'live') AND al.org_id = ${orgId}
    ORDER BY al.created_at DESC LIMIT 100
  `) as unknown as Row[];
  return rows.map((r) => ({ id: r.id as string, title: r.title as string, artistName: (r.artist_name as string | null) ?? null, endAt: iso(r.end_at)! }));
}

/** Recent bids across a series, newest first, with paddles only. For the presenter board. */
export async function listSeriesBidFeed(seriesId: string, limit = 20): Promise<Array<{ lotId: string; lotNumber: number | null; title: string; amountMinor: number; currency: string; paddle: string; placedAt: string }>> {
  const rows = (await db`
    SELECT b.lot_id, b.amount_minor, b.bidder_id, b.placed_at, al.lot_number, al.currency, a.title
    FROM bid b
    JOIN auction_lot al ON al.id = b.lot_id
    JOIN artwork_variant av ON av.id = al.artwork_variant_id
    JOIN artwork a ON a.id = av.artwork_id
    WHERE al.series_id = ${seriesId}
    ORDER BY b.placed_at DESC LIMIT ${Math.min(limit, 100)}
  `) as unknown as Row[];
  return rows.map((r) => ({
    lotId: r.lot_id as string,
    lotNumber: r.lot_number == null ? null : Number(r.lot_number),
    title: r.title as string,
    amountMinor: Number(r.amount_minor),
    currency: String(r.currency).trim(),
    paddle: paddleFor(r.bidder_id as string)!,
    placedAt: iso(r.placed_at)!,
  }));
}

/** The series a person takes part in: as a desk member, a slot assignee, or the artist of a lot. */
export async function listSeriesForUser(userId: string): Promise<Array<AuctionSeries & { roles: string[] }>> {
  const rows = (await db`
    SELECT ${SERIES_SELECT},
      ARRAY_REMOVE(ARRAY[
        (SELECT m.role FROM auction_series_member m WHERE m.series_id = s.id AND m.user_id = ${userId}),
        (SELECT 'assignee' FROM auction_series_slot sl WHERE sl.series_id = s.id AND sl.assignee_user_id = ${userId} LIMIT 1),
        (SELECT 'artist' FROM auction_lot al JOIN artwork_variant av ON av.id = al.artwork_variant_id JOIN artwork a ON a.id = av.artwork_id
          WHERE al.series_id = s.id AND (a.artist_user_id = ${userId} OR a.credited_artist_user_id = ${userId}) LIMIT 1)
      ], NULL) AS roles
    FROM auction_series s ${SERIES_JOIN}
    WHERE EXISTS (SELECT 1 FROM auction_series_member m WHERE m.series_id = s.id AND m.user_id = ${userId})
       OR EXISTS (SELECT 1 FROM auction_series_slot sl WHERE sl.series_id = s.id AND sl.assignee_user_id = ${userId})
       OR EXISTS (SELECT 1 FROM auction_lot al JOIN artwork_variant av ON av.id = al.artwork_variant_id JOIN artwork a ON a.id = av.artwork_id
                  WHERE al.series_id = s.id AND (a.artist_user_id = ${userId} OR a.credited_artist_user_id = ${userId}))
    ORDER BY COALESCE(s.live_at, s.created_at) DESC
  `) as unknown as Row[];
  return rows.map((r) => ({ ...mapSeries(r), roles: (r.roles as string[]) ?? [] }));
}

// ─── A person's auction activity (My art) ─────────────────────────────────────

export interface MyBid {
  lotId: string;
  title: string;
  imageUrl: string | null;
  seriesSlug: string | null;
  seriesTitle: string | null;
  lotStatus: string;
  endAt: string;
  currency: string;
  currentBidMinor: number | null;
  myMaxMinor: number;
  /** I hold the leading bid. */
  leading: boolean;
  /** The lot closed and I won it. */
  won: boolean;
  orderId: string | null;
}

/** Every lot this person has bid on, newest activity first. */
export async function listBidsForUser(userId: string, limit = 50): Promise<MyBid[]> {
  const rows = (await db`
    SELECT al.id AS lot_id, al.status, al.end_at, al.currency, al.current_bid_minor, al.winner_user_id,
           al.metadata->>'orderId' AS order_id,
           a.title, pm.url AS image_url, s.slug AS series_slug, s.title AS series_title,
           MAX(COALESCE(b.max_amount_minor, b.amount_minor)) AS my_max,
           MAX(b.placed_at) AS last_at
    FROM bid b
    JOIN auction_lot al ON al.id = b.lot_id
    JOIN artwork_variant av ON av.id = al.artwork_variant_id
    JOIN artwork a ON a.id = av.artwork_id
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    LEFT JOIN auction_series s ON s.id = al.series_id
    WHERE b.bidder_id = ${userId}
    GROUP BY al.id, a.id, pm.url, s.slug, s.title
    ORDER BY last_at DESC
    LIMIT ${Math.min(limit, 200)}
  `) as unknown as Row[];
  return rows.map((r) => {
    const status = r.status as string;
    const mine = r.winner_user_id === userId;
    return {
      lotId: r.lot_id as string,
      title: r.title as string,
      imageUrl: (r.image_url as string | null) ?? null,
      seriesSlug: (r.series_slug as string | null) ?? null,
      seriesTitle: (r.series_title as string | null) ?? null,
      lotStatus: status,
      endAt: iso(r.end_at)!,
      currency: String(r.currency).trim(),
      currentBidMinor: r.current_bid_minor == null ? null : Number(r.current_bid_minor),
      myMaxMinor: Number(r.my_max),
      leading: mine && (status === "live" || status === "scheduled"),
      won: mine && status === "sold",
      orderId: (r.order_id as string | null) ?? null,
    };
  });
}

export interface SeriesPublication {
  slotId: string;
  threadId: string;
  title: string;
  slug: string | null;
  authorSlug: string | null;
  authorName: string | null;
  weekNo: number | null;
}

/** Writing attached to a series by its participants (slots of kind `article`). */
export async function listSeriesPublications(seriesId: string): Promise<SeriesPublication[]> {
  const rows = (await db`
    SELECT sl.id AS slot_id, sl.week_no, t.id AS thread_id, t.title, t.slug, u.slug AS author_slug, u.display_name
    FROM auction_series_slot sl
    JOIN threads t ON t.id = sl.thread_id
    LEFT JOIN users u ON u.id = t.author_id
    WHERE sl.series_id = ${seriesId} AND sl.kind = 'article' AND sl.thread_id IS NOT NULL
      AND t.status = 'published'
    ORDER BY sl.week_no ASC NULLS LAST, sl.created_at ASC
  `) as unknown as Row[];
  return rows.map((r) => ({
    slotId: r.slot_id as string,
    threadId: r.thread_id as string,
    title: r.title as string,
    slug: (r.slug as string | null) ?? null,
    authorSlug: (r.author_slug as string | null) ?? null,
    authorName: (r.display_name as string | null) ?? null,
    weekNo: r.week_no == null ? null : Number(r.week_no),
  }));
}

/** A person's published writing, for the "attach a publication" picker. */
export async function listWritingForUser(userId: string, limit = 50): Promise<Array<{ id: string; title: string; slug: string | null; orgId: string; publishedAt: string | null }>> {
  const rows = (await db`
    SELECT id, title, slug, org_id, published_at FROM threads
    WHERE author_id = ${userId} AND status = 'published' AND kind IN ('writing', 'post', 'article', 'publication')
    ORDER BY published_at DESC NULLS LAST, created_at DESC
    LIMIT ${Math.min(limit, 200)}
  `) as unknown as Row[];
  return rows.map((r) => ({ id: r.id as string, title: r.title as string, slug: (r.slug as string | null) ?? null, orgId: r.org_id as string, publishedAt: iso(r.published_at) }));
}

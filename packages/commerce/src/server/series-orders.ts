import { db } from "@elkdonis/db";
import { jsonb, type Row } from "./map-order";
import { canEditSeries } from "./series";
import { canActForOrder } from "./access";
import { markOrderFulfilled } from "./orders";
import { getBalance } from "./ledger";

// ============================================================================
// Series workspace: orders, fulfilment, money and artists of one auction
// series (2026-10-28). A lot's order is the one settleExpiredLots (or
// buyNowLot) created with `metadata.lotId` = the lot id. Hand-over and
// receipt are recorded on the order's metadata (`handover`, `receivedAt`);
// "Buyer has it" also marks a paid order fulfilled through markOrderFulfilled.
// Money is read from payout_ledger rows for those orders, summed; nothing
// here writes the ledger (payouts go through recordPayout).
// ============================================================================

export type HandoverMethod = "pickup" | "shipped" | "artist";
export type HandoverInfo = { method?: HandoverMethod; tracking?: string | null };

export interface SeriesOrderRow {
  lotId: string;
  lotNumber: number | null;
  lotStatus: string;
  title: string;
  artworkId: string;
  imageUrl: string | null;
  artistName: string | null;
  /** The maker of record (payee); null for donated or name-only pieces. */
  makerUserId: string | null;
  donated: boolean;
  makerStripe: boolean;
  makerHasPayoutMethod: boolean;
  hammerMinor: number | null;
  currency: string;
  order: null | {
    id: string;
    number: string | null;
    status: string;
    paymentMethod: string | null;
    dueAt: string | null;
    paidAt: string | null;
    fulfilledAt: string | null;
    cancelledAt: string | null;
    totalMinor: number;
    buyerName: string | null;
    handover: HandoverInfo | null;
    receivedAt: string | null;
    /** The maker's share on this order. */
    makerShareMinor: number;
    /** The maker was paid in the same motion (Stripe destination charge, or eTransfer to the maker). */
    makerPaidAtSource: boolean;
  };
}

const PAID = ["paid", "fulfilled", "completed"];
const iso = (v: unknown) => (v == null ? null : new Date(v as string).toISOString());

export async function listSeriesOrders(seriesId: string): Promise<SeriesOrderRow[]> {
  const rows = (await db`
    SELECT al.id AS lot_id, al.lot_number, al.status AS lot_status, al.current_bid_minor, al.currency,
           a.id AS artwork_id, a.title, a.artist_user_id, a.credited_artist_user_id,
           pm.url AS image_url,
           COALESCE(mu.display_name, cu.display_name, a.metadata->>'artistName', og.name) AS artist_name,
           (mu.stripe_onboarded_at IS NOT NULL) AS maker_stripe,
           (mu.payout_email IS NOT NULL OR mu.stripe_onboarded_at IS NOT NULL) AS maker_payout,
           o.id AS order_id, o.number AS order_number, o.status AS order_status, o.payment_method,
           o.payment_due_at, o.paid_at, o.fulfilled_at, o.cancelled_at, o.total_minor, o.metadata AS order_meta,
           COALESCE(bu.display_name, o.customer_name, o.customer_email) AS buyer_name,
           COALESCE((SELECT SUM(l.artist_share_minor) FROM commerce_order_line l WHERE l.order_id = o.id), 0)::bigint AS maker_share,
           EXISTS (
             SELECT 1 FROM payout_ledger pl
             WHERE pl.order_id = o.id AND pl.entry_type = 'payout' AND pl.party_kind = 'user'
               AND pl.party_user_id = a.artist_user_id
           ) AS paid_at_source
    FROM auction_lot al
    JOIN auction_series ser ON ser.id = al.series_id
    JOIN artwork_variant av ON av.id = al.artwork_variant_id
    JOIN artwork a ON a.id = av.artwork_id
    JOIN store st ON st.id = a.store_id
    LEFT JOIN organizations og ON og.id = st.owner_org_id
    LEFT JOIN users mu ON mu.id = a.artist_user_id
    LEFT JOIN users cu ON cu.id = a.credited_artist_user_id AND a.credit_status = 'credited'
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    LEFT JOIN LATERAL (
      SELECT * FROM commerce_order co
      WHERE co.metadata->>'lotId' = al.id::text
      ORDER BY co.created_at DESC LIMIT 1
    ) o ON true
    LEFT JOIN users bu ON bu.id = o.customer_id
    WHERE al.series_id = ${seriesId} AND al.org_id = ser.org_id
      AND (al.status IN ('sold', 'passed', 'cancelled') OR al.winner_user_id IS NOT NULL OR o.id IS NOT NULL)
    ORDER BY al.lot_number ASC NULLS LAST, al.end_at ASC
  `) as unknown as Row[];

  return rows.map((r) => {
    const meta = (r.order_meta as Record<string, unknown> | null) ?? {};
    return {
      lotId: r.lot_id as string,
      lotNumber: r.lot_number == null ? null : Number(r.lot_number),
      lotStatus: r.lot_status as string,
      title: r.title as string,
      artworkId: r.artwork_id as string,
      imageUrl: (r.image_url as string | null) ?? null,
      artistName: (r.artist_name as string | null) ?? null,
      makerUserId: (r.artist_user_id as string | null) ?? null,
      donated: !r.artist_user_id,
      makerStripe: Boolean(r.maker_stripe),
      makerHasPayoutMethod: Boolean(r.maker_payout),
      hammerMinor: r.current_bid_minor == null ? null : Number(r.current_bid_minor),
      currency: (r.currency as string) ?? "CAD",
      order: r.order_id
        ? {
            id: r.order_id as string,
            number: (r.order_number as string | null) ?? null,
            status: r.order_status as string,
            paymentMethod: (r.payment_method as string | null) ?? null,
            dueAt: iso(r.payment_due_at),
            paidAt: iso(r.paid_at),
            fulfilledAt: iso(r.fulfilled_at),
            cancelledAt: iso(r.cancelled_at),
            totalMinor: Number(r.total_minor ?? 0),
            buyerName: (r.buyer_name as string | null) ?? null,
            handover: (meta.handover as HandoverInfo | undefined) ?? null,
            receivedAt: typeof meta.receivedAt === "string" ? meta.receivedAt : null,
            makerShareMinor: Number(r.maker_share ?? 0),
            makerPaidAtSource: Boolean(r.paid_at_source),
          }
        : null,
    };
  });
}

/** Where a row stands, for the filters and the summary tiles. */
export function seriesOrderStage(row: SeriesOrderRow): "unsold" | "awaiting" | "lapsed" | "handover" | "transit" | "artist" | "complete" {
  const o = row.order;
  if (!o) return "unsold";
  if (o.status === "cancelled" || o.status === "refunded") return o.paidAt ? "complete" : "lapsed";
  if (!PAID.includes(o.status)) return "awaiting";
  const received = Boolean(o.receivedAt || o.fulfilledAt);
  if (!received) return o.handover?.method === "shipped" ? "transit" : "handover";
  if (row.makerUserId && !o.makerPaidAtSource && o.makerShareMinor > 0) return "artist";
  return "complete";
}

/** The order, if it belongs to a lot of this series. */
async function seriesOrder(seriesId: string, orderId: string): Promise<Row | null> {
  const [r] = (await db`
    SELECT o.id, o.status, o.metadata
    FROM commerce_order o
    JOIN auction_lot al ON al.id::text = o.metadata->>'lotId'
    JOIN auction_series ser ON ser.id = al.series_id AND al.org_id = ser.org_id
    WHERE o.id = ${orderId} AND al.series_id = ${seriesId}
    LIMIT 1
  `) as unknown as Row[];
  return r ?? null;
}

/** How the piece reaches the buyer, and the tracking reference when shipped. */
export async function setSeriesOrderHandover(input: {
  seriesId: string;
  actorUserId: string;
  orderId: string;
  method: HandoverMethod;
  tracking?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!(await canEditSeries(input.actorUserId, input.seriesId))) return { ok: false, error: "You cannot edit this series." };
  if (!["pickup", "shipped", "artist"].includes(input.method)) return { ok: false, error: "Unknown hand-over." };
  const o = await seriesOrder(input.seriesId, input.orderId);
  if (!o) return { ok: false, error: "That order is not in this series." };
  const tracking = input.method === "shipped" ? (input.tracking ?? "").trim().slice(0, 200) || null : null;
  await db`
    UPDATE commerce_order
    SET metadata = COALESCE(metadata, '{}'::jsonb) || ${jsonb({
      handover: { method: input.method, tracking, by: input.actorUserId, at: new Date().toISOString() },
    })}
    WHERE id = ${input.orderId}
  `;
  return { ok: true };
}

/**
 * The buyer has the piece (or not). Ticking it marks a paid order fulfilled
 * (markOrderFulfilled) and stamps `receivedAt`; unticking removes the stamp
 * but leaves the order's status as it is.
 */
export async function setSeriesOrderReceived(input: {
  seriesId: string;
  actorUserId: string;
  orderId: string;
  received: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  if (!(await canEditSeries(input.actorUserId, input.seriesId))) return { ok: false, error: "You cannot edit this series." };
  const o = await seriesOrder(input.seriesId, input.orderId);
  if (!o) return { ok: false, error: "That order is not in this series." };
  if (!input.received) {
    await db`UPDATE commerce_order SET metadata = COALESCE(metadata, '{}'::jsonb) - 'receivedAt' WHERE id = ${input.orderId}`;
    return { ok: true };
  }
  if (!PAID.includes(o.status as string)) return { ok: false, error: "The buyer has not paid yet." };
  if (o.status === "paid") {
    await markOrderFulfilled({ orderId: input.orderId, actorUserId: input.actorUserId, note: "received by the buyer (series workspace)" });
  }
  await db`
    UPDATE commerce_order
    SET metadata = COALESCE(metadata, '{}'::jsonb) || ${jsonb({ receivedAt: new Date().toISOString(), receivedMarkedBy: input.actorUserId })}
    WHERE id = ${input.orderId}
  `;
  return { ok: true };
}

/**
 * Who may confirm a manual payment on a series order: a network admin, or a
 * manager of the store that sold it (the existing money rule, canActForOrder
 * with `manager`). Series editors alone may not: the money arrives in the
 * collective's account, which they cannot see.
 */
export async function canConfirmSeriesPayment(userId: string, seriesId: string, orderId: string): Promise<boolean> {
  if (!(await seriesOrder(seriesId, orderId))) return false;
  const [a] = (await db`SELECT 1 FROM users WHERE id = ${userId} AND is_admin = true`) as unknown as Row[];
  if (a) return true;
  return canActForOrder(userId, orderId, { minRole: "manager" });
}

export async function isNetworkAdmin(userId: string): Promise<boolean> {
  const [a] = (await db`SELECT 1 FROM users WHERE id = ${userId} AND is_admin = true`) as unknown as Row[];
  return Boolean(a);
}

// ─── Money ───────────────────────────────────────────────────────────────────

export interface SeriesMoney {
  currency: string;
  collectedMinor: number;
  /** Accrued to the presenting org, other orgs and charities (commission, donations). */
  toOrgsMinor: number;
  toPlatformMinor: number;
  /** Accrued to makers on this series' orders. */
  toArtistsMinor: number;
  /** Paid to makers in the same motion as the sale (Stripe destination, eTransfer to the maker). */
  paidAtSourceMinor: number;
  /** Accrued on this series' orders and still under a hold. */
  heldMinor: number;
  awaitingMinor: number;
  artists: Array<{
    userId: string;
    name: string;
    slug: string | null;
    accruedMinor: number;
    paidAtSourceMinor: number;
    /** The person's whole balance in the marketplace (payouts are not tied to orders). */
    payableMinor: number;
    heldMinor: number;
    payoutMethod: string | null;
    payoutEmail: string | null;
    stripe: boolean;
  }>;
}

export async function getSeriesMoney(seriesId: string): Promise<SeriesMoney> {
  const [tot] = (await db`
    WITH ord AS (
      SELECT DISTINCT ON (al.id) co.*
      FROM auction_lot al
      JOIN auction_series ser ON ser.id = al.series_id AND al.org_id = ser.org_id
      JOIN commerce_order co ON co.metadata->>'lotId' = al.id::text
      WHERE al.series_id = ${seriesId}
      ORDER BY al.id, co.created_at DESC
    ), led AS (
      SELECT pl.*, (
        pl.hold_reason IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM payout_ledger r WHERE r.releases_entry_id = pl.id AND r.entry_type = 'release')
      ) AS held
      FROM payout_ledger pl WHERE pl.order_id IN (SELECT id FROM ord)
    )
    SELECT
      (SELECT COALESCE(MAX(currency), 'CAD') FROM ord) AS currency,
      (SELECT COALESCE(SUM(total_minor), 0) FROM ord WHERE status IN ('paid', 'fulfilled', 'completed'))::bigint AS collected,
      (SELECT COALESCE(SUM(total_minor), 0) FROM ord WHERE status IN ('pending_payment', 'awaiting_etransfer', 'payment_received'))::bigint AS awaiting,
      COALESCE(SUM(amount_minor) FILTER (WHERE entry_type IN ('accrual', 'refund') AND party_kind IN ('org', 'payee')), 0)::bigint AS to_orgs,
      COALESCE(SUM(amount_minor) FILTER (WHERE entry_type IN ('accrual', 'refund') AND party_kind = 'platform'), 0)::bigint AS to_platform,
      COALESCE(SUM(amount_minor) FILTER (WHERE entry_type IN ('accrual', 'refund') AND party_kind = 'user'), 0)::bigint AS to_artists,
      COALESCE(-SUM(amount_minor) FILTER (WHERE entry_type = 'payout' AND party_kind = 'user'), 0)::bigint AS paid_source,
      COALESCE(SUM(amount_minor) FILTER (WHERE entry_type = 'accrual' AND held), 0)::bigint AS held
    FROM led
  `) as unknown as Row[];

  const artistRows = (await db`
    WITH ord AS (
      SELECT DISTINCT ON (al.id) co.id
      FROM auction_lot al
      JOIN auction_series ser ON ser.id = al.series_id AND al.org_id = ser.org_id
      JOIN commerce_order co ON co.metadata->>'lotId' = al.id::text
      WHERE al.series_id = ${seriesId}
      ORDER BY al.id, co.created_at DESC
    )
    SELECT pl.party_user_id AS user_id,
      COALESCE(u.display_name, u.email, 'Artist') AS name, u.slug,
      u.payout_method, u.payout_email, (u.stripe_onboarded_at IS NOT NULL) AS stripe,
      COALESCE(SUM(pl.amount_minor) FILTER (WHERE pl.entry_type IN ('accrual', 'refund')), 0)::bigint AS accrued,
      COALESCE(-SUM(pl.amount_minor) FILTER (WHERE pl.entry_type = 'payout'), 0)::bigint AS paid_source
    FROM payout_ledger pl
    LEFT JOIN users u ON u.id = pl.party_user_id
    WHERE pl.order_id IN (SELECT id FROM ord) AND pl.party_kind = 'user'
    GROUP BY pl.party_user_id, u.display_name, u.email, u.slug, u.payout_method, u.payout_email, u.stripe_onboarded_at
    ORDER BY name
  `) as unknown as Row[];

  const currency = (tot?.currency as string) ?? "CAD";
  const artists = await Promise.all(
    artistRows.map(async (r) => {
      const b = await getBalance({ kind: "user", userId: r.user_id as string }, currency);
      return {
        userId: r.user_id as string,
        name: r.name as string,
        slug: (r.slug as string | null) ?? null,
        accruedMinor: Number(r.accrued),
        paidAtSourceMinor: Number(r.paid_source),
        payableMinor: b.payableMinor,
        heldMinor: b.heldMinor,
        payoutMethod: (r.payout_method as string | null) ?? null,
        payoutEmail: (r.payout_email as string | null) ?? null,
        stripe: Boolean(r.stripe),
      };
    })
  );

  return {
    currency,
    collectedMinor: Number(tot?.collected ?? 0),
    toOrgsMinor: Number(tot?.to_orgs ?? 0),
    toPlatformMinor: Number(tot?.to_platform ?? 0),
    toArtistsMinor: Number(tot?.to_artists ?? 0),
    paidAtSourceMinor: Number(tot?.paid_source ?? 0),
    heldMinor: Number(tot?.held ?? 0),
    awaitingMinor: Number(tot?.awaiting ?? 0),
    artists,
  };
}

// ─── Artists ─────────────────────────────────────────────────────────────────

export interface SeriesArtist {
  /** A user id, or `name:<name>` for an artist without an account. */
  key: string;
  userId: string | null;
  name: string;
  slug: string | null;
  role: "maker" | "credited" | "name-only";
  lotCount: number;
  highBidsMinor: number;
  hasStore: boolean;
  stripe: boolean;
  payoutEmail: boolean;
  payoutMethod: string | null;
}

export async function listSeriesArtists(seriesId: string): Promise<SeriesArtist[]> {
  const rows = (await db`
    SELECT
      COALESCE(a.artist_user_id::text, a.credited_artist_user_id::text, 'name:' || (a.metadata->>'artistName')) AS key,
      COALESCE(a.artist_user_id, a.credited_artist_user_id) AS user_id,
      CASE WHEN a.artist_user_id IS NOT NULL THEN 'maker'
           WHEN a.credited_artist_user_id IS NOT NULL THEN 'credited'
           ELSE 'name-only' END AS role,
      COALESCE(u.display_name, u.email, a.metadata->>'artistName', 'Unattributed') AS name,
      u.slug, u.payout_method, (u.payout_email IS NOT NULL) AS payout_email, (u.stripe_onboarded_at IS NOT NULL) AS stripe,
      EXISTS (SELECT 1 FROM store s2 WHERE s2.owner_user_id = u.id AND s2.org_id = ser.org_id AND s2.status = 'active') AS has_store,
      COUNT(*)::int AS lots,
      COALESCE(SUM(al.current_bid_minor), 0)::bigint AS high
    FROM auction_lot al
    JOIN auction_series ser ON ser.id = al.series_id AND al.org_id = ser.org_id
    JOIN artwork_variant av ON av.id = al.artwork_variant_id
    JOIN artwork a ON a.id = av.artwork_id
    LEFT JOIN users u ON u.id = COALESCE(a.artist_user_id, a.credited_artist_user_id)
    WHERE al.series_id = ${seriesId}
    GROUP BY 1, 2, 3, 4, u.id, u.slug, u.payout_method, u.payout_email, u.stripe_onboarded_at, ser.org_id
    ORDER BY name
  `) as unknown as Row[];
  return rows
    .filter((r) => r.key != null)
    .map((r) => ({
      key: r.key as string,
      userId: (r.user_id as string | null) ?? null,
      name: r.name as string,
      slug: (r.slug as string | null) ?? null,
      role: r.role as SeriesArtist["role"],
      lotCount: Number(r.lots),
      highBidsMinor: Number(r.high),
      hasStore: Boolean(r.has_store),
      stripe: Boolean(r.stripe),
      payoutEmail: Boolean(r.payout_email),
      payoutMethod: (r.payout_method as string | null) ?? null,
    }));
}

// ─── Visitors ────────────────────────────────────────────────────────────────

export interface SeriesVisitors {
  days: Array<{ day: string; views: number; visitors: number }>;
  totalViews: number;
  totalVisitors: number;
  pageViews: number;
  liveViews: number;
  topLots: Array<{ lotId: string; title: string; lotNumber: number | null; views: number }>;
}

/**
 * Page views of the series page, its presenter board and its lot pages, from
 * analytics_events (the marketplace's own rows). Workspace pages are left out.
 * Visitors are unique per day and summed (README of @elkdonis/analytics).
 */
export async function getSeriesVisitors(seriesId: string, slug: string, orgId: string, sinceDays = 60): Promise<SeriesVisitors> {
  const page = `/series/${slug}`;
  const live = `/series/${slug}/live`;
  const lots = (await db`
    SELECT al.id, al.lot_number, a.title FROM auction_lot al
    JOIN artwork_variant av ON av.id = al.artwork_variant_id
    JOIN artwork a ON a.id = av.artwork_id
    WHERE al.series_id = ${seriesId}
  `) as unknown as Row[];
  const lotPaths = lots.map((l) => `/lots/${l.id as string}`);
  const paths = [page, live, ...lotPaths];

  const days = (await db`
    SELECT to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') AS day,
           COUNT(*)::int AS views, COUNT(DISTINCT visitor_id)::int AS visitors
    FROM analytics_events
    WHERE org_id = ${orgId} AND kind = 'pageview' AND path = ANY(${paths})
      AND occurred_at >= now() - (${sinceDays} * interval '1 day')
    GROUP BY 1 ORDER BY 1
  `) as unknown as Row[];
  const byPath = (await db`
    SELECT path, COUNT(*)::int AS views
    FROM analytics_events
    WHERE org_id = ${orgId} AND kind = 'pageview' AND path = ANY(${paths})
      AND occurred_at >= now() - (${sinceDays} * interval '1 day')
    GROUP BY path
  `) as unknown as Row[];
  const views = new Map(byPath.map((r) => [r.path as string, Number(r.views)]));
  const topLots = lots
    .map((l) => ({
      lotId: l.id as string,
      title: l.title as string,
      lotNumber: l.lot_number == null ? null : Number(l.lot_number),
      views: views.get(`/lots/${l.id as string}`) ?? 0,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);
  const d = days.map((r) => ({ day: r.day as string, views: Number(r.views), visitors: Number(r.visitors) }));
  return {
    days: d,
    totalViews: d.reduce((s, r) => s + r.views, 0),
    totalVisitors: d.reduce((s, r) => s + r.visitors, 0),
    pageViews: views.get(page) ?? 0,
    liveViews: views.get(live) ?? 0,
    topLots,
  };
}

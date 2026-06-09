/**
 * Server-side data queries for the commerce + auction domain.
 *
 * All queries respect tenancy by JOINing through marketplace_artists
 * (status='active') instead of filtering on a single org_id — this is the
 * "aggregate across orgs" tenancy chosen for Art-Auction.
 *
 * Money columns come back as JS numbers; postgres node driver returns BIGINT
 * as string by default — we coerce via Number() (safe for amounts < 2^53).
 */

import { db } from "@elkdonis/db";
import type {
  Artwork,
  ArtworkMedia,
  ArtworkVariant,
  AuctionLot,
  Bid,
  Cart,
  CartLine,
  MarketplaceArtist,
  MarketplaceArtistLink,
  Order,
} from "../types";

type Row = Record<string, unknown>;

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const opt = <T>(v: unknown): T | null => (v == null ? null : (v as T));

function mapArtwork(r: Row): Artwork {
  return {
    id: r.id as string,
    orgId: r.org_id as string,
    artistUserId: r.artist_user_id as string,
    slug: r.slug as string,
    title: r.title as string,
    descriptionHtml: opt(r.description_html),
    yearCreated: opt<number>(r.year_created),
    medium: opt(r.medium),
    style: opt(r.style),
    subject: opt(r.subject),
    heightCm: opt<number>(r.height_cm),
    widthCm: opt<number>(r.width_cm),
    depthCm: opt<number>(r.depth_cm),
    weightKg: opt<number>(r.weight_kg),
    kind: r.kind as Artwork["kind"],
    certificateOfAuthenticity: Boolean(r.certificate_of_authenticity),
    provenanceNotes: opt(r.provenance_notes),
    status: r.status as Artwork["status"],
    primaryImageId: opt(r.primary_image_id),
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    viewCount: r.view_count != null ? Number(r.view_count) : 0,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    artistName: opt(r.artist_name),
    artistSlug: opt(r.artist_slug),
    primaryImageUrl: opt(r.primary_image_url),
    primaryImageAlt: opt(r.primary_image_alt),
  };
}

function mapVariant(r: Row): ArtworkVariant {
  return {
    id: r.id as string,
    artworkId: r.artwork_id as string,
    orgId: r.org_id as string,
    sku: opt(r.sku),
    label: opt(r.label),
    priceMinor: num(r.price_minor),
    currency: r.currency as ArtworkVariant["currency"],
    editionNumber: opt<number>(r.edition_number),
    editionTotal: opt<number>(r.edition_total),
    inventoryQty: num(r.inventory_qty),
    position: num(r.position),
    createdAt: r.created_at as string,
  };
}

function mapMedia(r: Row): ArtworkMedia {
  return {
    id: r.id as string,
    artworkId: r.artwork_id as string,
    orgId: r.org_id as string,
    url: r.url as string,
    nextcloudFileId: opt(r.nextcloud_file_id),
    nextcloudPath: opt(r.nextcloud_path),
    alt: opt(r.alt),
    role: r.role as ArtworkMedia["role"],
    position: num(r.position),
    createdAt: r.created_at as string,
  };
}

function mapLot(r: Row): AuctionLot {
  return {
    id: r.id as string,
    artworkVariantId: r.artwork_variant_id as string,
    orgId: r.org_id as string,
    startAt: r.start_at as string,
    endAt: r.end_at as string,
    startingBidMinor: num(r.starting_bid_minor),
    reserveMinor: opt<number>(r.reserve_minor),
    buyNowMinor: opt<number>(r.buy_now_minor),
    bidIncrementMinor: num(r.bid_increment_minor),
    antiSnipeMinutes: num(r.anti_snipe_minutes),
    currentBidMinor: opt<number>(r.current_bid_minor),
    currentBidId: opt(r.current_bid_id),
    bidCount: num(r.bid_count),
    currency: r.currency as AuctionLot["currency"],
    status: r.status as AuctionLot["status"],
    winnerUserId: opt(r.winner_user_id),
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

// ─── Artwork browse ─────────────────────────────────────────────────────────

export interface ListArtworksOptions {
  limit?: number;
  offset?: number;
  status?: Artwork["status"][];
  artistUserId?: string;
  orgId?: string;
  kind?: Artwork["kind"];
  q?: string;
}

export async function listArtworks(
  opts: ListArtworksOptions = {}
): Promise<Artwork[]> {
  const limit = Math.min(opts.limit ?? 24, 100);
  const offset = opts.offset ?? 0;
  const statusList = opts.status ?? ["available"];

  const rows = (await db`
    SELECT
      a.*,
      COALESCE(ap.display_name, u.display_name, u.email) AS artist_name,
      ap.user_id::text AS artist_slug,
      pm.url AS primary_image_url,
      pm.alt AS primary_image_alt
    FROM artwork a
    JOIN marketplace_artists ma ON ma.user_id = a.artist_user_id AND ma.status = 'active'
    JOIN users u ON u.id = a.artist_user_id
    LEFT JOIN artist_profiles ap ON ap.user_id = a.artist_user_id
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    WHERE a.status = ANY(${statusList})
      ${opts.artistUserId ? db`AND a.artist_user_id = ${opts.artistUserId}` : db``}
      ${opts.orgId ? db`AND a.org_id = ${opts.orgId}` : db``}
      ${opts.kind ? db`AND a.kind = ${opts.kind}` : db``}
      ${opts.q ? db`AND (a.title ILIKE ${"%" + opts.q + "%"} OR a.subject ILIKE ${"%" + opts.q + "%"})` : db``}
    ORDER BY a.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `) as unknown as Row[];

  return rows.map(mapArtwork);
}

export async function listFeaturedArtworks(opts: { limit?: number } = {}): Promise<Artwork[]> {
  return listArtworks({ limit: opts.limit ?? 8, status: ["available"] });
}

async function hydrateArtwork(artwork: Artwork): Promise<Artwork> {
  const [variants, media, lotRow] = await Promise.all([
    db`SELECT * FROM artwork_variant WHERE artwork_id = ${artwork.id} ORDER BY position` as Promise<unknown> as Promise<Row[]>,
    db`SELECT * FROM artwork_media WHERE artwork_id = ${artwork.id} ORDER BY position` as Promise<unknown> as Promise<Row[]>,
    db`
      SELECT al.* FROM auction_lot al
      JOIN artwork_variant av ON av.id = al.artwork_variant_id
      WHERE av.artwork_id = ${artwork.id} AND al.status IN ('scheduled','live')
      ORDER BY al.end_at ASC LIMIT 1
    ` as Promise<unknown> as Promise<Row[]>,
  ]);
  artwork.variants = variants.map(mapVariant);
  artwork.media = media.map(mapMedia);
  artwork.lot = lotRow[0] ? mapLot(lotRow[0]) : null;
  return artwork;
}

export async function getArtworkBySlug(
  orgId: string,
  slug: string
): Promise<Artwork | null> {
  const rows = (await db`
    SELECT
      a.*,
      COALESCE(ap.display_name, u.display_name, u.email) AS artist_name,
      ap.user_id::text AS artist_slug,
      pm.url AS primary_image_url,
      pm.alt AS primary_image_alt
    FROM artwork a
    LEFT JOIN users u ON u.id = a.artist_user_id
    LEFT JOIN artist_profiles ap ON ap.user_id = a.artist_user_id
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    WHERE a.org_id = ${orgId} AND a.slug = ${slug}
    LIMIT 1
  `) as unknown as Row[];
  if (!rows[0]) return null;
  return hydrateArtwork(mapArtwork(rows[0]));
}

export async function getArtworkById(id: string): Promise<Artwork | null> {
  const rows = (await db`
    SELECT
      a.*,
      COALESCE(ap.display_name, u.display_name, u.email) AS artist_name,
      ap.user_id::text AS artist_slug,
      pm.url AS primary_image_url,
      pm.alt AS primary_image_alt
    FROM artwork a
    LEFT JOIN users u ON u.id = a.artist_user_id
    LEFT JOIN artist_profiles ap ON ap.user_id = a.artist_user_id
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    WHERE a.id = ${id}
    LIMIT 1
  `) as unknown as Row[];
  if (!rows[0]) return null;
  return hydrateArtwork(mapArtwork(rows[0]));
}

/**
 * Increment an artwork's view counter. Fire-and-forget from the detail page;
 * failures are swallowed so a counter hiccup never breaks page render.
 * Returns the new count (or null on failure).
 */
export async function incrementArtworkView(id: string): Promise<number | null> {
  try {
    const rows = (await db`
      UPDATE artwork SET view_count = view_count + 1
      WHERE id = ${id}
      RETURNING view_count
    `) as unknown as Array<{ view_count: number | string }>;
    return rows[0] ? Number(rows[0].view_count) : null;
  } catch {
    return null;
  }
}

/** Fetch a lot together with its artwork (for the /lots/[id] page). */
export async function getLotWithArtwork(lotId: string): Promise<AuctionLot | null> {
  const lot = await getLotById(lotId);
  if (!lot) return null;
  const variantRows = (await db`
    SELECT artwork_id FROM artwork_variant WHERE id = ${lot.artworkVariantId} LIMIT 1
  `) as unknown as Row[];
  if (variantRows[0]) {
    const artwork = await getArtworkById(variantRows[0].artwork_id as string);
    if (artwork) lot.artwork = artwork;
  }
  return lot;
}

// ─── Artists ────────────────────────────────────────────────────────────────

function parseArtistLinks(v: unknown): MarketplaceArtistLink[] {
  if (!v) return [];
  const arr = typeof v === "string" ? safeJson(v) : v;
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .filter((x) => typeof x.url === "string" && x.url.length > 0)
    .map((x) => ({
      label: String(x.label ?? x.url),
      url: String(x.url),
    }));
}

function safeJson(v: string): unknown {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/**
 * Map a marketplace_artists row to the domain type. Display fields prefer the
 * self-contained columns (migration 054) and fall back to artist_profiles /
 * users when an older row hasn't been backfilled.
 */
function mapMarketplaceArtist(r: Row): MarketplaceArtist {
  return {
    userId: r.user_id as string,
    orgId: r.org_id as string,
    payoutEmail: r.payout_email as string,
    payoutMethod: r.payout_method as MarketplaceArtist["payoutMethod"],
    commissionRate: Number(r.commission_rate),
    defaultCurrency: r.default_currency as MarketplaceArtist["defaultCurrency"],
    status: r.status as MarketplaceArtist["status"],
    bioHtml: opt(r.bio_html),
    joinedAt: r.joined_at as string,
    updatedAt: r.updated_at as string,
    displayName:
      (opt<string>(r.display_name) ??
        opt<string>(r.fallback_display_name) ??
        opt<string>(r.fallback_user_name)) ||
      null,
    headline: opt(r.headline),
    city: opt<string>(r.city) ?? opt<string>(r.fallback_city) ?? null,
    photoUrl: opt<string>(r.photo_url) ?? opt<string>(r.fallback_photo_url) ?? null,
    links: parseArtistLinks(r.links),
    appliedAt: opt(r.applied_at),
    reviewedAt: opt(r.reviewed_at),
    reviewedBy: opt(r.reviewed_by),
    rejectionReason: opt(r.rejection_reason),
    slug: opt(r.slug),
  };
}

const ARTIST_FALLBACK_SELECT = db`
  ap.display_name AS fallback_display_name,
  COALESCE(u.display_name, u.email) AS fallback_user_name,
  ap.city AS fallback_city,
  ap.photo_url AS fallback_photo_url,
  COALESCE(ma.user_id::text) AS slug
`;

export async function listMarketplaceArtists(
  opts: { limit?: number } = {}
): Promise<MarketplaceArtist[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const rows = (await db`
    SELECT ma.*, ${ARTIST_FALLBACK_SELECT}
    FROM marketplace_artists ma
    JOIN users u ON u.id = ma.user_id
    LEFT JOIN artist_profiles ap ON ap.user_id = ma.user_id
    WHERE ma.status = 'active'
    ORDER BY ma.joined_at DESC
    LIMIT ${limit}
  `) as unknown as Row[];

  return rows.map(mapMarketplaceArtist);
}

/**
 * Fetch a single marketplace artist regardless of status (used by the studio
 * to show pending/rejected applicants their own record).
 */
export async function getMarketplaceArtist(
  userId: string
): Promise<MarketplaceArtist | null> {
  const rows = (await db`
    SELECT ma.*, ${ARTIST_FALLBACK_SELECT}
    FROM marketplace_artists ma
    JOIN users u ON u.id = ma.user_id
    LEFT JOIN artist_profiles ap ON ap.user_id = ma.user_id
    WHERE ma.user_id = ${userId}
    LIMIT 1
  `) as unknown as Row[];

  if (!rows[0]) return null;
  return mapMarketplaceArtist(rows[0]);
}

/** All artworks owned by an artist, any status — for the studio dashboard. */
export async function listMyArtworks(
  artistUserId: string
): Promise<Artwork[]> {
  const rows = (await db`
    SELECT
      a.*,
      pm.url AS primary_image_url,
      pm.alt AS primary_image_alt
    FROM artwork a
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    WHERE a.artist_user_id = ${artistUserId}
    ORDER BY a.created_at DESC
  `) as unknown as Row[];
  return rows.map(mapArtwork);
}

/**
 * Fetch an artwork for editing, scoped to its owner. Returns null if the
 * artwork doesn't exist or isn't owned by the given artist (ownership check).
 */
export async function getArtworkForEdit(
  artworkId: string,
  artistUserId: string
): Promise<Artwork | null> {
  const rows = (await db`
    SELECT a.* FROM artwork a
    WHERE a.id = ${artworkId} AND a.artist_user_id = ${artistUserId}
    LIMIT 1
  `) as unknown as Row[];
  if (!rows[0]) return null;
  return hydrateArtwork(mapArtwork(rows[0]));
}

/** Pending artist applications, oldest first — for the admin review queue. */
export async function listPendingArtistApplications(): Promise<
  MarketplaceArtist[]
> {
  const rows = (await db`
    SELECT ma.*, ${ARTIST_FALLBACK_SELECT}
    FROM marketplace_artists ma
    JOIN users u ON u.id = ma.user_id
    LEFT JOIN artist_profiles ap ON ap.user_id = ma.user_id
    WHERE ma.status = 'pending'
    ORDER BY ma.applied_at ASC
  `) as unknown as Row[];
  return rows.map(mapMarketplaceArtist);
}

// ─── Auction lots ───────────────────────────────────────────────────────────

export async function listLiveLots(opts: { limit?: number } = {}): Promise<AuctionLot[]> {
  const limit = Math.min(opts.limit ?? 12, 50);
  const rows = (await db`
    SELECT
      al.*,
      a.id  AS art_id, a.title AS art_title, a.slug AS art_slug,
      a.org_id AS art_org_id, a.artist_user_id AS art_artist_user_id,
      a.kind AS art_kind, a.status AS art_status,
      pm.url AS primary_image_url,
      pm.alt AS primary_image_alt,
      COALESCE(ap.display_name, u.display_name, u.email) AS artist_name
    FROM auction_lot al
    JOIN artwork_variant av ON av.id = al.artwork_variant_id
    JOIN artwork a ON a.id = av.artwork_id
    JOIN marketplace_artists ma ON ma.user_id = a.artist_user_id AND ma.status = 'active'
    JOIN users u ON u.id = a.artist_user_id
    LEFT JOIN artist_profiles ap ON ap.user_id = a.artist_user_id
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    WHERE al.status IN ('scheduled','live')
    ORDER BY al.end_at ASC
    LIMIT ${limit}
  `) as unknown as Row[];

  return rows.map((r) => {
    const lot = mapLot(r);
    lot.artwork = {
      id: r.art_id as string,
      orgId: r.art_org_id as string,
      artistUserId: r.art_artist_user_id as string,
      slug: r.art_slug as string,
      title: r.art_title as string,
      kind: r.art_kind as Artwork["kind"],
      status: r.art_status as Artwork["status"],
      certificateOfAuthenticity: true,
      metadata: {},
      viewCount: 0,
      createdAt: lot.createdAt,
      updatedAt: lot.updatedAt,
      primaryImageUrl: opt(r.primary_image_url),
      primaryImageAlt: opt(r.primary_image_alt),
      artistName: opt(r.artist_name),
    };
    return lot;
  });
}

/**
 * All auction lots belonging to a given artist (any status), newest-ending
 * first, with the artwork title + image attached. Powers the studio hub's
 * "Active auctions" section.
 */
export async function listLotsForArtist(
  artistUserId: string,
  opts: { limit?: number } = {}
): Promise<AuctionLot[]> {
  const limit = Math.min(opts.limit ?? 25, 100);
  const rows = (await db`
    SELECT
      al.*,
      a.id AS art_id, a.title AS art_title, a.slug AS art_slug,
      a.org_id AS art_org_id, a.artist_user_id AS art_artist_user_id,
      a.kind AS art_kind, a.status AS art_status,
      pm.url AS primary_image_url, pm.alt AS primary_image_alt
    FROM auction_lot al
    JOIN artwork_variant av ON av.id = al.artwork_variant_id
    JOIN artwork a ON a.id = av.artwork_id
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    WHERE a.artist_user_id = ${artistUserId}
    ORDER BY al.end_at DESC
    LIMIT ${limit}
  `) as unknown as Row[];

  return rows.map((r) => {
    const lot = mapLot(r);
    lot.artwork = {
      id: r.art_id as string,
      orgId: r.art_org_id as string,
      artistUserId: r.art_artist_user_id as string,
      slug: r.art_slug as string,
      title: r.art_title as string,
      kind: r.art_kind as Artwork["kind"],
      status: r.art_status as Artwork["status"],
      certificateOfAuthenticity: true,
      metadata: {},
      viewCount: 0,
      createdAt: lot.createdAt,
      updatedAt: lot.updatedAt,
      primaryImageUrl: opt(r.primary_image_url),
      primaryImageAlt: opt(r.primary_image_alt),
    };
    return lot;
  });
}

/**
 * Live/scheduled auctions returned as Artwork[] with `.lot` attached.
 * Convenient for grids (home page, /lots index) that render ArtworkCard.
 */
export async function listLiveAuctionArtworks(
  opts: { limit?: number } = {}
): Promise<Artwork[]> {
  const lots = await listLiveLots({ limit: opts.limit });
  return lots
    .filter((l) => l.artwork)
    .map((l) => {
      const artwork = l.artwork!;
      // Attach a backref-free lot copy so ArtworkCard can badge + route.
      artwork.lot = { ...l, artwork: undefined };
      return artwork;
    });
}

export async function getLotById(lotId: string): Promise<AuctionLot | null> {
  const rows = (await db`
    SELECT al.* FROM auction_lot al WHERE al.id = ${lotId} LIMIT 1
  `) as unknown as Row[];
  if (!rows[0]) return null;
  return mapLot(rows[0]);
}

export async function listBidsForLot(lotId: string, limit = 25): Promise<Bid[]> {
  const rows = (await db`
    SELECT b.*, COALESCE(u.display_name, u.email) AS bidder_name
    FROM bid b
    JOIN users u ON u.id = b.bidder_id
    WHERE b.lot_id = ${lotId}
    ORDER BY b.placed_at DESC
    LIMIT ${limit}
  `) as unknown as Row[];

  return rows.map((r) => ({
    id: r.id as string,
    lotId: r.lot_id as string,
    bidderId: r.bidder_id as string,
    amountMinor: num(r.amount_minor),
    maxAmountMinor: opt<number>(r.max_amount_minor),
    isMaxBid: Boolean(r.is_max_bid),
    status: r.status as Bid["status"],
    placedAt: r.placed_at as string,
    bidderName: opt(r.bidder_name),
  }));
}

// ─── Cart ───────────────────────────────────────────────────────────────────

export async function getCartByToken(token: string): Promise<Cart | null> {
  const rows = (await db`
    SELECT * FROM cart WHERE token = ${token} LIMIT 1
  `) as unknown as Row[];
  if (!rows[0]) return null;

  const r = rows[0];
  const cart: Cart = {
    id: r.id as string,
    token: r.token as string,
    userId: opt(r.user_id),
    currency: r.currency as Cart["currency"],
    expiresAt: opt(r.expires_at),
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };

  const lineRows = (await db`
    SELECT
      cl.*,
      a.id AS art_id, a.title AS art_title, a.slug AS art_slug, a.org_id AS art_org_id,
      a.artist_user_id AS art_artist_user_id, a.kind AS art_kind, a.status AS art_status,
      pm.url AS primary_image_url,
      pm.alt AS primary_image_alt,
      av.label AS variant_label
    FROM cart_line cl
    JOIN artwork_variant av ON av.id = cl.artwork_variant_id
    JOIN artwork a ON a.id = av.artwork_id
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    WHERE cl.cart_id = ${cart.id}
    ORDER BY cl.created_at ASC
  `) as unknown as Row[];

  const lines: CartLine[] = lineRows.map((lr) => ({
    id: lr.id as string,
    cartId: lr.cart_id as string,
    artworkVariantId: lr.artwork_variant_id as string,
    quantity: num(lr.quantity),
    unitPriceMinor: num(lr.unit_price_minor),
    currency: lr.currency as Cart["currency"],
    notes: opt(lr.notes),
    createdAt: lr.created_at as string,
    artwork: {
      id: lr.art_id as string,
      orgId: lr.art_org_id as string,
      artistUserId: lr.art_artist_user_id as string,
      slug: lr.art_slug as string,
      title: lr.art_title as string,
      kind: lr.art_kind as Artwork["kind"],
      status: lr.art_status as Artwork["status"],
      certificateOfAuthenticity: true,
      metadata: {},
      viewCount: 0,
      createdAt: lr.created_at as string,
      updatedAt: lr.created_at as string,
      primaryImageUrl: opt(lr.primary_image_url),
      primaryImageAlt: opt(lr.primary_image_alt),
    },
  }));

  cart.lines = lines;
  cart.subtotalMinor = lines.reduce(
    (sum, l) => sum + l.unitPriceMinor * l.quantity,
    0
  );
  return cart;
}

// ─── Orders ─────────────────────────────────────────────────────────────────

export async function getOrderById(id: string): Promise<Order | null> {
  const rows = (await db`SELECT * FROM commerce_order WHERE id = ${id} LIMIT 1`) as unknown as Row[];
  if (!rows[0]) return null;
  return mapOrder(rows[0]);
}

export async function listOrders(
  opts: { limit?: number; status?: Order["status"][] } = {}
): Promise<Order[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const status = opts.status ?? null;
  const rows = (await db`
    SELECT * FROM commerce_order
    ${status ? db`WHERE status = ANY(${status})` : db``}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as unknown as Row[];
  return rows.map(mapOrder);
}

/** Orders placed by a specific customer (by users.id), newest first. */
export async function listOrdersForCustomer(
  customerId: string,
  opts: { limit?: number } = {}
): Promise<Order[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const rows = (await db`
    SELECT * FROM commerce_order
    WHERE customer_id = ${customerId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as unknown as Row[];
  return rows.map(mapOrder);
}

function mapOrder(r: Row): Order {
  return {
    id: r.id as string,
    number: r.number as string,
    customerId: opt(r.customer_id),
    customerEmail: r.customer_email as string,
    customerName: opt(r.customer_name),
    status: r.status as Order["status"],
    paymentMethod: r.payment_method as Order["paymentMethod"],
    paymentReference: opt(r.payment_reference),
    paymentInstructions: opt(r.payment_instructions),
    paymentDueAt: opt(r.payment_due_at),
    paymentConfirmedAt: opt(r.payment_confirmed_at),
    paymentConfirmedBy: opt(r.payment_confirmed_by),
    paymentMetadata: (r.payment_metadata as Record<string, unknown>) ?? {},
    subtotalMinor: num(r.subtotal_minor),
    shippingMinor: num(r.shipping_minor),
    taxMinor: num(r.tax_minor),
    totalMinor: num(r.total_minor),
    currency: r.currency as Order["currency"],
    shippingAddress: opt(r.shipping_address),
    billingAddress: opt(r.billing_address),
    notes: opt(r.notes),
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    paidAt: opt(r.paid_at),
    fulfilledAt: opt(r.fulfilled_at),
    cancelledAt: opt(r.cancelled_at),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// FAVOURITES — saved pieces, per user
// ────────────────────────────────────────────────────────────────────────────

/** Whether a user has favourited a given artwork. */
export async function isArtworkFavorited(
  userId: string,
  artworkId: string
): Promise<boolean> {
  const rows = (await db`
    SELECT 1 FROM artwork_favorite
    WHERE user_id = ${userId} AND artwork_id = ${artworkId} LIMIT 1
  `) as unknown as Row[];
  return rows.length > 0;
}

/** How many users have saved a given artwork. */
export async function getArtworkFavoriteCount(artworkId: string): Promise<number> {
  const rows = (await db`
    SELECT COUNT(*)::int AS n FROM artwork_favorite WHERE artwork_id = ${artworkId}
  `) as unknown as Row[];
  return num(rows[0]?.n);
}

/** A user's saved artworks (fully hydrated for grid display), newest first. */
export async function listFavoriteArtworks(
  userId: string,
  opts: { limit?: number } = {}
): Promise<Artwork[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const rows = (await db`
    SELECT
      a.*,
      COALESCE(ap.display_name, u.display_name, u.email) AS artist_name,
      ap.user_id::text AS artist_slug,
      pm.url AS primary_image_url,
      pm.alt AS primary_image_alt
    FROM artwork_favorite f
    JOIN artwork a ON a.id = f.artwork_id
    JOIN users u ON u.id = a.artist_user_id
    LEFT JOIN artist_profiles ap ON ap.user_id = a.artist_user_id
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    WHERE f.user_id = ${userId}
    ORDER BY f.created_at DESC
    LIMIT ${limit}
  `) as unknown as Row[];
  return Promise.all(rows.map((r) => hydrateArtwork(mapArtwork(r))));
}

// ────────────────────────────────────────────────────────────────────────────
// ADMIN OVERVIEW — cross-org operator views (gated by requireAdmin in the app)
// ────────────────────────────────────────────────────────────────────────────

/** Order statuses that represent realised revenue. */
const PAID_STATUSES = [
  "payment_received",
  "paid",
  "fulfilled",
  "completed",
] as const;

export interface AdminStats {
  users: number;
  artists: number;
  pendingApplications: number;
  artworks: number;
  listedArtworks: number;
  orders: number;
  /** Sum of totals for orders in a paid/fulfilled/completed state (minor units). */
  salesMinor: number;
  activeCarts: number;
}

/** Headline counts for the admin dashboard. One round-trip per metric, run in parallel. */
export async function getAdminStats(): Promise<AdminStats> {
  const [
    users,
    artists,
    pending,
    artworks,
    listed,
    orders,
    sales,
    carts,
  ] = await Promise.all([
    db`SELECT COUNT(*)::int AS n FROM users` as Promise<unknown> as Promise<Row[]>,
    db`SELECT COUNT(*)::int AS n FROM marketplace_artists WHERE status = 'active'` as Promise<unknown> as Promise<Row[]>,
    db`SELECT COUNT(*)::int AS n FROM marketplace_artists WHERE status = 'pending'` as Promise<unknown> as Promise<Row[]>,
    db`SELECT COUNT(*)::int AS n FROM artwork` as Promise<unknown> as Promise<Row[]>,
    db`SELECT COUNT(*)::int AS n FROM artwork WHERE status = 'available'` as Promise<unknown> as Promise<Row[]>,
    db`SELECT COUNT(*)::int AS n FROM commerce_order` as Promise<unknown> as Promise<Row[]>,
    db`SELECT COALESCE(SUM(total_minor),0)::bigint AS n FROM commerce_order WHERE status = ANY(${PAID_STATUSES as unknown as string[]})` as Promise<unknown> as Promise<Row[]>,
    db`SELECT COUNT(DISTINCT cl.cart_id)::int AS n FROM cart_line cl` as Promise<unknown> as Promise<Row[]>,
  ]);
  return {
    users: num(users[0]?.n),
    artists: num(artists[0]?.n),
    pendingApplications: num(pending[0]?.n),
    artworks: num(artworks[0]?.n),
    listedArtworks: num(listed[0]?.n),
    orders: num(orders[0]?.n),
    salesMinor: num(sales[0]?.n),
    activeCarts: num(carts[0]?.n),
  };
}

export interface AdminArtworkRow {
  id: string;
  title: string;
  status: Artwork["status"];
  kind: Artwork["kind"];
  artistUserId: string;
  artistName: string | null;
  primaryImageUrl: string | null;
  viewCount: number;
  priceMinor: number | null;
  currency: string | null;
  createdAt: string;
}

/** Every artwork across all artists/statuses — operator inventory view. */
export async function adminListArtworks(
  opts: { limit?: number; status?: Artwork["status"][] } = {}
): Promise<AdminArtworkRow[]> {
  const limit = Math.min(opts.limit ?? 100, 500);
  const status = opts.status ?? null;
  const rows = (await db`
    SELECT
      a.id, a.title, a.status, a.kind, a.artist_user_id, a.view_count, a.created_at,
      COALESCE(ap.display_name, u.display_name, u.email) AS artist_name,
      pm.url AS primary_image_url,
      v.price_minor, v.currency
    FROM artwork a
    JOIN users u ON u.id = a.artist_user_id
    LEFT JOIN artist_profiles ap ON ap.user_id = a.artist_user_id
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    LEFT JOIN LATERAL (
      SELECT price_minor, currency FROM artwork_variant
      WHERE artwork_id = a.id ORDER BY position LIMIT 1
    ) v ON true
    ${status ? db`WHERE a.status = ANY(${status})` : db``}
    ORDER BY a.created_at DESC
    LIMIT ${limit}
  `) as unknown as Row[];
  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    status: r.status as Artwork["status"],
    kind: r.kind as Artwork["kind"],
    artistUserId: r.artist_user_id as string,
    artistName: opt(r.artist_name),
    primaryImageUrl: opt(r.primary_image_url),
    viewCount: num(r.view_count),
    priceMinor: r.price_minor != null ? num(r.price_minor) : null,
    currency: opt(r.currency),
    createdAt: r.created_at as string,
  }));
}

export interface AdminCartRow {
  cartId: string;
  token: string;
  userId: string | null;
  userEmail: string | null;
  itemCount: number;
  subtotalMinor: number;
  currency: string;
  updatedAt: string;
}

/** Carts that currently hold at least one item — "who has things in their cart". */
export async function adminListActiveCarts(
  opts: { limit?: number } = {}
): Promise<AdminCartRow[]> {
  const limit = Math.min(opts.limit ?? 100, 500);
  const rows = (await db`
    SELECT
      c.id, c.token, c.user_id, c.currency, c.updated_at,
      u.email AS user_email,
      COUNT(cl.id)::int AS item_count,
      COALESCE(SUM(cl.unit_price_minor * cl.quantity),0)::bigint AS subtotal_minor
    FROM cart c
    JOIN cart_line cl ON cl.cart_id = c.id
    LEFT JOIN users u ON u.id = c.user_id
    GROUP BY c.id, u.email
    ORDER BY c.updated_at DESC
    LIMIT ${limit}
  `) as unknown as Row[];
  return rows.map((r) => ({
    cartId: r.id as string,
    token: r.token as string,
    userId: opt(r.user_id),
    userEmail: opt(r.user_email),
    itemCount: num(r.item_count),
    subtotalMinor: num(r.subtotal_minor),
    currency: r.currency as string,
    updatedAt: r.updated_at as string,
  }));
}

export interface AdminUserRow {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
  artistStatus: string | null;
  /** True when the user belongs to an org (arts-collective member) or has an
   *  arts-collective artist profile. */
  inCollective: boolean;
}

/**
 * Users who are actually part of the network — i.e. an art-auction marketplace
 * artist/applicant, **or** an arts-collective org member / artist-profile
 * holder. Plain account-only signups are excluded. Newest first.
 */
export async function adminListUsers(
  opts: { limit?: number } = {}
): Promise<AdminUserRow[]> {
  const limit = Math.min(opts.limit ?? 100, 500);
  const rows = (await db`
    SELECT
      u.id, u.email, u.display_name, u.created_at,
      ma.status AS artist_status,
      (
        EXISTS (SELECT 1 FROM user_organizations uo WHERE uo.user_id = u.id)
        OR EXISTS (SELECT 1 FROM artist_profiles ap WHERE ap.user_id = u.id)
      ) AS in_collective
    FROM users u
    LEFT JOIN marketplace_artists ma ON ma.user_id = u.id
    WHERE ma.user_id IS NOT NULL
      OR EXISTS (SELECT 1 FROM user_organizations uo WHERE uo.user_id = u.id)
      OR EXISTS (SELECT 1 FROM artist_profiles ap WHERE ap.user_id = u.id)
    ORDER BY u.created_at DESC
    LIMIT ${limit}
  `) as unknown as Row[];
  return rows.map((r) => ({
    id: r.id as string,
    email: opt(r.email),
    displayName: opt(r.display_name),
    createdAt: r.created_at as string,
    artistStatus: opt(r.artist_status),
    inCollective: Boolean(r.in_collective),
  }));
}

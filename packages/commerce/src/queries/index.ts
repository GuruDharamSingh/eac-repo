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

export async function listMarketplaceArtists(
  opts: { limit?: number } = {}
): Promise<MarketplaceArtist[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const rows = (await db`
    SELECT
      ma.*,
      COALESCE(ap.display_name, u.display_name, u.email) AS display_name,
      ap.city,
      ap.photo_url,
      ap.user_id::text AS slug
    FROM marketplace_artists ma
    JOIN users u ON u.id = ma.user_id
    LEFT JOIN artist_profiles ap ON ap.user_id = ma.user_id
    WHERE ma.status = 'active'
    ORDER BY ma.joined_at DESC
    LIMIT ${limit}
  `) as unknown as Row[];

  return rows.map((r) => ({
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
    displayName: opt(r.display_name),
    city: opt(r.city),
    photoUrl: opt(r.photo_url),
    slug: opt(r.slug),
  }));
}

export async function getMarketplaceArtist(userId: string): Promise<MarketplaceArtist | null> {
  const rows = (await db`
    SELECT
      ma.*,
      COALESCE(ap.display_name, u.display_name, u.email) AS display_name,
      ap.city, ap.photo_url, ap.user_id::text AS slug
    FROM marketplace_artists ma
    JOIN users u ON u.id = ma.user_id
    LEFT JOIN artist_profiles ap ON ap.user_id = ma.user_id
    WHERE ma.user_id = ${userId}
    LIMIT 1
  `) as unknown as Row[];

  if (!rows[0]) return null;
  const r = rows[0];
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
    displayName: opt(r.display_name),
    city: opt(r.city),
    photoUrl: opt(r.photo_url),
    slug: opt(r.slug),
  };
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

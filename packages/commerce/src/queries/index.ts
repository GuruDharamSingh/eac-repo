/**
 * Server-side data queries for the commerce + auction domain.
 *
 * All queries respect tenancy by JOINing through `store` (status='active')
 * instead of filtering on a single org_id — this is the "aggregate across
 * orgs" tenancy chosen for Art-Auction.
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
  Order,
  OrderLine,
  Store,
  StoreLink,
  StoreMember,
  StoreOwnerKind,
} from "../types";

type Row = Record<string, unknown>;

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const opt = <T>(v: unknown): T | null => (v == null ? null : (v as T));

function mapArtwork(r: Row): Artwork {
  return {
    id: r.id as string,
    orgId: r.org_id as string,
    storeId: r.store_id as string,
    artistUserId: opt(r.artist_user_id),
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

/**
 * How an artwork is credited on a card or a detail page.
 *
 * The maker when there is one, falling back to the store selling it — an org
 * store may sell unattributed work, and a card with no name at all reads as a
 * bug rather than as a collective piece. The slug follows the same rule so the
 * credit always links somewhere that resolves: `getStoreByHandle` accepts a
 * person's slug, an org's slug, and a raw id.
 *
 * Expects `a` (artwork), `u` (LEFT JOIN users on a.artist_user_id), `sa`
 * (JOIN store on a.store_id) and `oa` (LEFT JOIN organizations on
 * sa.owner_org_id) in scope.
 */
const ARTWORK_CREDIT_SELECT = db`
  COALESCE(u.display_name, u.email, oa.name) AS artist_name,
  COALESCE(u.slug, u.id::text, oa.slug, sa.id::text) AS artist_slug
`;

const ARTWORK_CREDIT_JOIN = db`
  JOIN store sa ON sa.id = a.store_id
  LEFT JOIN organizations oa ON oa.id = sa.owner_org_id
`;

// ─── Artwork browse ─────────────────────────────────────────────────────────

export interface ListArtworksOptions {
  limit?: number;
  offset?: number;
  status?: Artwork["status"][];
  /** The selling store. The only way to reach an org store's work, which has
   *  no artist user id to filter on. */
  storeId?: string;
  /** The maker. Null for unattributed work sold by an org store. */
  artistUserId?: string;
  orgId?: string;
  kind?: Artwork["kind"];
  q?: string;
  /**
   * Browse order. `price_asc`/`price_desc` sort on the cheapest variant, and
   * put unpriced ("price on request") work last either way — a piece with no
   * price is not the cheapest thing in the shop, it is simply not for sale at
   * a number.
   */
  sort?: "newest" | "oldest" | "price_asc" | "price_desc" | "popular";
  /** Only pieces with a real price — i.e. things a visitor can actually buy. */
  pricedOnly?: boolean;
}

/** SQL for {@link ListArtworksOptions.sort}. `pv` must be in scope. */
function artworkOrder(sort: ListArtworksOptions["sort"]) {
  switch (sort) {
    case "oldest":
      return db`a.created_at ASC`;
    case "price_asc":
      return db`(pv.price_minor IS NULL OR pv.price_minor = 0), pv.price_minor ASC, a.created_at DESC`;
    case "price_desc":
      return db`(pv.price_minor IS NULL OR pv.price_minor = 0), pv.price_minor DESC, a.created_at DESC`;
    case "popular":
      return db`a.view_count DESC, a.created_at DESC`;
    default:
      return db`a.created_at DESC`;
  }
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
      COALESCE(u.display_name, u.email, o.name) AS artist_name,
      COALESCE(u.slug, u.id::text, o.slug, s.id::text) AS artist_slug,
      pm.url AS primary_image_url,
      pm.alt AS primary_image_alt
    FROM artwork a
    JOIN store s ON s.id = a.store_id AND s.status = 'active'
    LEFT JOIN organizations o ON o.id = s.owner_org_id
    LEFT JOIN users u ON u.id = a.artist_user_id
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    LEFT JOIN LATERAL (
      SELECT price_minor FROM artwork_variant av
      WHERE av.artwork_id = a.id AND av.price_minor > 0
      ORDER BY av.price_minor ASC LIMIT 1
    ) pv ON TRUE
    WHERE a.status = ANY(${statusList})
      ${opts.storeId ? db`AND a.store_id = ${opts.storeId}` : db``}
      ${opts.artistUserId ? db`AND a.artist_user_id = ${opts.artistUserId}` : db``}
      ${opts.orgId ? db`AND a.org_id = ${opts.orgId}` : db``}
      ${opts.kind ? db`AND a.kind = ${opts.kind}` : db``}
      ${opts.pricedOnly ? db`AND pv.price_minor IS NOT NULL` : db``}
      ${opts.q ? db`AND (a.title ILIKE ${"%" + opts.q + "%"} OR a.subject ILIKE ${"%" + opts.q + "%"})` : db``}
    ORDER BY ${artworkOrder(opts.sort)}
    LIMIT ${limit} OFFSET ${offset}
  `) as unknown as Row[];

  return attachPricing(rows.map(mapArtwork));
}

/**
 * What a store's FRONT shows: the pieces it sells, plus the pieces it presents
 * for other stores (migration 112), newest first. Presented pieces carry
 * `presentedByStoreId` so a page can build `?via=` links, and are credited to
 * their own maker/store as anywhere else.
 */
export async function listStoreFrontArtworks(
  storeId: string,
  opts: { limit?: number; status?: Artwork["status"][] } = {}
): Promise<Artwork[]> {
  const limit = Math.min(opts.limit ?? 60, 200);
  const statusList = opts.status ?? ["available", "reserved", "sold"];
  const rows = (await db`
    SELECT
      a.*,
      COALESCE(u.display_name, u.email, o.name) AS artist_name,
      COALESCE(u.slug, u.id::text, o.slug, s.id::text) AS artist_slug,
      pm.url AS primary_image_url,
      pm.alt AS primary_image_alt,
      sp.store_id AS presented_by_store_id,
      COALESCE(sp.added_at, a.created_at) AS shown_at
    FROM artwork a
    JOIN store s ON s.id = a.store_id AND s.status = 'active'
    LEFT JOIN store_presentation sp ON sp.artwork_id = a.id AND sp.store_id = ${storeId}
    LEFT JOIN organizations o ON o.id = s.owner_org_id
    LEFT JOIN users u ON u.id = a.artist_user_id
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    WHERE a.status = ANY(${statusList})
      AND (a.store_id = ${storeId} OR sp.store_id IS NOT NULL)
    ORDER BY shown_at DESC
    LIMIT ${limit}
  `) as unknown as Row[];
  return attachPricing(
    rows.map((r) => ({
      ...mapArtwork(r),
      presentedByStoreId: opt<string>(r.presented_by_store_id),
    }))
  );
}

/** Only the pieces a store presents for others — the studio's list. */
export async function listPresentedArtworks(storeId: string): Promise<Artwork[]> {
  const rows = (await db`
    SELECT a.*, pm.url AS primary_image_url, pm.alt AS primary_image_alt,
      COALESCE(u.display_name, u.email, o.name) AS artist_name,
      COALESCE(u.slug, u.id::text, o.slug, s.id::text) AS artist_slug,
      sp.store_id AS presented_by_store_id
    FROM store_presentation sp
    JOIN artwork a ON a.id = sp.artwork_id
    JOIN store s ON s.id = a.store_id
    LEFT JOIN organizations o ON o.id = s.owner_org_id
    LEFT JOIN users u ON u.id = a.artist_user_id
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    WHERE sp.store_id = ${storeId}
    ORDER BY sp.added_at DESC
  `) as unknown as Row[];
  return attachPricing(
    rows.map((r) => ({ ...mapArtwork(r), presentedByStoreId: opt<string>(r.presented_by_store_id) }))
  );
}

/**
 * Attach the cheapest variant and any open lot to a list of artworks, in two
 * queries rather than two per row.
 *
 * Every list query used to return artworks with neither, while the card that
 * renders them reads `artwork.variants[0]` for the price and `artwork.lot` for
 * the auction state. The result was a marketplace whose browse grid, artist
 * pages and embedded store showcases said "Price on request" for absolutely
 * everything and never once showed that a piece was at auction — the price is
 * the whole reason those grids exist, and it was never on them.
 *
 * Only the lowest-priced variant is needed: that is what the card shows as
 * "from", and the detail page hydrates the rest anyway.
 */
async function attachPricing(artworks: Artwork[]): Promise<Artwork[]> {
  if (artworks.length === 0) return artworks;
  const ids = artworks.map((a) => a.id);

  const [variantRows, lotRows] = await Promise.all([
    db`
      SELECT DISTINCT ON (artwork_id) *
      FROM artwork_variant
      WHERE artwork_id = ANY(${ids}::uuid[])
      ORDER BY artwork_id, price_minor ASC, position ASC
    ` as Promise<unknown> as Promise<Row[]>,
    db`
      SELECT DISTINCT ON (av.artwork_id) av.artwork_id, al.*
      FROM auction_lot al
      JOIN artwork_variant av ON av.id = al.artwork_variant_id
      WHERE av.artwork_id = ANY(${ids}::uuid[])
        AND al.status IN ('scheduled', 'live')
      ORDER BY av.artwork_id, al.end_at ASC
    ` as Promise<unknown> as Promise<Row[]>,
  ]);

  const variantById = new Map(variantRows.map((r) => [r.artwork_id as string, mapVariant(r)]));
  const lotById = new Map(lotRows.map((r) => [r.artwork_id as string, mapLot(r)]));

  for (const a of artworks) {
    const v = variantById.get(a.id);
    a.variants = v ? [v] : [];
    a.lot = lotById.get(a.id) ?? null;
  }
  return artworks;
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
      ${ARTWORK_CREDIT_SELECT},
      pm.url AS primary_image_url,
      pm.alt AS primary_image_alt
    FROM artwork a
    ${ARTWORK_CREDIT_JOIN}
    LEFT JOIN users u ON u.id = a.artist_user_id
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    WHERE a.org_id = ${orgId} AND a.slug = ${slug}
    LIMIT 1
  `) as unknown as Row[];
  if (!rows[0]) return null;
  return hydrateArtwork(mapArtwork(rows[0]));
}

/**
 * One artwork by id, for the public detail page.
 *
 * Draft and archived work, and work whose store is not trading, are NOT
 * returned. Every list query already joins `store s ... AND s.status =
 * 'active'` and filters on artwork status; this one did neither, so a
 * rejected applicant's listings and a seller's unpublished drafts were
 * publicly readable at their own URL with images, price and provenance.
 *
 * Pass `includeUnlisted` from a surface that has already established the
 * viewer may see it — a studio preview, an admin screen.
 */
export async function getArtworkById(
  id: string,
  opts: { includeUnlisted?: boolean } = {}
): Promise<Artwork | null> {
  const rows = (await db`
    SELECT
      a.*,
      ${ARTWORK_CREDIT_SELECT},
      pm.url AS primary_image_url,
      pm.alt AS primary_image_alt
    FROM artwork a
    ${ARTWORK_CREDIT_JOIN}
    LEFT JOIN users u ON u.id = a.artist_user_id
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    WHERE a.id = ${id}
      ${opts.includeUnlisted
        ? db``
        : db`AND sa.status = 'active' AND a.status IN ('available','reserved','sold')`}
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

function parseArtistLinks(v: unknown): StoreLink[] {
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
 * Map a `store` row to the domain type. Display fields prefer the deprecated
 * self-contained columns (migration 054) and fall back to the owner’s real
 * identity on `users` / `organizations`.
 */
function mapStore(r: Row): Store {
  const ownerKind = r.owner_kind as StoreOwnerKind;
  return {
    id: r.id as string,
    orgId: r.org_id as string,
    ownerKind,
    ownerUserId: opt(r.owner_user_id),
    ownerOrgId: opt(r.owner_org_id),
    payoutEmail: opt<string>(r.owner_payout_email) ?? opt<string>(r.payout_email),
    payoutMethod:
      (opt<Store["payoutMethod"]>(r.owner_payout_method) ??
        (r.payout_method as Store["payoutMethod"])),
    ownerCanReceiveDestinationCharge:
      Boolean(r.owner_stripe_account_id) && Boolean(r.owner_stripe_onboarded_at),
    commissionRate: Number(r.commission_rate),
    defaultCurrency: r.default_currency as Store["defaultCurrency"],
    status: r.status as Store["status"],
    bioHtml: opt(r.bio_html),
    joinedAt: r.joined_at as string,
    updatedAt: r.updated_at as string,


    // Identity is the owner's (users / organizations). The store's own copies
    // are deprecated (092) and no longer written; they only fill a gap.
    displayName:
      (opt<string>(r.fallback_display_name) ??
        opt<string>(r.fallback_owner_name) ??
        opt<string>(r.display_name)) ||
      null,
    headline: opt<string>(r.fallback_headline) ?? opt<string>(r.headline) ?? null,
    city: opt<string>(r.fallback_city) ?? opt<string>(r.city) ?? null,
    photoUrl: opt<string>(r.fallback_photo_url) ?? opt<string>(r.photo_url) ?? null,
    links: parseArtistLinks(r.links),
    appliedAt: opt(r.applied_at),
    reviewedAt: opt(r.reviewed_at),
    reviewedBy: opt(r.reviewed_by),
    rejectionReason: opt(r.rejection_reason),
    slug: opt(r.slug),
  };
}

/**
 * Identity for a store, read from its owner — `users` for a person’s store
 * (the home migration 084 gave identity), `organizations` for an org’s.
 *
 * Both joins must be LEFT: exactly one of them matches per row, and an INNER
 * join to `users` — which is what this was before migration 094 — would drop
 * every org-owned store from every listing.
 *
 * The slug was `ma.user_id::text`, which put a raw UUID in store URLs while
 * users.slug already existed and ArtDirect already used it. Falls back to the
 * owner's id when they have no slug, so no store becomes unreachable.
 */
const STORE_OWNER_JOIN = db`
  LEFT JOIN users u ON u.id = s.owner_user_id
  LEFT JOIN organizations o ON o.id = s.owner_org_id
`;

const STORE_OWNER_SELECT = db`
  -- Payout identity is the owner's, not the front's (migration 096). Surfaced
  -- here so a studio screen can show "you are paid at…" without every caller
  -- having to fetch the person separately. An org-owned front has none: an
  -- org's money is earmarked in the host account, never sent.
  u.payout_email AS owner_payout_email,
  u.payout_method AS owner_payout_method,
  u.stripe_account_id AS owner_stripe_account_id,
  u.stripe_onboarded_at AS owner_stripe_onboarded_at,
  COALESCE(u.display_name, o.name) AS fallback_display_name,
  COALESCE(u.display_name, o.name, u.email) AS fallback_owner_name,
  u.headline AS fallback_headline,
  u.city AS fallback_city,
  u.avatar_url AS fallback_photo_url,
  -- Falls back to something the *owner's* own route can still resolve: the
  -- artist page looks a person up by user id, so dropping to the store id
  -- here would 404 every seller who has not set a slug. organizations.slug is
  -- NOT NULL, so an org store never reaches the last fallback.
  COALESCE(u.slug, o.slug, s.owner_user_id::text, s.id::text) AS slug
`;

export async function listStores(
  opts: { limit?: number; orgId?: string; status?: Store["status"][] } = {}
): Promise<Store[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const status = opts.status ?? ["active"];
  const rows = (await db`
    SELECT s.*, ${STORE_OWNER_SELECT}
    FROM store s
    ${STORE_OWNER_JOIN}
    WHERE s.status = ANY(${status})
      ${opts.orgId ? db`AND s.org_id = ${opts.orgId}` : db``}
    ORDER BY s.joined_at DESC
    LIMIT ${limit}
  `) as unknown as Row[];

  return rows.map(mapStore);
}

/** A store by its own id, whatever its owner kind or status. */
export async function getStore(storeId: string): Promise<Store | null> {
  const rows = (await db`
    SELECT s.*, ${STORE_OWNER_SELECT}
    FROM store s
    ${STORE_OWNER_JOIN}
    WHERE s.id = ${storeId}
    LIMIT 1
  `) as unknown as Row[];
  if (!rows[0]) return null;
  return mapStore(rows[0]);
}

/**
 * A person’s store, regardless of status (the studio shows pending and
 * rejected applicants their own record).
 *
 * `orgId` is optional only because one marketplace (`market`) currently
 * exists. A person may hold one store per marketplace, so once a second
 * exists this call is ambiguous without it — hence the deterministic
 * ordering rather than an arbitrary LIMIT 1.
 */
export async function getStoreForUser(
  userId: string,
  orgId?: string
): Promise<Store | null> {
  const rows = (await db`
    SELECT s.*, ${STORE_OWNER_SELECT}
    FROM store s
    ${STORE_OWNER_JOIN}
    WHERE s.owner_user_id = ${userId}
      ${orgId ? db`AND s.org_id = ${orgId}` : db``}
    ORDER BY s.joined_at ASC
    LIMIT 1
  `) as unknown as Row[];

  if (!rows[0]) return null;
  return mapStore(rows[0]);
}

/**
 * A store addressed the way the public URLs address it: by the owner’s slug,
 * falling back to their raw id.
 *
 * This exists because the two halves disagreed. Artwork cards link to
 * `/artists/${artistSlug}` — `COALESCE(u.slug, u.id::text)` — while the artist
 * page resolved its param as a user id only. Once profile unification (084)
 * started giving people slugs, every artwork card on the marketplace pointed
 * at a page that threw: the slug reached Postgres as a uuid comparison, so it
 * was a 500 rather than even a 404.
 *
 * Matches an org’s slug or id too, so an org-owned store is reachable by the
 * same route rather than needing a parallel one.
 */
export async function getStoreByHandle(
  handle: string,
  orgId?: string
): Promise<Store | null> {
  // Only compare against the uuid columns when the handle could actually be
  // one — `owner_user_id = 'steph-wrede'` is a cast error, not a non-match.
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(handle);

  const rows = (await db`
    SELECT s.*, ${STORE_OWNER_SELECT}
    FROM store s
    ${STORE_OWNER_JOIN}
    WHERE (
      u.slug = ${handle}
      OR o.slug = ${handle}
      OR s.owner_org_id = ${handle}
      ${isUuid ? db`OR s.owner_user_id = ${handle}::uuid OR s.id = ${handle}::uuid` : db``}
    )
      ${orgId ? db`AND s.org_id = ${orgId}` : db``}
    ORDER BY s.joined_at ASC
    LIMIT 1
  `) as unknown as Row[];
  if (!rows[0]) return null;
  return mapStore(rows[0]);
}

/** An organization’s store in a given marketplace (defaults to its own). */
export async function getStoreForOrg(
  ownerOrgId: string,
  orgId?: string
): Promise<Store | null> {
  const rows = (await db`
    SELECT s.*, ${STORE_OWNER_SELECT}
    FROM store s
    ${STORE_OWNER_JOIN}
    WHERE s.owner_org_id = ${ownerOrgId}
      AND s.org_id = ${orgId ?? ownerOrgId}
    LIMIT 1
  `) as unknown as Row[];
  if (!rows[0]) return null;
  return mapStore(rows[0]);
}

/**
 * Who to talk to about a piece.
 *
 * The maker when there is one; otherwise whoever runs the store selling it —
 * its owner, or its longest-standing owner-role member. An org store's
 * unattributed work has no maker at all, so "ask the artist" needs a person to
 * address or it opens a conversation with nobody.
 */
export async function getArtworkContactUserId(
  artworkId: string
): Promise<string | null> {
  const rows = (await db`
    SELECT COALESCE(
      a.artist_user_id,
      s.owner_user_id,
      (
        SELECT sm.user_id FROM store_member sm
        WHERE sm.store_id = s.id
        ORDER BY CASE sm.role WHEN 'owner' THEN 0 ELSE 1 END, sm.added_at ASC
        LIMIT 1
      )
    ) AS contact_user_id
    FROM artwork a
    JOIN store s ON s.id = a.store_id
    WHERE a.id = ${artworkId}
    LIMIT 1
  `) as unknown as Row[];
  return opt(rows[0]?.contact_user_id);
}

/** Everyone with authority over a store, owner first. */
export async function listStoreMembers(storeId: string): Promise<StoreMember[]> {
  const rows = (await db`
    SELECT sm.*, u.display_name, u.email
    FROM store_member sm
    JOIN users u ON u.id = sm.user_id
    WHERE sm.store_id = ${storeId}
    ORDER BY
      CASE sm.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END,
      sm.added_at ASC
  `) as unknown as Row[];
  return rows.map((r) => ({
    storeId: r.store_id as string,
    userId: r.user_id as string,
    role: r.role as StoreMember["role"],
    addedAt: r.added_at as string,
    addedBy: opt(r.added_by),
    displayName: opt(r.display_name),
    email: opt(r.email),
  }));
}

export interface StoreShowcase {
  store: Store;
  /** Listed pieces, newest first. */
  artworks: Artwork[];
}

/**
 * What another site shows about a person's store: the active store plus its
 * listed work. This is the read an org site (amrit-canada, IFAC, an artist
 * subdomain) makes when the person has switched the "store" section on for
 * their profile there — `users.profile_sections.store` (migration 105). Null
 * when they have no active store, so the section simply does not render.
 */
export async function getStoreShowcaseForUser(
  userId: string,
  opts: { limit?: number; orgId?: string } = {}
): Promise<StoreShowcase | null> {
  const store = await getStoreForUser(userId, opts.orgId);
  if (!store || store.status !== "active") return null;
  const artworks = await listArtworks({
    storeId: store.id,
    status: ["available", "reserved"],
    limit: opts.limit ?? 8,
  });
  return { store, artworks };
}

/** Whether a person has switched a profile section on (users.profile_sections). */
export async function hasProfileSection(userId: string, key: string): Promise<boolean> {
  try {
    const [row] = (await db`
      SELECT COALESCE((profile_sections->>${key})::boolean, false) AS on
      FROM users WHERE id = ${userId}
    `) as unknown as Row[];
    return Boolean(row?.on);
  } catch (err) {
    console.error(`[commerce] hasProfileSection(${userId}, ${key}):`, err);
    return false;
  }
}

/** A store together with the role the asking person holds in it. */
export type ActableStore = Store & { myRole: StoreMember["role"] };

/**
 * Every store a person may act for: their own, plus any org store they are
 * on the member roll of. Own store first, then by age. This is what a studio
 * lists in its store switcher.
 */
export async function listStoresForUser(userId: string): Promise<ActableStore[]> {
  const rows = (await db`
    SELECT s.*, ${STORE_OWNER_SELECT},
      CASE WHEN s.owner_user_id = ${userId} THEN 'owner' ELSE sm.role END AS my_role
    FROM store s
    ${STORE_OWNER_JOIN}
    LEFT JOIN store_member sm ON sm.store_id = s.id AND sm.user_id = ${userId}
    WHERE s.owner_user_id = ${userId} OR sm.user_id IS NOT NULL
    ORDER BY (s.owner_user_id = ${userId}) DESC, s.joined_at ASC
  `) as unknown as Row[];
  return rows.map((r) => ({ ...mapStore(r), myRole: r.my_role as StoreMember["role"] }));
}

export interface OpenableOrg {
  orgId: string;
  name: string;
  slug: string;
  /** Whether a store already exists for this org in the given marketplace. */
  storeId: string | null;
}

/**
 * Organisations this person OWNS (the role that may open an org store),
 * with whether each already has a store in the marketplace. Excludes the
 * marketplace org itself and any org whose own `users` row is the only
 * "owner" — a listing cannot vouch for itself.
 */
export async function listOrgsUserCanOpenStoreFor(
  userId: string,
  marketplaceOrgId: string
): Promise<OpenableOrg[]> {
  const rows = (await db`
    SELECT o.id, o.name, o.slug, s.id AS store_id
    FROM user_organizations uo
    JOIN organizations o ON o.id = uo.org_id
    JOIN users u ON u.id = uo.user_id
    LEFT JOIN store s ON s.owner_org_id = o.id AND s.org_id = ${marketplaceOrgId}
    WHERE uo.user_id = ${userId}
      AND uo.role = 'owner'
      AND COALESCE(u.entity_type, 'person') = 'person'
      AND o.id <> ${marketplaceOrgId}
    ORDER BY o.name ASC
  `) as unknown as Row[];
  return rows.map((r) => ({
    orgId: r.id as string,
    name: r.name as string,
    slug: r.slug as string,
    storeId: opt(r.store_id),
  }));
}

/** @deprecated Use {@link listStores}. */
export const listMarketplaceArtists = listStores;
/** @deprecated Use {@link getStoreForUser}. */
export const getMarketplaceArtist = getStoreForUser;

/**
 * All artwork a store sells, any status — for the studio dashboard.
 *
 * Priced, so a seller's own list can show what each piece is listed at. The
 * studio had no prices on it either, which meant the one screen whose job is
 * to manage prices was the one screen that never displayed them.
 */
export async function listStoreArtworks(storeId: string): Promise<Artwork[]> {
  const rows = (await db`
    SELECT a.*, pm.url AS primary_image_url, pm.alt AS primary_image_alt
    FROM artwork a
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    WHERE a.store_id = ${storeId}
    ORDER BY a.created_at DESC
  `) as unknown as Row[];
  return attachPricing(rows.map(mapArtwork));
}

/** @deprecated Use {@link listStoreArtworks} — a person may hold several stores. */
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
  actorUserId: string
): Promise<Artwork | null> {
  // Access is through the store that sells it — its owner or its member roll
  // — not through `artist_user_id`, which an org store's work may not have.
  const rows = (await db`
    SELECT a.* FROM artwork a
    JOIN store s ON s.id = a.store_id
    LEFT JOIN store_member sm ON sm.store_id = s.id AND sm.user_id = ${actorUserId}
    WHERE a.id = ${artworkId}
      AND (s.owner_user_id = ${actorUserId} OR sm.user_id IS NOT NULL)
    LIMIT 1
  `) as unknown as Row[];
  if (!rows[0]) return null;
  return hydrateArtwork(mapArtwork(rows[0]));
}

/** Pending store applications, oldest first — for the admin review queue. */
export async function listPendingStoreApplications(): Promise<Store[]> {
  const rows = (await db`
    SELECT s.*, ${STORE_OWNER_SELECT}
    FROM store s
    ${STORE_OWNER_JOIN}
    WHERE s.status = 'pending'
    ORDER BY s.applied_at ASC
  `) as unknown as Row[];
  return rows.map(mapStore);
}

/** @deprecated Use {@link listPendingStoreApplications}. */
export const listPendingArtistApplications = listPendingStoreApplications;

// ─── Auction lots ───────────────────────────────────────────────────────────

export async function listLiveLots(opts: { limit?: number } = {}): Promise<AuctionLot[]> {
  const limit = Math.min(opts.limit ?? 12, 50);
  const rows = (await db`
    SELECT
      al.*,
      a.id  AS art_id, a.title AS art_title, a.slug AS art_slug,
      a.org_id AS art_org_id, a.artist_user_id AS art_artist_user_id, a.store_id AS art_store_id,
      a.kind AS art_kind, a.status AS art_status,
      pm.url AS primary_image_url,
      pm.alt AS primary_image_alt,
      COALESCE(u.display_name, u.email, o.name) AS artist_name
    FROM auction_lot al
    JOIN artwork_variant av ON av.id = al.artwork_variant_id
    JOIN artwork a ON a.id = av.artwork_id
    JOIN store s ON s.id = a.store_id AND s.status = 'active'
    LEFT JOIN organizations o ON o.id = s.owner_org_id
    LEFT JOIN users u ON u.id = a.artist_user_id
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
      storeId: r.art_store_id as string,
      artistUserId: opt(r.art_artist_user_id),
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
      a.org_id AS art_org_id, a.artist_user_id AS art_artist_user_id, a.store_id AS art_store_id,
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
      storeId: r.art_store_id as string,
      artistUserId: opt(r.art_artist_user_id),
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
 * Every lot on a store's work (any status), newest-ending first. The studio
 * form — a store may sell work by several makers, or by none, so this is
 * keyed on the store rather than on `artist_user_id`.
 */
export async function listLotsForStore(
  storeId: string,
  opts: { limit?: number } = {}
): Promise<AuctionLot[]> {
  const limit = Math.min(opts.limit ?? 25, 100);
  const rows = (await db`
    SELECT
      al.*,
      a.id AS art_id, a.title AS art_title, a.slug AS art_slug,
      a.org_id AS art_org_id, a.artist_user_id AS art_artist_user_id, a.store_id AS art_store_id,
      a.kind AS art_kind, a.status AS art_status,
      pm.url AS primary_image_url, pm.alt AS primary_image_alt
    FROM auction_lot al
    JOIN artwork_variant av ON av.id = al.artwork_variant_id
    JOIN artwork a ON a.id = av.artwork_id
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    WHERE a.store_id = ${storeId}
    ORDER BY al.end_at DESC
    LIMIT ${limit}
  `) as unknown as Row[];

  return rows.map((r) => {
    const lot = mapLot(r);
    lot.artwork = {
      id: r.art_id as string,
      orgId: r.art_org_id as string,
      storeId: r.art_store_id as string,
      artistUserId: opt(r.art_artist_user_id),
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

/** The open (scheduled or live) lot on an artwork, if any. */
export async function getOpenLotForArtwork(artworkId: string): Promise<AuctionLot | null> {
  const rows = (await db`
    SELECT al.*
    FROM auction_lot al
    JOIN artwork_variant av ON av.id = al.artwork_variant_id
    WHERE av.artwork_id = ${artworkId}
      AND al.status IN ('scheduled', 'live')
    ORDER BY al.end_at ASC
    LIMIT 1
  `) as unknown as Row[];
  if (!rows[0]) return null;
  return mapLot(rows[0]);
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
      a.artist_user_id AS art_artist_user_id, a.store_id AS art_store_id, a.kind AS art_kind, a.status AS art_status,
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
    viaStoreId: opt(lr.via_store_id),
    createdAt: lr.created_at as string,
    artwork: {
      id: lr.art_id as string,
      orgId: lr.art_org_id as string,
      storeId: lr.art_store_id as string,
      artistUserId: opt(lr.art_artist_user_id),
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

/**
 * Orders that include at least one line for the given org, newest first.
 * Used by an org's own /manage/orders — a service order has exactly one
 * line, but this stays correct if an order ever spans orgs.
 */
export async function listOrdersForOrg(
  orgId: string,
  opts: { limit?: number; status?: Order["status"][] } = {}
): Promise<Order[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const status = opts.status ?? null;
  const rows = (await db`
    SELECT DISTINCT o.*
    FROM commerce_order o
    JOIN commerce_order_line l ON l.order_id = o.id
    WHERE l.org_id = ${orgId}
      ${status ? db`AND o.status = ANY(${status})` : db``}
    ORDER BY o.created_at DESC
    LIMIT ${limit}
  `) as unknown as Row[];
  return rows.map(mapOrder);
}

/**
 * Orders placed through a store, newest first — the seller's sales list.
 * `store_id` is the front the order was presented through (migration 095),
 * so an org store sees sales of every maker it presents.
 */
export async function listOrdersForStore(
  storeId: string,
  opts: { limit?: number; status?: Order["status"][] } = {}
): Promise<Order[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const status = opts.status ?? null;
  const rows = (await db`
    SELECT * FROM commerce_order
    WHERE store_id = ${storeId}
      ${status ? db`AND status = ANY(${status})` : db``}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as unknown as Row[];
  return rows.map(mapOrder);
}

/** Line items for an order, in insertion order, with the artwork's image. */
export async function getOrderLines(orderId: string): Promise<OrderLine[]> {
  const rows = (await db`
    SELECT l.*, pm.url AS image_url
    FROM commerce_order_line l
    LEFT JOIN artwork a ON a.id = l.artwork_id
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    WHERE l.order_id = ${orderId}
    ORDER BY l.created_at
  `) as unknown as Row[];
  return rows.map(mapOrderLine);
}

function mapOrderLine(r: Row): OrderLine {
  return {
    imageUrl: opt(r.image_url),
    id: r.id as string,
    orderId: r.order_id as string,
    artworkVariantId: opt(r.artwork_variant_id),
    artworkId: opt(r.artwork_id),
    threadId: opt(r.thread_id),
    artistUserId: opt(r.artist_user_id),
    orgId: opt(r.org_id),
    description: r.description as string,
    quantity: num(r.quantity),
    unitPriceMinor: num(r.unit_price_minor),
    artistShareMinor: opt(r.artist_share_minor),
    galleryShareMinor: opt(r.gallery_share_minor),
    currency: r.currency as OrderLine["currency"],
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: r.created_at as string,
  };
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
    storeId: opt(r.store_id),
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
      ${ARTWORK_CREDIT_SELECT},
      pm.url AS primary_image_url,
      pm.alt AS primary_image_alt
    FROM artwork_favorite f
    JOIN artwork a ON a.id = f.artwork_id
    ${ARTWORK_CREDIT_JOIN}
    LEFT JOIN users u ON u.id = a.artist_user_id
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
    db`SELECT COUNT(*)::int AS n FROM store WHERE status = 'active'` as Promise<unknown> as Promise<Row[]>,
    db`SELECT COUNT(*)::int AS n FROM store WHERE status = 'pending'` as Promise<unknown> as Promise<Row[]>,
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
  storeId: string;
  /** Null for work an org store sells with no individual attribution. */
  artistUserId: string | null;
  artistName: string | null;
  /** Credit link target: the maker's slug, else the selling store's. */
  artistSlug: string | null;
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
      a.id, a.title, a.status, a.kind, a.store_id, a.artist_user_id, a.view_count, a.created_at,
      ${ARTWORK_CREDIT_SELECT},
      pm.url AS primary_image_url,
      v.price_minor, v.currency
    FROM artwork a
    ${ARTWORK_CREDIT_JOIN}
    LEFT JOIN users u ON u.id = a.artist_user_id
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
    storeId: r.store_id as string,
    artistUserId: opt(r.artist_user_id),
    artistName: opt(r.artist_name),
    artistSlug: opt(r.artist_slug),
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
      st.status AS artist_status,
      (
        EXISTS (SELECT 1 FROM user_organizations uo WHERE uo.user_id = u.id)
        OR EXISTS (SELECT 1 FROM artist_profiles ap WHERE ap.user_id = u.id)
      ) AS in_collective
    FROM users u
    LEFT JOIN store st ON st.owner_user_id = u.id
    WHERE st.owner_user_id IS NOT NULL
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

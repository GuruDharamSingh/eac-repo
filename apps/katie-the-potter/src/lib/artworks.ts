import { db } from "@elkdonis/db";
import { listArtworks, type ListArtworksOptions } from "@elkdonis/commerce/queries";
import type { Artwork } from "@elkdonis/commerce/types";
import { sanitizePageText } from "@elkdonis/utils/sanitize";
import { siteConfig } from "@/config/site";
import { forgetPinnedStore, getPinnedStore } from "@/lib/site-store";
import type { Piece, PieceImage } from "@/blocks/artwork-data";

// ============================================================================
// Katie's pieces, for the blocks that show them. Server only.
//
// Read by STORE: her store lives in the marketplace's org (`market`), not in
// `katie-the-potter`, because that is where the network's checkout and order
// book are. The store is the one pinned for the site (lib/site-store.ts), and
// the listing status decides what is for sale:
//
//   for sale     available / reserved / sold — the marketplace's own public
//                set, shown with a price and a buy / enquire link.
//   portfolio    unlisted there (draft or archived) but marked
//                `metadata.site = "portfolio"`: shown here as a picture only.
//
// The endpoints that wrap this are public, so the WHERE clauses here are the
// whole of the access rule. Anything else unlisted never leaves this file.
//
// Nothing here throws to a page: no owner, no store, or a database error all
// come back as an empty list, and the blocks draw their empty state.
// ============================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUBLIC_STATUSES: Artwork["status"][] = ["available", "reserved", "sold"];

export type PieceSort = NonNullable<ListArtworksOptions["sort"]>;
const SORTS: PieceSort[] = ["newest", "oldest", "price_asc", "price_desc", "popular"];
export const asSort = (v: unknown): PieceSort => (SORTS.includes(v as PieceSort) ? (v as PieceSort) : "newest");

type MediaRow = { artwork_id: string; url: string; alt: string | null };

/** Drop the cached store (after a hand-over). */
export function forgetSiteStore(): void {
  forgetPinnedStore();
}

/**
 * The site's store id when it is open for business, else null. The store is
 * PINNED (lib/site-store.ts, site_config `shop:store`), not looked up through
 * an org owner: fixed 2026-11-06, so the grid keeps showing the store after a
 * hand-over whoever else holds `owner`. Cached a minute there.
 */
export async function getSiteStoreId(): Promise<string | null> {
  const store = await getPinnedStore();
  return store && store.status === "active" ? store.id : null;
}

function dims(a: Artwork): string | null {
  // numeric columns arrive as strings from postgres.js; mapArtwork does not coerce them.
  const parts = [a.heightCm, a.widthCm, a.depthCm].map((v) => (v == null ? NaN : Number(v))).filter((n) => Number.isFinite(n) && n > 0);
  return parts.length ? `${parts.map((n) => (Number.isInteger(n) ? n : n.toFixed(1))).join(" × ")} cm` : null;
}

function edition(a: Artwork): string | null {
  const v = a.variants?.[0];
  if (!v) return null;
  if (v.editionNumber && v.editionTotal) return `${v.editionNumber} / ${v.editionTotal}`;
  if (v.editionTotal) return `Edition of ${v.editionTotal}`;
  return null;
}

function toPiece(a: Artwork, media: PieceImage[], portfolio: boolean): Piece {
  const market = siteConfig.marketUrl.replace(/\/+$/, "");
  const images = media.length ? media : a.primaryImageUrl ? [{ url: a.primaryImageUrl, alt: a.primaryImageAlt ?? "" }] : [];
  const v = a.variants?.[0];
  return {
    id: a.id,
    slug: a.slug || a.id,
    title: a.title,
    year: a.yearCreated ?? null,
    medium: a.medium ?? null,
    dimensions: dims(a),
    kind: a.kind,
    edition: edition(a),
    priceMinor: portfolio ? null : (v?.priceMinor ?? null),
    currency: v?.currency ?? "CAD",
    status: portfolio ? "portfolio" : (a.status as Piece["status"]),
    image: images[0]?.url ?? null,
    images,
    descriptionHtml: a.descriptionHtml ? sanitizePageText(a.descriptionHtml) || null : null,
    href: portfolio ? null : `${market}/artworks/${encodeURIComponent(a.id)}?from=${siteConfig.marketRef}`,
  };
}

/** Every picture of each piece, primary first, then by position. */
async function mediaFor(artworks: Artwork[]): Promise<Map<string, PieceImage[]>> {
  const out = new Map<string, PieceImage[]>();
  if (artworks.length === 0) return out;
  const ids = artworks.map((a) => a.id);
  const primary = new Map(artworks.map((a) => [a.id, a.primaryImageId ?? null]));
  const rows = await db<Array<MediaRow & { id: string; role: string }>>`
    SELECT id, artwork_id, url, alt, role FROM artwork_media
    WHERE artwork_id = ANY(${ids}::uuid[]) AND role <> 'video'
    ORDER BY artwork_id, position, created_at
  `;
  for (const r of rows) {
    const list = out.get(r.artwork_id) ?? [];
    const img = { url: r.url, alt: r.alt ?? "" };
    if (primary.get(r.artwork_id) === r.id) list.unshift(img);
    else list.push(img);
    out.set(r.artwork_id, list);
  }
  return out;
}

/** Pieces unlisted on the marketplace but kept on the site as pictures. */
async function portfolioPieces(storeId: string, limit: number): Promise<Artwork[]> {
  const rows = await db<Array<Record<string, unknown>>>`
    SELECT a.*, pm.url AS primary_image_url, pm.alt AS primary_image_alt
    FROM artwork a
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    WHERE a.store_id = ${storeId}
      AND a.status IN ('draft', 'archived')
      AND a.metadata->>'site' = 'portfolio'
    ORDER BY a.created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id as string,
    orgId: r.org_id as string,
    storeId: r.store_id as string,
    slug: r.slug as string,
    title: r.title as string,
    descriptionHtml: (r.description_html as string | null) ?? null,
    yearCreated: r.year_created == null ? null : Number(r.year_created),
    medium: (r.medium as string | null) ?? null,
    heightCm: r.height_cm == null ? null : Number(r.height_cm),
    widthCm: r.width_cm == null ? null : Number(r.width_cm),
    depthCm: r.depth_cm == null ? null : Number(r.depth_cm),
    kind: r.kind as Artwork["kind"],
    certificateOfAuthenticity: Boolean(r.certificate_of_authenticity),
    status: r.status as Artwork["status"],
    primaryImageId: (r.primary_image_id as string | null) ?? null,
    primaryImageUrl: (r.primary_image_url as string | null) ?? null,
    primaryImageAlt: (r.primary_image_alt as string | null) ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    viewCount: Number(r.view_count ?? 0),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    variants: [],
  }));
}

export async function loadPieces(
  opts: { limit?: number; sort?: unknown; includePortfolio?: boolean } = {}
): Promise<Piece[]> {
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 24), 1), 100);
  const sort = asSort(opts.sort);
  try {
    const storeId = await getSiteStoreId();
    if (!storeId) return [];
    const listed = await listArtworks({ storeId, status: PUBLIC_STATUSES, sort, limit });
    const extra = opts.includePortfolio !== false && listed.length < limit ? await portfolioPieces(storeId, limit - listed.length) : [];
    const media = await mediaFor([...listed, ...extra]);
    return [
      ...listed.map((a) => toPiece(a, media.get(a.id) ?? [], false)),
      ...extra.map((a) => toPiece(a, media.get(a.id) ?? [], true)),
    ];
  } catch (err) {
    console.error("[katie-the-potter] loadPieces:", err);
    return [];
  }
}

/**
 * Specific pieces, for blocks BOUND to them. Keyed by id; an id that is not
 * hers or not public is simply absent, and the block draws nothing for it.
 */
export async function loadPiecesByIds(ids: unknown[]): Promise<Record<string, Piece>> {
  const clean = [...new Set(ids.filter((i): i is string => typeof i === "string" && UUID.test(i)))].slice(0, 100);
  if (clean.length === 0) return {};
  try {
    const storeId = await getSiteStoreId();
    if (!storeId) return {};
    const rows = await db<Array<{ id: string }>>`
      SELECT a.id FROM artwork a
      WHERE a.id = ANY(${clean}::uuid[]) AND a.store_id = ${storeId}
        AND (a.status IN ('available', 'reserved', 'sold')
             OR (a.status IN ('draft', 'archived') AND a.metadata->>'site' = 'portfolio'))
    `;
    if (rows.length === 0) return {};
    // Re-read through the same mapping as the grid, so a bound piece carries
    // the same price, pictures and link.
    const all = await loadPieces({ limit: 100 });
    const wanted = new Set(rows.map((r) => r.id));
    return Object.fromEntries(all.filter((p) => wanted.has(p.id)).map((p) => [p.id, p]));
  } catch (err) {
    console.error("[katie-the-potter] loadPiecesByIds:", err);
    return {};
  }
}

export interface PieceDetail {
  piece: Piece;
  prev: Piece | null;
  next: Piece | null;
  /** A few other pieces, nearest in the store's order. */
  more: Piece[];
}

/**
 * One piece by slug (or id) with its neighbours in the store's order — the
 * order the grid shows by default (newest first). Pure: works on any list,
 * so the preview can run it on the sample pieces.
 */
export function detailFrom(all: Piece[], slugOrId: string, moreCount = 4): PieceDetail | null {
  const i = all.findIndex((p) => p.slug === slugOrId || p.id === slugOrId);
  if (i < 0) return null;
  const more: Piece[] = [];
  for (let d = 1; more.length < moreCount && (i - d >= 0 || i + d < all.length); d++) {
    if (i + d < all.length) more.push(all[i + d]!);
    if (more.length < moreCount && i - d >= 0) more.push(all[i - d]!);
  }
  return { piece: all[i]!, prev: all[i - 1] ?? null, next: all[i + 1] ?? null, more };
}

export async function loadPieceDetail(slugOrId: string): Promise<PieceDetail | null> {
  if (!slugOrId || slugOrId.length > 200) return null;
  return detailFrom(await loadPieces({ limit: 100 }), slugOrId);
}

/** Every artwork id a block's props bind to (client-safe twin in blocks/binding-ids.ts). */
export { boundIds } from "@/blocks/binding-ids";

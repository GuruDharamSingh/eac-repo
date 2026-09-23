import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import { priceOf, type ArtworkItem } from "@/blocks/artwork-data";
import type { GridItem } from "@/blocks/gallery-grid.client";
import { NEST_DEPTH, galleryIdOf, type Nested, type NestedPicture } from "@/blocks/nested";

// ============================================================================
// Her artworks, for the blocks that show them. Server only.
//
// Read by ARTIST, not by org: her store lives in the marketplace's org
// (`market`), not in `danamccool`, because that is where the network's
// checkout and order book are. What makes a piece hers is `artist_user_id`,
// and she is found by the owner address this site is configured with.
//
// TWO kinds of piece come out of here:
//
//   for sale     status available / reserved / sold — the marketplace's own
//                public set, shown with price and an enquire / buy link.
//   portfolio    UNLISTED on the marketplace (archived or draft) but marked
//                `metadata.site = "portfolio"` — a picture of her work that is
//                not, or no longer, for sale. Shown on her site as a picture
//                only. The marketplace never sees it, because its public
//                queries only ever read the three statuses above.
//
// So "is it for sale" is decided in ONE place — the listing status — and the
// portfolio flag only decides whether an unlisted piece still appears here.
// Relisting a piece in the marketplace studio makes it for sale again with no
// second switch to remember.
//
// Anything else unlisted (a half-made draft, a piece she took down) never
// leaves this function. The endpoints that wrap it are public, so the WHERE
// clause is the whole of the access rule.
// ============================================================================

const COLLECTION = /^[a-z][a-z-]{1,39}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  id: string;
  title: string;
  year_created: number | null;
  medium: string | null;
  height_cm: string | null;
  width_cm: string | null;
  status: ArtworkItem["status"];
  image: string | null;
  price_minor: string | null;
  currency: string | null;
};

/** The shared SELECT: one row per piece, public statuses + portfolio only. */
function select(where: ReturnType<typeof db>, limit: number) {
  return db<Row[]>`
    SELECT a.id, a.title, a.year_created, a.medium, a.height_cm, a.width_cm,
           CASE WHEN a.status IN ('available', 'reserved', 'sold') THEN a.status ELSE 'portfolio' END AS status,
           COALESCE(pm.url, fm.url) AS image,
           v.price_minor, v.currency
    FROM artwork a
    JOIN users u ON u.id = a.artist_user_id
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    LEFT JOIN LATERAL (
      SELECT url FROM artwork_media m WHERE m.artwork_id = a.id ORDER BY m.position LIMIT 1
    ) fm ON true
    LEFT JOIN LATERAL (
      SELECT price_minor, currency FROM artwork_variant v
      WHERE v.artwork_id = a.id ORDER BY v.position, v.price_minor LIMIT 1
    ) v ON true
    WHERE lower(u.email) = lower(${siteConfig.ownerEmail})
      AND (
        a.status IN ('available', 'reserved', 'sold')
        OR (a.status IN ('archived', 'draft') AND a.metadata->>'site' = 'portfolio')
      )
      ${where}
    ORDER BY COALESCE((a.metadata->>'position')::int, 1000), a.year_created DESC NULLS LAST, a.title
    LIMIT ${limit}
  `;
}

function toItem(r: Row): ArtworkItem {
  const market = siteConfig.marketUrl.replace(/\/+$/, "");
  const h = r.height_cm ? Number(r.height_cm) : null;
  const w = r.width_cm ? Number(r.width_cm) : null;
  return {
    id: r.id,
    title: r.title,
    year: r.year_created,
    medium: r.medium,
    dimensions: h && w ? `${h} × ${w} cm` : null,
    image: r.image,
    priceMinor: r.price_minor == null ? null : Number(r.price_minor),
    currency: r.currency?.trim() || "CAD",
    status: r.status,
    // A portfolio piece has no marketplace page to go to — its page there
    // would be a "not available" dead end.
    href: r.status === "portfolio" ? null : `${market}/artworks/${encodeURIComponent(r.id)}?from=danamccool`,
  };
}

export async function loadArtworks(
  opts: { collection?: string; limit?: number; includePortfolio?: boolean } = {}
): Promise<ArtworkItem[]> {
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 24), 1), 200);
  const collection =
    opts.collection && opts.collection !== "all" && COLLECTION.test(opts.collection) ? opts.collection : null;
  const includePortfolio = opts.includePortfolio ?? true;

  try {
    const rows = await select(
      db`
        ${collection ? db`AND a.metadata->'collections' ? ${collection}::text` : db``}
        ${includePortfolio ? db`` : db`AND a.status IN ('available', 'reserved', 'sold')`}
      `,
      limit
    );
    return rows.map(toItem);
  } catch (err) {
    console.error("[danamccool] loadArtworks:", err);
    return [];
  }
}

/**
 * Specific pieces, for blocks BOUND to them. Keyed by id so a block can look
 * each binding up; an id that is not hers, or not public, is simply absent,
 * and the block falls back to whatever was typed by hand.
 */
export async function loadArtworksByIds(ids: unknown[]): Promise<Record<string, ArtworkItem>> {
  const clean = [...new Set(ids.filter((i): i is string => typeof i === "string" && UUID.test(i)))].slice(0, 100);
  if (clean.length === 0) return {};
  try {
    const rows = await select(db`AND a.id = ANY(${clean}::uuid[])`, clean.length);
    return Object.fromEntries(rows.map((r) => [r.id, toItem(r)]));
  } catch (err) {
    console.error("[danamccool] loadArtworksByIds:", err);
    return {};
  }
}

export { boundIds } from "@/blocks/binding-ids";

/**
 * A gallery's contents, in its order, as the Artworks block shows them.
 *
 * `galleryId` empty = the gallery linked to `pagePath` (user_galleries.page_path).
 * Only HER galleries: the lookup is scoped to the site owner, so a page cannot
 * be pointed at somebody else's gallery by id. The gallery's own is_public
 * does not hide it here — a page that shows a gallery IS the public surface;
 * is_public governs the /gallery index and other sites.
 *
 * Artwork items come back live (title, price, sale state) and drop out if the
 * piece is hidden; plain pictures come back as picture-only entries.
 */
export async function loadGalleryWorks(opts: {
  galleryId?: string;
  pagePath?: string;
  limit?: number;
}): Promise<ArtworkItem[]> {
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 24), 1), 200);
  try {
    const [g] = await db<Array<{ items: unknown }>>`
      SELECT g.items
      FROM user_galleries g
      JOIN users u ON u.id = g.user_id
      WHERE lower(u.email) = lower(${siteConfig.ownerEmail})
        AND ${
          opts.galleryId
            ? db`g.id = ${opts.galleryId}`
            : opts.pagePath
              ? db`g.page_path = ${opts.pagePath}`
              : db`FALSE`
        }
      LIMIT 1
    `;
    if (!g || !Array.isArray(g.items)) return [];
    const items = g.items as Array<{ id?: string; url?: string; title?: string; artworkId?: string }>;
    const bound = await loadArtworksByIds(items.map((i) => i.artworkId));
    const out: ArtworkItem[] = [];
    items.forEach((i, n) => {
      if (i.artworkId) {
        const art = bound[i.artworkId];
        if (art) out.push(art);
        return;
      }
      if (typeof i.url === "string" && i.url.startsWith("/api/media/")) {
        out.push({
          id: i.id ?? `picture-${n}`,
          title: String(i.title ?? ""),
          year: null,
          medium: null,
          dimensions: null,
          image: i.url,
          priceMinor: null,
          currency: "CAD",
          status: "portfolio",
          href: null,
        });
      }
    });
    return out.slice(0, limit);
  } catch (err) {
    console.error("[danamccool] loadGalleryWorks:", err);
    return [];
  }
}

/**
 * A gallery's tiles for the Gallery grid block, in its order, with their
 * saved sizes. Artwork items carry their LIVE listing (title, year, price,
 * enquire link) for the hover caption.
 *
 * `editable`: every item comes back, hidden artworks included — the grid then
 * saves the whole list, and dropping an item here would delete it on the next
 * drag. Visitors get only what is shown on the site.
 */
export async function loadGalleryGrid(opts: {
  galleryId?: string;
  pagePath?: string;
  editable?: boolean;
}): Promise<{ galleryId: string | null; title: string; items: GridItem[] }> {
  try {
    const [g] = await db<Array<{ id: string; title: string; items: unknown }>>`
      SELECT g.id, g.title, g.items
      FROM user_galleries g
      JOIN users u ON u.id = g.user_id
      WHERE lower(u.email) = lower(${siteConfig.ownerEmail})
        AND ${
          opts.galleryId
            ? db`g.id = ${opts.galleryId}`
            : opts.pagePath
              ? db`g.page_path = ${opts.pagePath}`
              : db`FALSE`
        }
      LIMIT 1
    `;
    if (!g || !Array.isArray(g.items)) return { galleryId: g?.id ?? null, title: g?.title ?? "", items: [] };
    type Raw = {
      id?: string; url?: string; title?: string; artworkId?: string; subtitle?: string; opens?: string;
      x?: number; y?: number; w?: number; h?: number; fx?: number; fy?: number; zoom?: number;
      saved?: { x: number; y: number; w: number; h: number };
    };
    const raw = g.items as Raw[];
    const live = await loadArtworksByIds(raw.map((i) => i.artworkId));
    const items: GridItem[] = [];
    raw.forEach((i, n) => {
      if (typeof i.url !== "string" || !i.url.startsWith("/api/media/")) return;
      const art = i.artworkId ? live[i.artworkId] : undefined;
      if (i.artworkId && !art && !opts.editable) return; // a hidden piece
      const layout = {
        x: i.x, y: i.y, w: i.w, h: i.h,
        ...(i.fx !== undefined ? { fx: i.fx } : {}),
        ...(i.fy !== undefined ? { fy: i.fy } : {}),
        ...(i.zoom !== undefined ? { zoom: i.zoom } : {}),
        ...(i.saved ? { saved: i.saved } : {}),
        ...(i.subtitle ? { subtitle: i.subtitle } : {}),
        ...(galleryIdOf(i.opens) ? { opens: i.opens } : {}),
      };
      items.push({
        id: i.id ?? `item-${n}`,
        url: i.url,
        title: art?.title ?? String(i.title ?? ""),
        meta: art ? [art.year, art.medium].filter(Boolean).join(" · ") || null : null,
        price: art ? priceOf(art) || null : null,
        href: art?.href ?? null,
        ...layout,
      });
    });
    return { galleryId: g.id, title: g.title, items };
  } catch (err) {
    console.error("[danamccool] loadGalleryGrid:", err);
    return { galleryId: null, title: "", items: [] };
  }
}

/**
 * Every gallery reachable from `ids` through pictures that open another —
 * a level at a time, NEST_DEPTH levels at most, each gallery read once
 * however many pictures open it. Hers only (a stray id to someone else's
 * gallery loads nothing). A visitor's view: hidden pieces are left out.
 * See blocks/nested.ts.
 */
export async function loadNestedGalleries(ids: unknown[]): Promise<Nested> {
  const out: Nested = {};
  let wanted = [...new Set(ids.map(galleryIdOf).filter((x): x is string => !!x))];
  try {
    for (let depth = 0; depth < NEST_DEPTH && wanted.length > 0; depth++) {
      const rows = await db<Array<{ id: string; title: string; items: unknown }>>`
        SELECT g.id, g.title, g.items
        FROM user_galleries g
        JOIN users u ON u.id = g.user_id
        WHERE lower(u.email) = lower(${siteConfig.ownerEmail})
          AND g.id = ANY(${wanted}::text[])
      `;
      type Raw = { id?: string; url?: string; title?: string; artworkId?: string; subtitle?: string; opens?: string };
      const all = rows.flatMap((r) => (Array.isArray(r.items) ? (r.items as Raw[]) : []));
      const live = await loadArtworksByIds(all.map((i) => i.artworkId));
      const next = new Set<string>();
      for (const r of rows) {
        const items: NestedPicture[] = [];
        (Array.isArray(r.items) ? (r.items as Raw[]) : []).forEach((i, n) => {
          if (typeof i.url !== "string" || !i.url.startsWith("/api/media/")) return;
          const art = i.artworkId ? live[i.artworkId] : undefined;
          if (i.artworkId && !art) return; // a hidden piece
          const title = art?.title ?? String(i.title ?? "");
          const meta = art ? [art.year, art.medium].filter(Boolean).join(" · ") : "";
          const opens = galleryIdOf(i.opens);
          if (opens && !out[opens]) next.add(opens);
          items.push({
            id: i.id ?? `item-${n}`,
            url: i.url,
            title,
            caption: [title, i.subtitle, meta].filter(Boolean).join(" — "),
            href: art?.href ?? null,
            ...(opens ? { opens } : {}),
          });
        });
        out[r.id] = { id: r.id, title: r.title, items };
      }
      wanted = [...next].filter((id) => !out[id]);
    }
  } catch (err) {
    console.error("[danamccool] loadNestedGalleries:", err);
  }
  return out;
}

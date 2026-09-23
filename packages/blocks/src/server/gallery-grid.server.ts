import { db } from "@elkdonis/db";
import { formatMoney } from "@elkdonis/commerce/money";
import { marketplaceLinks } from "@elkdonis/commerce/links";
import type { GridItem } from "../blocks/gallery-grid.client";
import { NEST_DEPTH, galleryIdOf, type Nested, type NestedPicture } from "../blocks/gallery-grid.nested";

// ============================================================================
// gallery-grid's data, for ANY owner — generalised off danamccool's own
// lib/artworks.ts, which is scoped to one site by `siteConfig.ownerEmail`.
//
// Two differences from that original, both required to make it shareable:
//
//   1. Scoped by `artist_user_id = userId`, not by matching a site's owner
//      email — the gallery's owner and the artwork's owner are the same
//      person by construction here, whoever that is.
//   2. Live enrichment (price, href) goes through @elkdonis/commerce's own
//      formatMoney/marketplaceLinks rather than a site-local `priceOf`, so a
//      price reads identically wherever this renders.
//
// Everything else — the "a hidden piece drops silently unless editable" rule,
// the depth-capped nested-gallery walk, the loop guard — is unchanged, and
// still deliberately over-fetches nothing beyond what NEST_DEPTH allows.
// ============================================================================

const MARKETPLACE_URL = process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "http://localhost:3009";

interface LiveArt {
  title: string;
  year: number | null;
  medium: string | null;
  priceMinor: number | null;
  currency: string;
  status: string;
  href: string | null;
}

/** Live artwork records, by id — only pieces belonging to `userId`. */
async function loadLive(userId: string, ids: unknown[]): Promise<Record<string, LiveArt>> {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const clean = [...new Set(ids.filter((i): i is string => typeof i === "string" && UUID.test(i)))].slice(0, 200);
  if (clean.length === 0) return {};
  const links = marketplaceLinks(MARKETPLACE_URL);
  try {
    const rows = await db<Array<{
      id: string; title: string; year_created: number | null; medium: string | null;
      status: string; price_minor: string | null; currency: string | null;
    }>>`
      SELECT a.id, a.title, a.year_created, a.medium, a.status,
             v.price_minor, v.currency
      FROM artwork a
      LEFT JOIN LATERAL (
        SELECT price_minor, currency FROM artwork_variant v
        WHERE v.artwork_id = a.id ORDER BY v.position, v.price_minor LIMIT 1
      ) v ON true
      WHERE a.artist_user_id = ${userId} AND a.id = ANY(${clean}::uuid[])
        AND a.status IN ('available', 'reserved', 'sold')
    `;
    return Object.fromEntries(
      rows.map((r) => [
        r.id,
        {
          title: r.title,
          year: r.year_created,
          medium: r.medium,
          priceMinor: r.price_minor == null ? null : Number(r.price_minor),
          currency: r.currency?.trim() || "CAD",
          status: r.status,
          href: links.artwork(r.id),
        },
      ])
    );
  } catch (err) {
    console.error(`[blocks] loadLive(${userId}):`, err);
    return {};
  }
}

type RawItem = {
  id?: string; url?: string; title?: string; artworkId?: string; subtitle?: string; opens?: string;
  x?: number; y?: number; w?: number; h?: number; fx?: number; fy?: number; zoom?: number;
  saved?: { x: number; y: number; w: number; h: number };
};

export interface LoadGalleryGridOptions {
  gallery?: string;
  pagePath?: string;
  editable?: boolean;
}

/**
 * One gallery, as gallery-grid renders it: layout, live artwork enrichment
 * where an item is bound, and each item's price/href set when the piece is
 * for sale (never for a portfolio picture, which has no marketplace page).
 */
export async function loadGalleryGridData(
  userId: string,
  options: LoadGalleryGridOptions = {}
): Promise<{ galleryId: string | null; title: string; items: GridItem[] }> {
  try {
    const [g] = await db<Array<{ id: string; title: string; items: unknown }>>`
      SELECT id, title, items FROM user_galleries
      WHERE user_id = ${userId}
        AND ${
          options.gallery
            ? db`id = ${options.gallery}`
            : options.pagePath
              ? db`page_path = ${options.pagePath}`
              : db`FALSE`
        }
      LIMIT 1
    `;
    if (!g || !Array.isArray(g.items)) return { galleryId: g?.id ?? null, title: g?.title ?? "", items: [] };

    const raw = g.items as RawItem[];
    const live = await loadLive(userId, raw.map((i) => i.artworkId));
    const items: GridItem[] = [];
    raw.forEach((i, n) => {
      if (typeof i.url !== "string" || !i.url.startsWith("/api/media/")) return;
      const art = i.artworkId ? live[i.artworkId] : undefined;
      // A bound id that resolved to nothing is a piece no longer hers to
      // show (sold off the record entirely, or never published) — drop it,
      // unless this is the owner's own editable view, where an empty frame
      // is useful information rather than a surprise gap for a visitor.
      if (i.artworkId && !art && !options.editable) return;
      items.push({
        id: i.id ?? `item-${n}`,
        url: i.url,
        title: art?.title ?? String(i.title ?? ""),
        subtitle: i.subtitle,
        meta: art ? [art.year, art.medium].filter(Boolean).join(" · ") : null,
        price: art && art.status !== "sold"
          ? art.priceMinor
            ? formatMoney(art.priceMinor, art.currency as never)
            : "Price on request"
          : art?.status === "sold"
            ? "Sold"
            : null,
        href: art?.href ?? null,
        x: i.x, y: i.y, w: i.w, h: i.h,
        fx: i.fx, fy: i.fy, zoom: i.zoom,
        saved: i.saved,
        opens: galleryIdOf(i.opens),
      });
    });
    return { galleryId: g.id, title: g.title, items };
  } catch (err) {
    console.error(`[blocks] loadGalleryGridData(${userId}):`, err);
    return { galleryId: null, title: "", items: [] };
  }
}

/**
 * Every gallery reachable from a set of ids, a level at a time, down to
 * NEST_DEPTH — "multiple shots of the same piece" opened from a tile in the
 * main grid. A loop (A opens B, B opens A) is a dead end: `out[opens]` is
 * only queued once, so a gallery already resolved is never re-walked.
 */
export async function loadNestedGalleries(userId: string, ids: unknown[]): Promise<Nested> {
  const out: Nested = {};
  let wanted = [...new Set(ids.map(galleryIdOf).filter((x): x is string => !!x))];
  try {
    for (let depth = 0; depth < NEST_DEPTH && wanted.length > 0; depth++) {
      const rows = await db<Array<{ id: string; title: string; items: unknown }>>`
        SELECT id, title, items FROM user_galleries
        WHERE user_id = ${userId} AND id = ANY(${wanted}::text[])
      `;
      const all = rows.flatMap((r) => (Array.isArray(r.items) ? (r.items as RawItem[]) : []));
      const live = await loadLive(userId, all.map((i) => i.artworkId));
      const next = new Set<string>();
      for (const r of rows) {
        const items: NestedPicture[] = [];
        (Array.isArray(r.items) ? (r.items as RawItem[]) : []).forEach((i, n) => {
          if (typeof i.url !== "string" || !i.url.startsWith("/api/media/")) return;
          const art = i.artworkId ? live[i.artworkId] : undefined;
          if (i.artworkId && !art) return;
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
    console.error(`[blocks] loadNestedGalleries(${userId}):`, err);
  }
  return out;
}

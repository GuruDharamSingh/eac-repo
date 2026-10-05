import { getUserGalleryById } from "@elkdonis/services";
import type { CardRecord } from "@elkdonis/blocks";
import { priceOf } from "@/blocks/artwork-data";
import { getSiteOwnerUserId } from "@/lib/auth";
import { loadArtworksByIds } from "@/lib/artworks";

// ============================================================================
// What a Card's "Filled from (live)" can point at on this site, read fresh at
// every render (the published page's resolver, and /api/blocks/card-record
// for the editor's canvas).
//
//   artwork:<uuid>   one of her pieces — title, picture, year · medium ·
//                    price, and its marketplace page while it is for sale.
//                    Only what lib/artworks already shows publicly.
//   gallery:<id>     one of HER galleries — title, cover, description, how
//                    many pictures, and the page that shows it.
//
// Posts and events (threads) are not offered: this site has none and no page
// to show one at, so a card would link nowhere. Add `thread:` here when it does.
// ============================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GALLERY_ID = /^[A-Za-z0-9_-]{8,64}$/;

export async function loadCardRecord(ref: unknown): Promise<CardRecord | null> {
  if (typeof ref !== "string") return null;
  const [kind, id] = ref.split(":", 2) as [string, string | undefined];
  try {
    if (kind === "artwork" && id && UUID.test(id)) {
      const art = (await loadArtworksByIds([id]))[id];
      if (!art) return null;
      const price = priceOf(art);
      return {
        kind: "artwork",
        title: art.title,
        href: art.href,
        image: art.image,
        meta: [art.year, art.medium, price].filter(Boolean).join(" · ") || null,
      };
    }
    if (kind === "gallery" && id && GALLERY_ID.test(id)) {
      const [g, owner] = await Promise.all([getUserGalleryById(id), getSiteOwnerUserId()]);
      // Only her galleries: a card cannot be pointed at somebody else's by id.
      if (!g || !owner || g.userId !== owner) return null;
      const n = g.items.length;
      return {
        kind: "gallery",
        title: g.title,
        href: g.pagePath ? (g.pagePath === "home" ? "/" : `/${g.pagePath}`) : null,
        image: g.coverUrl ?? g.items[0]?.url ?? null,
        excerpt: g.description,
        meta: n ? `${n} picture${n === 1 ? "" : "s"}` : null,
      };
    }
  } catch (err) {
    console.error("[danamccool] loadCardRecord:", err);
  }
  return null;
}

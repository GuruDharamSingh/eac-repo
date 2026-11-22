import { listPlacesPublic } from "@/lib/places-public";
import { listFeedPosts } from "@/lib/feed";
import type { MobileFeedData, MobilePlaces } from "@/blocks/mobile/types";

// The Places catalogue and Feed screens' data (G5/G6). Reads only, through Jay's modules; each fails soft to
// "nothing" and the blocks show their empty line. Server only. A page that already read it passes it as
// metadata.mobilePlaces / mobileFeed.

/** "12 rue X, 75003 Paris" becomes "12 rue X": the catalogue line is short. */
function shortArea(a: string | null): string | null {
  if (!a) return null;
  const first = a.split(",")[0]?.trim();
  return first || null;
}

export async function readMobilePlaces(): Promise<MobilePlaces> {
  try {
    const { places, tagOrder, favouriteCount } = await listPlacesPublic();
    return {
      rows: places.map((p) => ({
        id: p.id, slug: p.slug, name: p.title, kind: p.tags[0] ?? "Place", area: shortArea(p.address), tags: p.tags, favourite: p.favourite, img: p.imageUrl,
      })),
      tags: tagOrder,
      favouriteCount,
    };
  } catch {
    return { rows: [], tags: [], favouriteCount: 0 };
  }
}

export async function placesFor(metadata: Record<string, unknown> | undefined): Promise<MobilePlaces> {
  const given = metadata?.mobilePlaces as MobilePlaces | undefined;
  return given && Array.isArray(given.rows) ? given : readMobilePlaces();
}

export function whenLabel(iso: string | Date, now = Date.now()): string {
  const t = typeof iso === "string" ? Date.parse(iso) : iso.getTime();
  const m = Math.max(0, Math.round((now - t) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 14) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export async function readMobileFeed(): Promise<MobileFeedData> {
  try {
    const posts = await listFeedPosts({ limit: 50 });
    return {
      rows: posts.map((p) => ({
        id: p.id,
        title: p.title,
        kind: p.link ? ("link" as const) : ("post" as const),
        host: p.link?.host ?? null,
        author: p.author.name ?? "A guide",
        initial: (p.author.name ?? "G").slice(0, 1).toUpperCase(),
        whenLabel: whenLabel(p.publishedAt ?? p.createdAt),
        replyCount: p.replyCount,
      })),
    };
  } catch {
    return { rows: [] };
  }
}

export async function feedFor(metadata: Record<string, unknown> | undefined): Promise<MobileFeedData> {
  const given = metadata?.mobileFeed as MobileFeedData | undefined;
  return given && Array.isArray(given.rows) ? given : readMobileFeed();
}

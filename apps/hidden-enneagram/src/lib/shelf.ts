import { listServiceOfferings } from "@elkdonis/services";
import { getThreadsForFeed } from "@/lib/data";
import { siteConfig } from "@/config/site";
import type { ShelfItem } from "@/blocks/shelf";

// The rows of a he-shelf block (round 3). Server only (reads the database).
// Visitors' view: published services, and a feed's PUBLIC posts only
// (getThreadsForFeed with isMember false), so the editor's ungated route
// (/api/blocks/he-shelf) can never show more than the site already does.

const BOOKING: Record<string, string> = { one_on_one: "One-on-one", group: "Group", async: "Self-paced" };
const FEED = /^[a-z0-9][a-z0-9-]{0,63}$/;

function price(p: number | null, currency: string, min: number | null): string | null {
  if (p == null) return null;
  const f = (n: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(n);
  return min != null && min < p ? `${f(min)} – ${f(p)}` : f(p);
}

export async function loadShelf(props: { source?: unknown; feed?: unknown; limit?: unknown }): Promise<ShelfItem[]> {
  const limit = Math.min(12, Math.max(1, Math.trunc(Number(props.limit) || 3)));
  try {
    if (props.source === "feed") {
      const feed = typeof props.feed === "string" && FEED.test(props.feed) ? props.feed : "writing";
      const threads = await getThreadsForFeed(feed, { isMember: false, limit });
      return threads.map((t) => ({
        id: t.id,
        title: t.title,
        href: `/${feed}/${t.slug}`,
        kicker: null,
        blurb: t.excerpt,
        image: t.coverImageUrl,
      }));
    }
    const services = await listServiceOfferings(siteConfig.orgId);
    return services.slice(0, limit).map((s) => ({
      id: s.id,
      title: s.title,
      href: `/services/${s.slug}`,
      kicker: s.bookingType ? BOOKING[s.bookingType] ?? null : null,
      blurb: s.descriptionShort,
      meta: price(s.price, s.currency, s.priceSlidingMin),
      image: s.coverImageUrl,
    }));
  } catch (err) {
    console.error("[hidden-enneagram] loadShelf:", err);
    return [];
  }
}

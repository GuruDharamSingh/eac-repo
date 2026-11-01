import type { Ad } from "@/classifieds/copy";

/**
 * Real news for the news sheet, from the Metis news desk. Metis gathers the
 * day's stories from a few hundred feeds, files them by region and serves
 * every linked one at /v1/news/headlines, behind a news-only token. Each story
 * becomes a real editorial ad; the plane sets one in every box.
 * Without METIS_URL / METIS_NEWS_TOKEN, or if Metis is down, there is no news.
 */
const MAX_STORIES = 400;

interface Story { section: string; headline: string; source: string; url: string; published: string; outlets: number; image?: string }

function day(published: string): string {
  const d = new Date(published);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Toronto" });
}

/**
 * The source leads the body, right under the headline: a box's foot line is
 * the first thing its fixed height clips, and some templates dress the foot
 * as a phone number or a code.
 */
function storyAd(st: Story): Ad {
  const also = st.outlets > 1 ? `${st.outlets} outlets` : "";
  return {
    id: `news:${st.url}`,
    type: "editorial",
    origin: "real",
    lead: st.section.toUpperCase(),
    headline: st.headline,
    body: [st.source, day(st.published), also].filter(Boolean).join(" · "),
    href: st.url,
    via: st.source,
    image: st.image || undefined,
  };
}

export async function loadNewsAds(): Promise<Ad[]> {
  const base = process.env.METIS_URL;
  const token = process.env.METIS_NEWS_TOKEN;
  if (!base || !token) return [];
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/v1/news/headlines`, {
      headers: { "X-News-Token": token },
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { stories?: Story[] };
    const seen = new Set<string>();
    return (data.stories ?? [])
      .filter((st) => !seen.has(st.url) && !!seen.add(st.url))
      .slice(0, MAX_STORIES)
      .map(storyAd);
  } catch {
    return [];
  }
}

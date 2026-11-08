import { db } from "@elkdonis/db";
import type { HubSeries } from "@elkdonis/cms-ui/hub";
import { listSeriesForPage } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getForumViewer } from "@/lib/forum";

/** Listed series that have not ended, in the Series page's order. */
export async function currentSeries() {
  const entries = await listSeriesForPage(siteConfig.orgId, { count: 8, viewer: await getForumViewer() }).catch(() => []);
  return entries.filter((e) => e.inLanding && !e.ended);
}

/** Every series that has not ended, listed or not, for the hub's cards. */
export async function hubSeriesCards(): Promise<HubSeries[]> {
  const entries = await listSeriesForPage(siteConfig.orgId, { count: 12, viewer: await getForumViewer() }).catch(() => []);
  return entries
    .filter((e) => !e.ended)
    .map(({ series: s }) => ({
      id: s.id,
      slug: s.slug,
      title: s.title,
      href: `/series/${s.slug}`,
      weeks: s.sessions.map((w) => ({
        at: w.at,
        number: w.number,
        title: w.title,
        hostName: w.host?.displayName ?? null,
        rsvpCount: w.rsvpCount,
        isNext: w.isNext,
      })),
    }));
}

export interface ThreadTeaser {
  title: string;
  excerpt: string | null;
  href: string;
  imageUrl: string | null;
  when: Date | null;
}

type TeaserRow = {
  slug: string;
  title: string;
  excerpt: string | null;
  section: string | null;
  kind: string;
  cover: string | null;
  published_at: Date | null;
};

const toTeaser = (r: TeaserRow): ThreadTeaser => ({
  title: r.title,
  excerpt: r.excerpt,
  href: r.kind === "series" ? `/series/${r.slug}` : `/${r.section}/${r.slug}`,
  imageUrl: r.cover,
  when: r.published_at,
});

/** The newest public thread with a page on this site. */
export async function latestThread(): Promise<ThreadTeaser | null> {
  const [row] = await db<TeaserRow[]>`
    SELECT slug, title, excerpt, section, kind, metadata->>'coverImageUrl' AS cover, published_at
    FROM threads
    WHERE org_id = ${siteConfig.orgId}
      AND status = 'published'
      AND visibility = 'PUBLIC'
      AND section IS NOT NULL
      AND kind IN ('post', 'meeting', 'event', 'workshop')
    ORDER BY published_at DESC NULLS LAST
    LIMIT 1
  `.catch(() => []);
  return row ? toTeaser(row) : null;
}

/**
 * The featured thread: the guide's own choice (`users.featured_thread_id`),
 * else the org's newest pinned thread, else the series on the landing.
 */
export async function featuredThread(guideUserId: string | null): Promise<ThreadTeaser | null> {
  const [row] = await db<TeaserRow[]>`
    SELECT t.slug, t.title, t.excerpt, t.section, t.kind,
           COALESCE(t.metadata->>'coverImageUrl', t.metadata->'series'->'cover'->>'url') AS cover, t.published_at
    FROM threads t
    WHERE t.org_id = ${siteConfig.orgId}
      AND t.status = 'published'
      AND t.visibility = 'PUBLIC'
      AND (t.kind = 'series' OR t.section IS NOT NULL)
      AND (
        t.id = (SELECT featured_thread_id FROM users WHERE id = ${guideUserId}::uuid)
        OR t.pinned
        OR t.kind = 'series'
      )
    ORDER BY
      (t.id = (SELECT featured_thread_id FROM users WHERE id = ${guideUserId}::uuid)) IS TRUE DESC,
      t.pinned DESC,
      t.published_at DESC NULLS LAST
    LIMIT 1
  `.catch(() => []);
  return row ? toTeaser(row) : null;
}

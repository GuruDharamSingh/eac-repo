import { db } from "@elkdonis/db";
import { ThreadFeed, type ThreadFeedItem, type ThreadFeedProps } from "../blocks/thread-feed";

// ============================================================================
// The fetching half of the feed block.
//
// Lives behind the `@elkdonis/blocks/server` entry point, so that importing a
// block to DISPLAY it never pulls @elkdonis/db into the graph. That separation
// is the whole point of the split — the presentational component in
// ../blocks/thread-feed.tsx has no idea this file exists.
// ============================================================================

interface Row {
  id: string;
  title: string;
  slug: string;
  kind: string;
  section: string | null;
  excerpt: string | null;
  cover_image_url: string | null;
  scheduled_at: Date | null;
  duration_minutes: number | null;
  location: string | null;
  author_name: string | null;
  feed_name: string | null;
  feed_accent: string | null;
}

export interface LoadThreadFeedOptions {
  /** Restrict to one org_feeds slug. Omit for everything public in the org. */
  feedSlug?: string;
  limit?: number;
  /**
   * Drop anything already finished. A dated item stays listed until six hours
   * past its start — long enough that someone arriving late still sees where
   * they were going — and recurring series never expire.
   */
  upcomingOnly?: boolean;
  /** Where a row links to, given its feed slug and thread slug. */
  href?: (row: { feedSlug: string | null; slug: string }) => string;
}

/**
 * Public, published threads for an org.
 *
 * ── Two filters that must never be dropped ──────────────────────────────────
 *
 * `threads` is a SHARED namespace across the whole network, so a query that
 * forgets `org_id` shows one org's material on another's page. And `kind` is
 * open-ended — auction listings and products are arriving as new kinds — so a
 * feed that does not care about kind must still care about `visibility` and
 * `status`, or an unpublished draft or a members-only thread lands on a public
 * page. Both clauses are written out here rather than being composed in by a
 * caller, precisely so no caller can omit one.
 */
export async function loadThreadFeed(
  orgId: string,
  options: LoadThreadFeedOptions = {}
): Promise<ThreadFeedItem[]> {
  const { feedSlug, limit = 10, upcomingOnly = false } = options;
  const href = options.href ?? ((r) => `/${r.feedSlug ?? "posts"}/${r.slug}`);

  try {
    const rows = await db<Row[]>`
      SELECT
        t.id, t.title, t.slug, t.kind, t.section,
        t.excerpt,
        t.metadata->>'coverImageUrl' AS cover_image_url,
        t.scheduled_at, t.duration_minutes, t.location,
        u.display_name AS author_name,
        f.name         AS feed_name,
        f.accent       AS feed_accent
      FROM threads t
      LEFT JOIN users u ON u.id = t.author_id
      LEFT JOIN org_feeds f ON f.org_id = t.org_id AND f.slug = t.section
      WHERE t.org_id = ${orgId}
        AND t.status = 'published'
        AND t.visibility = 'PUBLIC'
        ${feedSlug ? db`AND t.section = ${feedSlug}` : db``}
        ${
          upcomingOnly
            ? db`AND (t.scheduled_at IS NULL
                      OR t.scheduled_at >= NOW() - INTERVAL '6 hours'
                      OR (t.recurrence_pattern IS NOT NULL AND t.recurrence_pattern <> 'NONE'))`
            : db``
        }
      ORDER BY
        t.scheduled_at ASC NULLS LAST,
        COALESCE(t.published_at, t.created_at) DESC
      LIMIT ${limit}
    `;

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      href: href({ feedSlug: row.section, slug: row.slug }),
      kind: row.kind,
      kicker: row.feed_name,
      excerpt: row.excerpt,
      coverImageUrl: row.cover_image_url,
      scheduledAt: row.scheduled_at,
      durationMinutes: row.duration_minutes,
      location: row.location,
      authorName: row.author_name,
      accent: row.feed_accent,
    }));
  } catch (err) {
    // A feed that cannot load costs the feed, not the page — the same posture
    // the hub takes with its tiles. An org site whose whole homepage 500s
    // because one section is misconfigured is the worse failure.
    console.error(`[blocks] loadThreadFeed(${orgId}, ${feedSlug ?? "*"}):`, err);
    return [];
  }
}

export type ThreadFeedBlockProps = Omit<ThreadFeedProps, "items"> &
  LoadThreadFeedOptions & { orgId: string };

/**
 * The block as a page can place it: give it an org, it fetches and renders.
 *
 * This is the only async thing in the package. Everything it decides about
 * appearance it hands to the presentational component, which is what lets the
 * same block be previewed from `sample()` with no database in reach.
 */
export async function ThreadFeedBlock({
  orgId,
  feedSlug,
  upcomingOnly,
  href,
  ...display
}: ThreadFeedBlockProps) {
  const items = await loadThreadFeed(orgId, {
    feedSlug,
    upcomingOnly,
    href,
    // One source of truth for how many: the display prop the editor set, so
    // the query and the render cannot disagree about the count.
    limit: display.limit ?? 10,
  });

  return <ThreadFeed {...display} items={items} />;
}

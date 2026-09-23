import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";

/**
 * Everything the collective has put out, in one feed.
 *
 * The forum shows what is being DISCUSSED and the hub shows what is coming
 * UP; neither answers "what has this group made". This does — every published
 * thread, whatever kind, newest first, with whatever the org has pinned
 * standing at the top.
 *
 * ── What is excluded, and why ──────────────────────────────────────────────
 *
 * `document` never appears. Those rows carry a public, WRITABLE Nextcloud
 * share link (migration 133), and no feed predicate in this repo was written
 * with that in mind — which is exactly why `OFF_FEED_KINDS` exists. A showcase
 * is the most public surface there is, so this is the last place to relax it.
 *
 * `writing` and `wiki_page` are excluded for a milder reason: each already has
 * a home of its own (a member's shelf, the wiki), and repeating them here
 * would make the showcase a second index rather than a front page.
 */

/** Kinds a showcase will never carry. See the note above. */
const NEVER_SHOWCASE = ["document", "wiki_page", "writing"];

export interface ShowcaseItem {
  id: string;
  slug: string;
  kind: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  pinned: boolean;
  authorName: string | null;
  feedSlug: string | null;
  href: string;
}

export async function listShowcase(options: {
  /** A signed-in member sees ORGANIZATION threads too. */
  isMember?: boolean;
  limit?: number;
} = {}): Promise<ShowcaseItem[]> {
  const limit = Math.min(options.limit ?? 40, 100);
  try {
    const rows = await db<
      Array<{
        id: string;
        slug: string;
        kind: string;
        title: string;
        excerpt: string | null;
        cover_image_url: string | null;
        scheduled_at: string | null;
        published_at: string | null;
        pinned: boolean;
        display_name: string | null;
        section: string | null;
      }>
    >`
      SELECT t.id, t.slug, t.kind, t.title, t.excerpt,
             t.metadata->>'coverImageUrl' AS cover_image_url,
             t.scheduled_at, t.published_at,
             COALESCE(t.pinned, false) AS pinned,
             u.display_name, t.section
      FROM threads t
      LEFT JOIN users u ON u.id = t.author_id
      WHERE t.org_id = ${siteConfig.orgId}
        AND t.status = 'published'
        AND t.kind <> ALL(${NEVER_SHOWCASE})
        AND (
          t.visibility = 'PUBLIC'
          ${options.isMember ? db`OR t.visibility = 'ORGANIZATION'` : db``}
        )
      ORDER BY COALESCE(t.pinned, false) DESC,
               COALESCE(t.published_at, t.scheduled_at, t.updated_at) DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      kind: r.kind,
      title: r.title,
      excerpt: r.excerpt,
      coverImageUrl: r.cover_image_url,
      scheduledAt: r.scheduled_at,
      publishedAt: r.published_at,
      pinned: r.pinned,
      authorName: r.display_name,
      feedSlug: r.section,
      // The board is where a thread is read and replied to, so that is where
      // a card goes rather than inventing a second page for the same row.
      href: `/forum/t/${r.id}/${r.slug}`,
    }));
  } catch (error) {
    console.error("[ifac] listShowcase:", error);
    return [];
  }
}

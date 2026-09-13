import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import type { JournalEntry } from "@/components/home-sections";

/**
 * The site's writing.
 *
 * Posts live in the shared `threads` table like every other kind on the
 * network, scoped to this org. There are none yet and no composer in this app
 * to make any — the home page says so plainly rather than showing an empty
 * card — but the query is the one that will light it up when there are.
 *
 * Fails soft by contract: the caller catches, because a home page should not
 * die for want of a blog.
 */
export async function listJournal(limit = 6): Promise<JournalEntry[]> {
  const rows = await db<Array<{
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    published_at: string | null;
  }>>`
    SELECT id, title, slug, excerpt, published_at
    FROM threads
    WHERE org_id = ${siteConfig.orgId}
      AND kind = 'post'
      AND status = 'published'
      AND visibility = 'PUBLIC'
    ORDER BY COALESCE(published_at, created_at) DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    excerpt: r.excerpt,
    publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
  }));
}

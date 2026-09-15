import { db } from '@elkdonis/db';
import { createThread } from './posts';

// ============================================================================
// Suggested ideas.
//
// An idea is a thread (`kind = 'idea'`) in the org's `ideas` feed, so
// proposing one and discussing it are the same object in the same place the
// rest of the org's conversation lives. Lifted out of apps/ifac's
// /api/hub/ideas, which was the only real implementation.
//
// Written through `createThread` rather than a hand-rolled INSERT — that is
// what earns slug uniqueness, excerpt derivation and correct published_at
// handling for free.
//
// Published on submission rather than queued: a suggestion box whose contents
// only an admin can see is a comment form. Visibility is ORGANIZATION, so an
// idea under discussion is never the org's public face — see
// `project_threads_shared_namespace`: feed and search queries select `kind`
// without filtering it, so visibility is the thing actually keeping these off
// the front page.
// ============================================================================

export const IDEAS_FEED = 'ideas';

export interface OrgIdea {
  id: string;
  title: string;
  authorName: string | null;
  createdAt: string;
  replyCount: number;
  /** The idea's own thread on the forum, when the host knows its board path. */
  href?: string | null;
}

export async function listOrgIdeas(
  orgId: string,
  opts: { limit?: number; threadHref?: (id: string, slug: string) => string } = {}
): Promise<OrgIdea[]> {
  try {
    const rows = await db<
      Array<{
        id: string;
        slug: string;
        title: string;
        author_name: string | null;
        created_at: Date;
        reply_count: number;
      }>
    >`
      SELECT t.id, t.slug, t.title, t.created_at,
             u.display_name AS author_name,
             (SELECT COUNT(*)::int FROM replies r WHERE r.thread_id = t.id) AS reply_count
      FROM threads t
      LEFT JOIN users u ON u.id = t.author_id
      WHERE t.org_id = ${orgId} AND t.kind = 'idea' AND t.status = 'published'
      ORDER BY t.created_at DESC
      LIMIT ${opts.limit ?? 20}
    `;
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      authorName: r.author_name,
      createdAt: r.created_at.toISOString(),
      replyCount: r.reply_count,
      href: opts.threadHref?.(r.id, r.slug) ?? null,
    }));
  } catch (error) {
    console.error(`[org-ideas] list(${orgId}):`, error);
    return [];
  }
}

export async function createOrgIdea(
  orgId: string,
  input: { authorId: string; title: string; body?: string }
): Promise<OrgIdea | null> {
  const title = input.title.trim().slice(0, 200);
  if (title.length < 3) return null;

  try {
    const thread = await createThread({
      kind: 'idea',
      orgId,
      authorId: input.authorId,
      title,
      body: input.body?.trim().slice(0, 5000) || undefined,
      status: 'published',
      visibility: 'ORGANIZATION',
      section: IDEAS_FEED,
    });
    return {
      id: thread.id,
      title: thread.title,
      authorName: null,
      createdAt: new Date().toISOString(),
      replyCount: 0,
    };
  } catch (error) {
    console.error(`[org-ideas] create(${orgId}):`, error);
    return null;
  }
}

/**
 * Make sure the org has somewhere to file these.
 *
 * Only `ifac` had an `ideas` feed, so turning this tile on anywhere else would
 * have written threads into a section the forum does not list. Members-only
 * and non-public, matching IFAC's row, which is the one that has been in use.
 */
export async function ensureIdeasFeed(orgId: string, name = 'Suggested ideas'): Promise<void> {
  await db`
    INSERT INTO org_feeds (org_id, slug, name, is_public, min_role)
    VALUES (${orgId}, ${IDEAS_FEED}, ${name}, false, 'member')
    ON CONFLICT (org_id, slug) DO NOTHING
  `;
}

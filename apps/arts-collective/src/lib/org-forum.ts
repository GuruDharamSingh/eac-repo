import { db } from "@elkdonis/db";
import { OFF_FEED_KINDS } from "@elkdonis/services";

/**
 * Recent activity across every organisation the viewer belongs to.
 *
 * `listLatest` in @elkdonis/services can scope to the whole network or to ONE
 * org (`ForumScope` is `{kind:'network'} | {kind:'org'}`), and neither is what
 * the hub wants: network-wide sweeps in orgs the person has nothing to do
 * with, and one-org means someone in four orgs has to visit four consoles to
 * see whether anything happened. This is the third scope — the set of orgs
 * they are actually in.
 *
 * Visibility is enforced the way the forum enforces it: PUBLIC reads for
 * anyone, ORGANIZATION reads only inside that org, and drafts never appear
 * here regardless of authorship — a draft is not activity, it is unfinished
 * work, and the console counts those in its own band.
 *
 * `OFF_FEED_KINDS` is applied because it is the one place that decides what
 * stays off feeds, forums and search. Without it a member's personal `writing`
 * post and a wiki page would surface here as group activity, which is exactly
 * the bug the landing page still has.
 */

export type CrossOrgForumItem = {
  threadId: string;
  threadSlug: string | null;
  title: string;
  kind: string;
  excerpt: string | null;
  orgId: string;
  orgSlug: string;
  orgName: string;
  authorName: string | null;
  replyCount: number;
  /** Last reply if there is one, else when the thread went up. */
  lastAt: string | null;
  visibility: string;
};

export async function getCrossOrgForum(
  orgIds: string[],
  limit = 12
): Promise<CrossOrgForumItem[]> {
  if (orgIds.length === 0) return [];

  try {
    const rows = await db<
      Array<{
        thread_id: string;
        thread_slug: string | null;
        title: string;
        kind: string;
        excerpt: string | null;
        org_id: string;
        org_slug: string;
        org_name: string;
        author_name: string | null;
        reply_count: number | null;
        last_at: string | null;
        visibility: string;
      }>
    >`
      SELECT
        t.id   AS thread_id,
        t.slug AS thread_slug,
        t.title,
        t.kind,
        t.excerpt,
        o.id   AS org_id,
        o.slug AS org_slug,
        o.name AS org_name,
        u.display_name AS author_name,
        t.reply_count,
        -- last_activity_at is maintained by the forum write path; fall back
        -- for threads made before it existed or written by another surface.
        COALESCE(t.last_activity_at, t.published_at, t.created_at) AS last_at,
        t.visibility
      FROM threads t
      JOIN organizations o ON o.id = t.org_id
      LEFT JOIN users u ON u.id = t.author_id
      WHERE t.org_id = ANY(${orgIds})
        AND t.status = 'published'
        AND t.kind <> ALL(${OFF_FEED_KINDS})
        -- Membership is the caller's to establish: every id passed in is an
        -- org this viewer belongs to, so ORGANIZATION threads are readable.
        AND t.visibility IN ('PUBLIC', 'ORGANIZATION')
      ORDER BY COALESCE(t.last_activity_at, t.published_at, t.created_at) DESC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      threadId: r.thread_id,
      threadSlug: r.thread_slug,
      title: r.title,
      kind: r.kind,
      excerpt: r.excerpt,
      orgId: r.org_id,
      orgSlug: r.org_slug,
      orgName: r.org_name,
      authorName: r.author_name,
      replyCount: r.reply_count ?? 0,
      lastAt: r.last_at,
      visibility: r.visibility,
    }));
  } catch (err) {
    console.error("[org-forum] getCrossOrgForum:", err);
    return [];
  }
}

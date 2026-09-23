import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import { getOrgRole } from './org-membership';

// ============================================================================
// Moderation, org-wide — the forum's rule applied to everything an org
// publishes, not only to forum topics.
//
// Who moderates: an org's OWNERS and GUIDES, which is the same test
// forum-write's `canModerate` makes, and the global admin. Stated once here so
// a manage console, a hub and a route cannot each decide it slightly
// differently. What a moderator may do: let a submission through, turn it
// down, and take published work back off the site (removal itself lives in
// thread-admin.ts — this file is about the queue).
//
// The default is NOT a queue. `organizations.member_posts_review` is false
// (migration 156): a member posts and it is up, which is the owner's call —
// "the default being anything by members can be posted". An org that wants a
// look first turns it on, and then a member's work lands as 'pending'.
// Owners and guides are never held, whatever the switch says.
// ============================================================================

export type ReviewDecision = 'approve' | 'reject';

export interface PendingThread {
  id: string;
  title: string;
  kind: string;
  slug: string | null;
  excerpt: string | null;
  section: string | null;
  coverImageUrl: string | null;
  createdAt: string;
  authorId: string;
  authorName: string | null;
  authorAvatar: string | null;
}

export interface ReviewedThread extends PendingThread {
  status: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
}

/** Owner or guide of this org, or the network admin. */
export async function canModerateOrg(userId: string, orgId: string): Promise<boolean> {
  const [admin] = await db<Array<{ is_admin: boolean }>>`
    SELECT is_admin FROM users WHERE id = ${userId}
  `;
  if (admin?.is_admin) return true;
  const role = await getOrgRole(userId, orgId);
  return role === 'owner' || role === 'guide';
}

/** Whether this org holds members' posts for a look first. */
export async function orgRequiresReview(orgId: string): Promise<boolean> {
  const [row] = await db<Array<{ member_posts_review: boolean }>>`
    SELECT member_posts_review FROM organizations WHERE id = ${orgId}
  `;
  return Boolean(row?.member_posts_review);
}

/** Turn the queue on or off. Moderators only. */
export async function setOrgReview(
  userId: string,
  orgId: string,
  on: boolean
): Promise<{ ok: true; on: boolean } | { ok: false; error: string }> {
  if (!(await canModerateOrg(userId, orgId))) {
    return { ok: false, error: 'Only an owner or guide can change this.' };
  }
  await db`UPDATE organizations SET member_posts_review = ${on} WHERE id = ${orgId}`;
  return { ok: true, on };
}

/**
 * What status a new thread should carry.
 *
 * The one place the rule lives: a moderator publishes outright; a member's
 * work waits only when the org asked for that. `intent` is what the author
 * pressed — saving a draft is always a draft.
 */
export async function statusForNewThread(
  userId: string,
  orgId: string,
  intent: 'draft' | 'published'
): Promise<'draft' | 'pending' | 'published'> {
  if (intent === 'draft') return 'draft';
  if (await canModerateOrg(userId, orgId)) return 'published';
  return (await orgRequiresReview(orgId)) ? 'pending' : 'published';
}

/** The queue, newest first. */
export async function listPendingThreads(orgId: string, limit = 50): Promise<PendingThread[]> {
  const rows = await db<Array<Record<string, unknown>>>`
    SELECT t.id, t.title, t.kind, t.slug, t.excerpt, t.section,
           t.metadata->>'coverImageUrl' AS cover_image_url,
           t.created_at, t.author_id, u.display_name, u.avatar_url
    FROM threads t
    LEFT JOIN users u ON u.id = t.author_id
    WHERE t.org_id = ${orgId} AND t.status = 'pending'
    ORDER BY t.created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(toPending);
}

/** What has been decided lately, so the console can say what happened. */
export async function listReviewedThreads(orgId: string, limit = 20): Promise<ReviewedThread[]> {
  const rows = await db<Array<Record<string, unknown>>>`
    SELECT t.id, t.title, t.kind, t.slug, t.excerpt, t.section,
           t.metadata->>'coverImageUrl' AS cover_image_url,
           t.created_at, t.author_id, t.status, t.reviewed_at,
           u.display_name, u.avatar_url, r.display_name AS reviewer_name
    FROM threads t
    LEFT JOIN users u ON u.id = t.author_id
    LEFT JOIN users r ON r.id = t.reviewed_by
    WHERE t.org_id = ${orgId} AND t.reviewed_at IS NOT NULL
    ORDER BY t.reviewed_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    ...toPending(r),
    status: String(r.status),
    reviewedAt: r.reviewed_at ? new Date(r.reviewed_at as string).toISOString() : null,
    reviewedByName: (r.reviewer_name as string | null) ?? null,
  }));
}

export async function countPendingThreads(orgId: string): Promise<number> {
  const [row] = await db<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n FROM threads WHERE org_id = ${orgId} AND status = 'pending'
  `;
  return row?.n ?? 0;
}

/**
 * Let a submission through, or turn it down.
 *
 * Approving sets `published_at` if it has none, so an approved piece dates
 * from when it went up rather than from when it was written — otherwise a
 * submission held for a week would appear a week down the feed.
 */
export async function reviewThread(
  userId: string,
  threadId: string,
  decision: ReviewDecision
): Promise<{ ok: true; status: string; orgId: string } | { ok: false; error: string }> {
  const [thread] = await db<Array<{ org_id: string; status: string; author_id: string }>>`
    SELECT org_id, status, author_id FROM threads WHERE id = ${threadId}
  `;
  if (!thread) return { ok: false, error: 'No such submission.' };
  if (!(await canModerateOrg(userId, thread.org_id))) {
    return { ok: false, error: 'Only an owner or guide can review this.' };
  }
  if (thread.status !== 'pending') {
    return { ok: false, error: 'That submission has already been decided.' };
  }

  const status = decision === 'approve' ? 'published' : 'archived';
  await db`
    UPDATE threads
    SET status = ${status},
        reviewed_by = ${userId},
        reviewed_at = NOW(),
        published_at = CASE
          WHEN ${status} = 'published' AND published_at IS NULL THEN NOW()
          ELSE published_at
        END,
        updated_at = NOW()
    WHERE id = ${threadId}
  `;

  try {
    await db`
      INSERT INTO events (id, org_id, user_id, action, resource_type, resource_id, data, created_at)
      VALUES (${nanoid()}, ${thread.org_id}, ${userId},
              ${decision === 'approve' ? 'content_approved' : 'content_rejected'},
              'post', ${threadId}, ${db.json({ authorId: thread.author_id })}, NOW())
    `;
  } catch (err) {
    // The decision already happened; losing its log line must not undo it.
    console.error('[moderation] log review:', err);
  }

  return { ok: true, status, orgId: thread.org_id };
}

function toPending(r: Record<string, unknown>): PendingThread {
  return {
    id: String(r.id),
    title: String(r.title ?? 'Untitled'),
    kind: String(r.kind),
    slug: (r.slug as string | null) ?? null,
    excerpt: (r.excerpt as string | null) ?? null,
    section: (r.section as string | null) ?? null,
    coverImageUrl: (r.cover_image_url as string | null) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
    authorId: String(r.author_id ?? ''),
    authorName: (r.display_name as string | null) ?? null,
    authorAvatar: (r.avatar_url as string | null) ?? null,
  };
}

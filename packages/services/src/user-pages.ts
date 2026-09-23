import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import { canModerateOrg } from './moderation';

// ============================================================================
// Moderation for a PERSON's designed page, hosted inside an ORG's layout —
// migration 157's user_pages. Sibling to moderation.ts, not a merge into it:
// that file governs content an org owns outright (a thread in its own feed).
// This governs content a MEMBER OWNS that the org has agreed to display,
// which is why the org-level gate here has no equivalent there.
//
// ── Two decisions, not one ──────────────────────────────────────────────────
//
// moderation.ts asks one question per org: "hold new posts for a look, or
// not". This asks two, because a user page is a different kind of thing:
//
//   member_store_panels   may this org host a member-DESIGNED panel AT ALL?
//                         Default FALSE — opt-in, the opposite of
//                         member_posts_review's default. Explained in
//                         migration 157: a designed panel occupies a section
//                         of the org's OWN layout, not a slot in a list, and
//                         an org should not wake up hosting one it never
//                         agreed to.
//
//   (no second toggle)    Once panels are hosted, every submission goes
//                         through review, unconditionally. There is no
//                         "member_posts_review"-style opt-out for panels,
//                         because unlike a thread — which is one row among
//                         many in a feed a reader scrolls past — a panel
//                         REPLACES a section of the page for as long as it is
//                         live. That is worth a look every time, not just the
//                         first time.
//
// The author is never exempt, unlike moderation.ts's canModerateOrg check on
// new threads: an org's own owner/guide can publish a thread straight away
// because it is their org's content. A store panel is never "the org's own"
// even when its author happens to also be a guide there — it is being
// inserted as someone else's design, so it queues the same as anyone's.
// ============================================================================

export type UserPageDecision = 'approve' | 'reject';

export interface PendingUserPage {
  userId: string;
  orgId: string;
  key: string;
  authorName: string | null;
  authorAvatar: string | null;
  createdAt: string;
}

/** Whether this org hosts member-DESIGNED panels at all. */
export async function orgHostsStorePanels(orgId: string): Promise<boolean> {
  const [row] = await db<Array<{ member_store_panels: boolean }>>`
    SELECT member_store_panels FROM organizations WHERE id = ${orgId}
  `;
  return Boolean(row?.member_store_panels);
}

/** Turn hosting on or off. Moderators only — the same test moderation.ts uses. */
export async function setOrgStorePanels(
  userId: string,
  orgId: string,
  on: boolean
): Promise<{ ok: true; on: boolean } | { ok: false; error: string }> {
  if (!(await canModerateOrg(userId, orgId))) {
    return { ok: false, error: 'Only an owner or guide can change this.' };
  }
  await db`UPDATE organizations SET member_store_panels = ${on} WHERE id = ${orgId}`;
  return { ok: true, on };
}

/**
 * Move a draft into the org's queue.
 *
 * Refuses outright if the org does not host panels — there is no "pending
 * forever" state for an org that never opted in; the author's editor should
 * be telling them this before they even get to a Submit button, and this is
 * the check it must not be able to skip.
 */
export async function submitUserPage(
  userId: string,
  orgId: string,
  key: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await orgHostsStorePanels(orgId))) {
    return { ok: false, error: 'This organisation does not host designed store panels.' };
  }
  const rows = await db<Array<{ status: string }>>`
    UPDATE user_pages
    SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL, updated_at = NOW()
    WHERE user_id = ${userId} AND org_id = ${orgId} AND key = ${key}
      AND status IN ('draft', 'archived')
    RETURNING status
  `;
  if (!rows[0]) {
    return { ok: false, error: 'Nothing here to submit — save something first.' };
  }
  return { ok: true };
}

/** The queue, newest first. */
export async function listPendingUserPages(orgId: string, limit = 50): Promise<PendingUserPage[]> {
  const rows = await db<Array<Record<string, unknown>>>`
    SELECT up.user_id, up.org_id, up.key, up.created_at, u.display_name, u.avatar_url
    FROM user_pages up
    LEFT JOIN users u ON u.id = up.user_id
    WHERE up.org_id = ${orgId} AND up.status = 'pending'
    ORDER BY up.created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    userId: String(r.user_id),
    orgId: String(r.org_id),
    key: String(r.key),
    authorName: (r.display_name as string | null) ?? null,
    authorAvatar: (r.avatar_url as string | null) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
  }));
}

export async function countPendingUserPages(orgId: string): Promise<number> {
  const [row] = await db<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n FROM user_pages WHERE org_id = ${orgId} AND status = 'pending'
  `;
  return row?.n ?? 0;
}

/** Let a submitted panel through, or turn it down. Same shape as reviewThread. */
export async function reviewUserPage(
  reviewerId: string,
  userId: string,
  orgId: string,
  key: string,
  decision: UserPageDecision
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  if (!(await canModerateOrg(reviewerId, orgId))) {
    return { ok: false, error: 'Only an owner or guide can review this.' };
  }
  const status = decision === 'approve' ? 'published' : 'archived';
  const rows = await db<Array<{ status: string }>>`
    UPDATE user_pages
    SET status = ${status}, reviewed_by = ${reviewerId}, reviewed_at = NOW(), updated_at = NOW()
    WHERE user_id = ${userId} AND org_id = ${orgId} AND key = ${key} AND status = 'pending'
    RETURNING status
  `;
  if (!rows[0]) {
    return { ok: false, error: 'That submission has already been decided, or does not exist.' };
  }

  try {
    await db`
      INSERT INTO events (id, org_id, user_id, action, resource_type, resource_id, data, created_at)
      VALUES (${nanoid()}, ${orgId}, ${reviewerId},
              ${decision === 'approve' ? 'store_panel_approved' : 'store_panel_rejected'},
              'user_page', ${key}, ${db.json({ authorId: userId })}, NOW())
    `;
  } catch (err) {
    console.error('[user-pages] log review:', err);
  }

  return { ok: true, status: rows[0].status };
}

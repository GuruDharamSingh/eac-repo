import { db } from '@elkdonis/db';
import { getIdentityIds } from './identities';
import { canModerateOrg } from './moderation';

// ============================================================================
// Thread listings — which org sites show a post besides its home.
//
// Design: docs/open/PERSON_PAGES_BRIEF_2026-09-26.md (decisions 1-3).
//
//   threads.org_id   the post's home. Personal content (writing, notes) is
//                    homed in PERSONAL_ORG_ID (`oad`, ArtDirect), which has no
//                    members; org-context content stays in its org.
//   thread_orgs      further orgs that LIST the post (migration 031). A row
//                    here is listing, never audience: it puts the post on the
//                    author's person page on that org (and, for feed kinds,
//                    in that org's network feed via center.ts loadNetwork).
//
// Listing must not widen who can read a post, so only a PUBLIC post can be
// listed outside its home. thread_orgs is not consulted by any read-access
// check (forum.ts visibleTo, the hub thread routes); keep it that way.
//
// Who may change a listing:
//   add     the author (or the account behind the author's pen name), for an
//           org where that account is member, guide or owner
//   remove  the author, an owner/guide of the listing org (moderation), or a
//           global admin
//
// Approval (migration 261, thread_orgs.status): a listing onto an org where
// the author is an editor (owner/guide) is 'approved' at once; onto an org
// where they are only a member it is 'pending' until an owner/guide of THAT
// org approves or declines it (reviewListing). Only 'approved' rows show the
// post there — every reader filters on it. Declined rows are kept, so a
// refusal does not come back as a fresh request on the author's next save.
// ============================================================================

/** The home org for personal content: ArtDirect. No members, no feed posting (migration 166). */
export const PERSONAL_ORG_ID = 'oad';

/** Roles that may list a post on an org. `viewer` is a follower, not a member. */
const LISTING_ROLES = ['member', 'guide', 'owner'];

/** Roles whose listings need nobody's approval: the org's own editors. */
const EDITOR_ROLES = ['guide', 'owner'];

export type ListingStatus = 'pending' | 'approved' | 'declined';

/**
 * SQL condition: thread `t` is shown on `orgId` — homed there or listed there.
 * For PERSONAL_ORG_ID (ArtDirect, the root page) every thread qualifies; the
 * caller still applies visibility.
 */
export function listedOnClause(orgId: string) {
  if (orgId === PERSONAL_ORG_ID) return db`TRUE`;
  return db`(t.org_id = ${orgId}
    OR EXISTS (SELECT 1 FROM thread_orgs x WHERE x.thread_id = t.id AND x.org_id = ${orgId} AND x.status = 'approved'))`;
}

/** Whether a thread is homed on or listed on an org. For reader routes. */
export async function isListedOn(threadId: string, orgId: string): Promise<boolean> {
  if (orgId === PERSONAL_ORG_ID) return true;
  try {
    const rows = await db<{ ok: boolean }[]>`
      SELECT (t.org_id = ${orgId}
              OR EXISTS (SELECT 1 FROM thread_orgs x WHERE x.thread_id = t.id AND x.org_id = ${orgId} AND x.status = 'approved')) AS ok
      FROM threads t WHERE t.id = ${threadId} LIMIT 1
    `;
    return rows[0]?.ok ?? false;
  } catch (err) {
    console.error(`[thread-listing] isListedOn(${threadId}, ${orgId}):`, err);
    return false;
  }
}

export interface ListingOrg {
  orgId: string;
  name: string;
  slug: string;
}

/** Orgs a person may list their posts on: member, guide or owner. */
export async function listListableOrgs(userId: string): Promise<ListingOrg[]> {
  try {
    const rows = await db<{ org_id: string; name: string; slug: string }[]>`
      SELECT o.id AS org_id, o.name, o.slug
      FROM user_organizations uo JOIN organizations o ON o.id = uo.org_id
      WHERE uo.user_id = ${userId} AND uo.role = ANY(${LISTING_ROLES})
        AND o.id <> ${PERSONAL_ORG_ID}
      ORDER BY o.name
    `;
    return rows.map((r) => ({ orgId: r.org_id, name: r.name, slug: r.slug }));
  } catch (err) {
    console.error(`[thread-listing] listListableOrgs(${userId}):`, err);
    return [];
  }
}

/**
 * Orgs listing a thread, excluding its home — the author's checkbox set, so
 * it includes listings still waiting for approval (a ticked box stays ticked)
 * and leaves out declined ones. For what is actually shown, use
 * listedOnClause / isListedOn; for per-org status, listThreadListingStatuses.
 */
export async function listThreadListings(threadId: string): Promise<string[]> {
  try {
    const rows = await db<{ org_id: string }[]>`
      SELECT x.org_id FROM thread_orgs x JOIN threads t ON t.id = x.thread_id
      WHERE x.thread_id = ${threadId} AND x.org_id <> t.org_id AND x.status <> 'declined'
      ORDER BY x.org_id
    `;
    return rows.map((r) => r.org_id);
  } catch (err) {
    console.error(`[thread-listing] listThreadListings(${threadId}):`, err);
    return [];
  }
}

/** Each non-home listing of a thread with its review status — for "waiting for approval" labels. */
export async function listThreadListingStatuses(
  threadId: string
): Promise<Array<{ orgId: string; status: ListingStatus }>> {
  try {
    const rows = await db<{ org_id: string; status: ListingStatus }[]>`
      SELECT x.org_id, x.status FROM thread_orgs x JOIN threads t ON t.id = x.thread_id
      WHERE x.thread_id = ${threadId} AND x.org_id <> t.org_id
      ORDER BY x.org_id
    `;
    return rows.map((r) => ({ orgId: r.org_id, status: r.status }));
  } catch (err) {
    console.error(`[thread-listing] listThreadListingStatuses(${threadId}):`, err);
    return [];
  }
}

/**
 * Flat shape, not a union: server actions returning a union fail to narrow (see profiles.ts SaveResult).
 * `pending` is true when a listing was requested but waits for that org's owner/guide.
 */
export type ListingResult = { ok: boolean; error?: string; pending?: boolean };

interface ThreadFacts {
  org_id: string;
  author_id: string;
  visibility: string;
  kind: string;
}

async function loadThreadFacts(threadId: string): Promise<ThreadFacts | null> {
  const rows = await db<ThreadFacts[]>`
    SELECT org_id, author_id, visibility, kind FROM threads WHERE id = ${threadId} LIMIT 1
  `;
  return rows[0] ?? null;
}

async function roleAndAdmin(userId: string, orgId: string): Promise<{ role: string | null; isAdmin: boolean }> {
  const [row] = await db<{ role: string | null; is_admin: boolean | null }[]>`
    SELECT
      (SELECT role FROM user_organizations WHERE user_id = ${userId} AND org_id = ${orgId} LIMIT 1) AS role,
      (SELECT is_admin FROM users WHERE id = ${userId} LIMIT 1) AS is_admin
  `;
  return { role: row?.role ?? null, isAdmin: row?.is_admin === true };
}

/**
 * Add or remove one listing. `actorId` must come from the session.
 * Adding an org that is already the home, or removing one that is not listed,
 * is a no-op success.
 */
export async function setThreadListing(
  actorId: string,
  threadId: string,
  orgId: string,
  on: boolean
): Promise<ListingResult> {
  try {
    const thread = await loadThreadFacts(threadId);
    if (!thread) return { ok: false, error: 'That post no longer exists.' };
    if (orgId === thread.org_id || orgId === PERSONAL_ORG_ID) return { ok: true };

    const identityIds = await getIdentityIds(actorId);
    const isAuthor = identityIds.includes(thread.author_id);
    const { role, isAdmin } = await roleAndAdmin(actorId, orgId);

    if (on) {
      if (!isAuthor) return { ok: false, error: 'Only the author can list this post.' };
      // Listing is not audience: a members-only post stays in its home org.
      if (thread.visibility !== 'PUBLIC') {
        return { ok: false, error: 'Only a public post can be shown on another site.' };
      }
      if (thread.kind === 'wiki_page') return { ok: false, error: 'Wiki pages belong to their org.' };
      if (!role || !LISTING_ROLES.includes(role)) {
        return { ok: false, error: 'You can only show posts on sites where you are a member.' };
      }
      // An editor of that org lists at once; a member asks, and waits.
      const status: ListingStatus = EDITOR_ROLES.includes(role) || isAdmin ? 'approved' : 'pending';
      const reviewer = status === 'approved' ? actorId : null;
      // Approved stays approved. A declined one asked again goes back to
      // pending (or straight up, for an editor); a pending one asked by an
      // editor goes up. Anything else is left as it is.
      await db`
        INSERT INTO thread_orgs (thread_id, org_id, added_by, status, reviewed_by, reviewed_at)
        VALUES (${threadId}, ${orgId}, ${actorId}, ${status}, ${reviewer},
                ${status === 'approved' ? db`NOW()` : db`NULL`})
        ON CONFLICT (thread_id, org_id) DO UPDATE
          SET status = EXCLUDED.status, added_by = EXCLUDED.added_by, added_at = NOW(),
              reviewed_by = EXCLUDED.reviewed_by, reviewed_at = EXCLUDED.reviewed_at
          WHERE thread_orgs.status = 'declined'
             OR (thread_orgs.status = 'pending' AND EXCLUDED.status = 'approved')
      `;
      return { ok: true, pending: (await listingStatus(threadId, orgId)) === 'pending' };
    }

    const canModerate = role === 'owner' || role === 'guide';
    if (!isAuthor && !canModerate && !isAdmin) {
      return { ok: false, error: 'Only the author or that site’s organisers can remove this.' };
    }
    await db`DELETE FROM thread_orgs WHERE thread_id = ${threadId} AND org_id = ${orgId}`;
    return { ok: true };
  } catch (err) {
    console.error(`[thread-listing] setThreadListing(${threadId}, ${orgId}, ${on}):`, err);
    return { ok: false, error: 'Could not change where this post shows.' };
  }
}

async function listingStatus(threadId: string, orgId: string): Promise<ListingStatus | null> {
  const [row] = await db<{ status: ListingStatus }[]>`
    SELECT status FROM thread_orgs WHERE thread_id = ${threadId} AND org_id = ${orgId} LIMIT 1
  `;
  return row?.status ?? null;
}

// ── Review: the listing org's owners/guides decide ──────────────────────────

export interface PendingListing {
  threadId: string;
  title: string;
  kind: string;
  excerpt: string | null;
  authorName: string | null;
  /** The post's home org — where it lives, not where it asks to show. */
  homeOrgName: string | null;
  addedAt: string;
}

/** Listings waiting for this org's owner/guide, newest first. Callers gate on editor. */
export async function listPendingListings(orgId: string, limit = 50): Promise<PendingListing[]> {
  try {
    const rows = await db<Array<{
      thread_id: string; title: string; kind: string; excerpt: string | null;
      author_name: string | null; home_org_name: string | null; added_at: Date;
    }>>`
      SELECT x.thread_id, t.title, t.kind, t.excerpt, u.display_name AS author_name,
             o.name AS home_org_name, x.added_at
      FROM thread_orgs x
      JOIN threads t ON t.id = x.thread_id
      LEFT JOIN users u ON u.id = t.author_id
      LEFT JOIN organizations o ON o.id = t.org_id
      WHERE x.org_id = ${orgId} AND x.status = 'pending' AND t.org_id <> ${orgId}
      ORDER BY x.added_at DESC
      LIMIT ${Math.min(limit, 200)}
    `;
    return rows.map((r) => ({
      threadId: r.thread_id,
      title: r.title,
      kind: r.kind,
      excerpt: r.excerpt,
      authorName: r.author_name,
      homeOrgName: r.home_org_name,
      addedAt: new Date(r.added_at).toISOString(),
    }));
  } catch (err) {
    console.error(`[thread-listing] listPendingListings(${orgId}):`, err);
    return [];
  }
}

/**
 * Approve or decline a waiting listing. `actorId` must come from the session;
 * owner/guide of `orgId` or a global admin (canModerateOrg). Only a pending
 * row is decided — an approved listing comes down through setThreadListing(off).
 */
export async function reviewListing(
  actorId: string,
  threadId: string,
  orgId: string,
  decision: 'approve' | 'decline'
): Promise<{ ok: boolean; error?: string; status?: ListingStatus }> {
  try {
    if (!(await canModerateOrg(actorId, orgId))) {
      return { ok: false, error: 'Only an owner or guide of this site can decide that.' };
    }
    const status: ListingStatus = decision === 'approve' ? 'approved' : 'declined';
    const rows = await db<{ status: ListingStatus }[]>`
      UPDATE thread_orgs
      SET status = ${status}, reviewed_by = ${actorId}, reviewed_at = NOW()
      WHERE thread_id = ${threadId} AND org_id = ${orgId} AND status = 'pending'
      RETURNING status
    `;
    if (!rows[0]) return { ok: false, error: 'That request has already been decided, or was withdrawn.' };
    return { ok: true, status: rows[0].status };
  } catch (err) {
    console.error(`[thread-listing] reviewListing(${threadId}, ${orgId}, ${decision}):`, err);
    return { ok: false, error: 'Could not record that decision.' };
  }
}

/**
 * Make a thread's listings exactly `orgIds` (a checkbox set). Each change goes
 * through setThreadListing, so the same gates apply per org; the first refusal
 * is returned and earlier changes stay applied.
 */
export async function setThreadListings(
  actorId: string,
  threadId: string,
  orgIds: string[]
): Promise<ListingResult> {
  const want = new Set(orgIds);
  const have = new Set(await listThreadListings(threadId));
  let pending = false;
  for (const orgId of have) {
    if (!want.has(orgId)) {
      const r = await setThreadListing(actorId, threadId, orgId, false);
      if (!r.ok) return r;
    }
  }
  for (const orgId of want) {
    if (!have.has(orgId)) {
      const r = await setThreadListing(actorId, threadId, orgId, true);
      if (!r.ok) return r;
      if (r.pending) pending = true;
    }
  }
  return { ok: true, pending };
}

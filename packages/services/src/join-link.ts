import { db } from '@elkdonis/db';
import { getIdentityIds } from './identities';

// ============================================================================
// Who receives a meeting's join link.
//
// A join link (threads.meeting_url, a Zoom/Meet URL that often carries the
// password, or the Nextcloud Talk token behind `/call/<token>`) is the door
// itself. Rule (owner, 2026-11-08): only these people receive it —
//
//   - someone who RSVP'd going or maybe (thread_rsvps.status yes|maybe)
//   - a host: the thread's author (or the account behind the author's pen
//     name), or anyone on the meeting's rota (meeting_hosts)
//   - an editor of the thread's org (owner/guide), or a global admin
//
// Everyone else who can read the meeting sees that it is online, not where.
// Guests who RSVP by email (no account) get the link in their confirmation
// and reminder mail, which are sent only to people who RSVP'd.
//
// Apply this on the SERVER, before a row reaches a page, a JSON route, a
// calendar feed or a client component's props. Hiding a link in the browser
// is not hiding it.
// ============================================================================

/** RSVP statuses that receive the join link. */
export const JOIN_LINK_RSVP_STATUSES = ['yes', 'maybe'] as const;

/**
 * Whether `userId` may receive the join link of `threadId`. `canEdit` lets a
 * caller that already knows the viewer is an editor of this org skip the
 * query. Fails closed: no user, no thread, or a database error is `false`.
 */
export async function mayReceiveJoinLink(
  threadId: string,
  userId: string | null | undefined,
  opts: { canEdit?: boolean } = {}
): Promise<boolean> {
  if (!userId) return false;
  if (opts.canEdit) return true;
  try {
    const ids = await getIdentityIds(userId);
    const [row] = await db<{ ok: boolean }[]>`
      SELECT (
        t.author_id = ANY(${ids}::uuid[])
        OR EXISTS (SELECT 1 FROM thread_rsvps r
                   WHERE r.thread_id = t.id AND r.user_id = ${userId}
                     AND r.status = ANY(${[...JOIN_LINK_RSVP_STATUSES]}))
        OR EXISTS (SELECT 1 FROM meeting_hosts h WHERE h.thread_id = t.id AND h.user_id = ${userId})
        OR EXISTS (SELECT 1 FROM user_organizations uo
                   WHERE uo.user_id = ${userId} AND uo.org_id = t.org_id AND uo.role IN ('owner', 'guide'))
        OR EXISTS (SELECT 1 FROM users u WHERE u.id = ${userId} AND u.is_admin = TRUE)
      ) AS ok
      FROM threads t WHERE t.id = ${threadId} LIMIT 1
    `;
    return row?.ok === true;
  } catch (err) {
    console.error(`[join-link] mayReceiveJoinLink(${threadId}):`, err);
    return false;
  }
}

/**
 * The thread ids among `threadIds` whose join link `userId` may receive — the
 * list form of mayReceiveJoinLink, one query for a calendar or a feed.
 */
export async function joinableThreadIds(
  threadIds: string[],
  userId: string | null | undefined,
  opts: { canEdit?: boolean } = {}
): Promise<Set<string>> {
  if (!userId || threadIds.length === 0) return new Set();
  if (opts.canEdit) return new Set(threadIds);
  try {
    const ids = await getIdentityIds(userId);
    const rows = await db<{ id: string }[]>`
      SELECT t.id FROM threads t
      WHERE t.id = ANY(${threadIds})
        AND (
          t.author_id = ANY(${ids}::uuid[])
          OR EXISTS (SELECT 1 FROM thread_rsvps r
                     WHERE r.thread_id = t.id AND r.user_id = ${userId}
                       AND r.status = ANY(${[...JOIN_LINK_RSVP_STATUSES]}))
          OR EXISTS (SELECT 1 FROM meeting_hosts h WHERE h.thread_id = t.id AND h.user_id = ${userId})
          OR EXISTS (SELECT 1 FROM user_organizations uo
                     WHERE uo.user_id = ${userId} AND uo.org_id = t.org_id AND uo.role IN ('owner', 'guide'))
          OR EXISTS (SELECT 1 FROM users u WHERE u.id = ${userId} AND u.is_admin = TRUE)
        )
    `;
    return new Set(rows.map((r) => r.id));
  } catch (err) {
    console.error('[join-link] joinableThreadIds:', err);
    return new Set();
  }
}

/** A row with the two join-link fields cleared. */
export function withoutJoinLink<T extends { meetingUrl?: string | null; talkToken?: string | null }>(row: T): T {
  return { ...row, meetingUrl: null, talkToken: null };
}

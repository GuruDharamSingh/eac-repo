import { db } from '@elkdonis/db';

// ============================================================================
// Thread-agnostic RSVP primitives.
//
// `thread_rsvps` has no `kind` column — a row is just (thread_id, user_id,
// status), and `threads.is_rsvp_enabled` / `attendee_limit` / `rsvp_deadline`
// are generic columns on every thread regardless of kind. That means the
// exact same eligibility check and read/write operations apply whether the
// thread is a meeting, event, workshop, or (later) an auction listing or
// product — no kind-specific branching belongs in here. Kind-specific
// side effects (payment, materials-folder access, notifications, emails)
// stay in the calling API route, layered on top of these primitives.
// ============================================================================

export type RsvpStatus = 'yes' | 'no' | 'maybe' | 'waitlist';

export interface RsvpEligibility {
  ok: boolean;
  error?: string;
}

/**
 * Checks whether a new 'yes' RSVP would be allowed on this thread right now.
 * @param extraConfirmedCount count of commitments a kind tracks outside
 *   thread_rsvps (e.g. a workshop's paid join requests) to fold into the
 *   capacity check alongside plain RSVPs.
 */
export async function checkRsvpEligibility(
  threadId: string,
  extraConfirmedCount = 0
): Promise<RsvpEligibility> {
  const [thread] = await db<Array<{
    is_rsvp_enabled: boolean;
    attendee_limit: number | null;
    rsvp_deadline: Date | null;
  }>>`
    SELECT is_rsvp_enabled, attendee_limit, rsvp_deadline
    FROM threads WHERE id = ${threadId}
  `;

  if (!thread) return { ok: false, error: 'Not found' };

  if (!thread.is_rsvp_enabled) {
    return { ok: false, error: 'RSVPs are not open for this' };
  }

  if (thread.rsvp_deadline && new Date(thread.rsvp_deadline) < new Date()) {
    return { ok: false, error: 'The RSVP deadline has passed' };
  }

  if (thread.attendee_limit) {
    const count = await countConfirmedRsvps(threadId);
    if (count + extraConfirmedCount >= thread.attendee_limit) {
      return { ok: false, error: 'This is at capacity' };
    }
  }

  return { ok: true };
}

/** Count of 'yes' RSVPs on a thread — the capacity-relevant count. */
export async function countConfirmedRsvps(threadId: string): Promise<number> {
  const [{ count }] = await db<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count FROM thread_rsvps
    WHERE thread_id = ${threadId} AND status = 'yes'
  `;
  return count;
}

/** Current status for a user on a thread, or null if they have no row. */
export async function getRsvpStatus(threadId: string, userId: string): Promise<RsvpStatus | null> {
  const [row] = await db<Array<{ status: RsvpStatus }>>`
    SELECT status FROM thread_rsvps WHERE thread_id = ${threadId} AND user_id = ${userId}
  `;
  return row?.status ?? null;
}

/** Upsert a user's RSVP status on a thread. Idempotent. */
export async function setRsvpStatus(
  threadId: string,
  userId: string,
  status: RsvpStatus
): Promise<void> {
  await db`
    INSERT INTO thread_rsvps (thread_id, user_id, status)
    VALUES (${threadId}, ${userId}, ${status})
    ON CONFLICT (thread_id, user_id)
    DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
  `;
}

/** Remove a user's RSVP row entirely (cancel). */
export async function deleteRsvp(threadId: string, userId: string): Promise<void> {
  await db`
    DELETE FROM thread_rsvps WHERE thread_id = ${threadId} AND user_id = ${userId}
  `;
}

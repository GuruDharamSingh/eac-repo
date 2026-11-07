import { db } from '@elkdonis/db';
import { expandOccurrences } from '@elkdonis/utils';
import { resolveMeetingLight } from './standing-meeting';

// ============================================================================
// Reminders to the people coming to a meeting, event or workshop.
//
// The rule, for members and guests alike: an RSVP is good for one occurrence,
// the next one after it was made. This is the rule the site already counts by
// (`getAttendanceCount`), so a daily meeting mails the people who said yes for
// that day and nobody receives daily mail for one old RSVP.
//
// A member needs status 'yes'. A guest needs an email address and the form's
// "Email me a reminder beforehand" ticked. Addresses unsubscribed from the org
// (`contacts.status`) are left out.
//
// Nothing goes out for an occurrence a host marked off (the light) or cancelled
// (`thread_cycle_events`). Neither takes the ledger row, so a meeting put back
// on inside the window is still reminded.
//
// `reminder_minutes_before` NULL means off. Occurrence instants come from
// `expandOccurrences`, in JS at millisecond precision, for the reason given at
// the top of meeting-rota.ts. The ledger key is (thread, occurrence, kind).
// ============================================================================

const ATTENDEE_KIND = 'attendees';
const DAY_MS = 24 * 60 * 60 * 1000;
/** Longer than the widest gap between monthly occurrences (35 days). */
const LOOKBACK_MS = 40 * DAY_MS;

export interface AttendeeReminder {
  threadId: string;
  orgId: string;
  kind: string;
  title: string;
  section: string | null;
  slug: string;
  visibility: string;
  occurrenceAt: string;
  location: string | null;
  meetingUrl: string | null;
  talkToken: string | null;
  /** RSVPs made after this count for the occurrence. Null: the first date, or a one-off. */
  rsvpsAfter: string | null;
}

export interface ReminderRecipient {
  email: string;
  name: string;
  /** Has an account and answered signed in. False: a guest from the public form. */
  isMember: boolean;
}

/**
 * Occurrences due a reminder now, excluding any already claimed. Read-only;
 * `now` lets a caller ask about another moment.
 */
export async function listAttendeeRemindersDue(options: {
  orgId: string;
  now?: Date;
  limit?: number;
}): Promise<AttendeeReminder[]> {
  const now = options.now ?? new Date();
  const threads = await db<
    Array<{
      id: string;
      org_id: string;
      kind: string;
      title: string;
      section: string | null;
      slug: string;
      visibility: string;
      scheduled_at: Date;
      recurrence_pattern: string | null;
      recurrence_until: Date | null;
      duration_minutes: number | null;
      reminder_minutes_before: number;
      location: string | null;
      meeting_url: string | null;
      nextcloud_talk_token: string | null;
    }>
  >`
    SELECT t.id, t.org_id, t.kind, t.title, t.section, t.slug, t.visibility,
           t.scheduled_at, t.recurrence_pattern, t.recurrence_until, t.duration_minutes,
           t.reminder_minutes_before, t.location,
           COALESCE(t.video_link, t.meeting_url) AS meeting_url,
           t.nextcloud_talk_token
    FROM threads t
    WHERE t.org_id = ${options.orgId}
      AND t.kind IN ('meeting', 'event', 'workshop')
      AND t.status = 'published'
      AND t.is_rsvp_enabled = true
      AND t.scheduled_at IS NOT NULL
      AND t.reminder_minutes_before IS NOT NULL
  `;

  const due: AttendeeReminder[] = [];
  for (const thread of threads) {
    if (due.length >= (options.limit ?? 20)) break;

    const item = {
      scheduledAt: thread.scheduled_at,
      recurrencePattern: thread.recurrence_pattern,
    };
    const windowEnd = new Date(now.getTime() + thread.reminder_minutes_before * 60_000);
    const [next] = expandOccurrences([item], now, windowEnd);
    if (!next) continue;
    if (thread.recurrence_until && next.at > new Date(thread.recurrence_until)) continue;

    const occurrenceAt = next.at.toISOString();
    const [sent] = await db`
      SELECT 1 FROM thread_reminder_sends
      WHERE thread_id = ${thread.id}
        AND occurrence_at = ${occurrenceAt}::timestamptz
        AND kind = ${ATTENDEE_KIND}
    `;
    if (sent) continue;

    const previous = expandOccurrences(
      [item],
      new Date(next.at.getTime() - LOOKBACK_MS),
      next.at
    ).at(-1);
    const rsvpsAfter = previous
      ? new Date(previous.at.getTime() + (thread.duration_minutes || 60) * 60_000).toISOString()
      : null;

    const light = await resolveMeetingLight(thread.id, { occurrence: next.at });
    if (light.state === 'red') continue;

    const [cycle] = await db<Array<{ action: string }>>`
      SELECT action FROM thread_cycle_events
      WHERE thread_id = ${thread.id}
        ${rsvpsAfter ? db`AND created_at > ${rsvpsAfter}::timestamptz` : db``}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (cycle?.action === 'cancelled') continue;

    due.push({
      threadId: thread.id,
      orgId: thread.org_id,
      kind: thread.kind,
      title: thread.title,
      section: thread.section,
      slug: thread.slug,
      visibility: thread.visibility,
      occurrenceAt,
      location: thread.location,
      meetingUrl: thread.meeting_url,
      talkToken: thread.nextcloud_talk_token,
      rsvpsAfter,
    });
  }
  return due;
}

/** Who to write to for one occurrence, one row per address. A member row wins over a guest row. */
export async function listAttendeeReminderRecipients(
  reminder: Pick<AttendeeReminder, 'threadId' | 'orgId' | 'rsvpsAfter'>
): Promise<ReminderRecipient[]> {
  const after = reminder.rsvpsAfter;
  const rows = await db<Array<{ email: string; name: string; is_member: boolean }>>`
    SELECT DISTINCT ON (x.address) x.email, x.name, x.is_member
    FROM (
      SELECT lower(u.email) AS address, u.email,
             COALESCE(NULLIF(trim(u.display_name), ''), u.email) AS name,
             true AS is_member
      FROM thread_rsvps r
      JOIN users u ON u.id = r.user_id
      WHERE r.thread_id = ${reminder.threadId}
        AND r.status = 'yes'
        AND u.email IS NOT NULL
        ${after ? db`AND r.updated_at > ${after}::timestamptz` : db``}

      UNION ALL

      SELECT lower(g.email), g.email,
             COALESCE(NULLIF(trim(g.name), ''), g.email),
             false
      FROM guest_submissions g
      WHERE g.thread_id = ${reminder.threadId}
        AND g.kind = 'rsvp'
        AND g.email IS NOT NULL
        AND g.metadata->>'wants_reminder' = 'true'
        ${after ? db`AND g.created_at > ${after}::timestamptz` : db``}
    ) x
    WHERE NOT EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.org_id = ${reminder.orgId}
        AND lower(c.email) = x.address
        AND c.status = 'unsubscribed'
    )
    ORDER BY x.address, x.is_member DESC
  `;
  return rows.map((r) => ({ email: r.email, name: r.name, isMember: r.is_member }));
}

/**
 * Take the ledger row; only one tick wins. Taken before sending: a crash between
 * the two loses one reminder, where the other order repeats it on every tick.
 */
export async function claimAttendeeReminder(threadId: string, occurrenceAt: string): Promise<boolean> {
  const claimed = await db`
    INSERT INTO thread_reminder_sends (thread_id, occurrence_at, kind, recipients)
    VALUES (${threadId}, ${occurrenceAt}::timestamptz, ${ATTENDEE_KIND}, 0)
    ON CONFLICT DO NOTHING
    RETURNING thread_id
  `;
  return claimed.length > 0;
}

export async function recordAttendeeReminderSent(
  threadId: string,
  occurrenceAt: string,
  recipients: number
): Promise<void> {
  await db`
    UPDATE thread_reminder_sends SET recipients = ${recipients}
    WHERE thread_id = ${threadId}
      AND occurrence_at = ${occurrenceAt}::timestamptz
      AND kind = ${ATTENDEE_KIND}
  `;
}

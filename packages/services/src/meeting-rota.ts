import { db } from '@elkdonis/db';
import { expandOccurrences } from '@elkdonis/utils';

/**
 * Who is running which occurrence of a recurring gathering.
 *
 * A recurring meeting is one `threads` row; its occurrences are derived by
 * walking `scheduled_at` forward. So an occurrence has no id, and everything
 * here addresses one by the pair (thread, instant) — see migration 136.
 *
 * ── One rule that matters ──────────────────────────────────────────────────
 *
 * Every `occurrence_at` written or matched here comes from `expandOccurrences`
 * — i.e. from JavaScript, at millisecond precision. `timestamptz` keeps
 * MICROseconds, so a value that made a round trip through Postgres with a
 * non-zero microsecond part would never compare equal to the millisecond one
 * JS recomputes. The defence is simply never to compare against
 * `threads.scheduled_at` in SQL: occurrences are computed in JS and passed in
 * as a list, so both sides of every comparison have the same provenance.
 */

/** The canonical role. Others may exist; this is the one the card shows. */
export const HOST_ROLE = 'host';

export interface RotaAssignment {
  role: string;
  userId: string | null;
  displayName: string | null;
  email: string | null;
  note: string | null;
}

export interface RotaOccurrence {
  /** ISO instant — the key for every other call here. */
  at: string;
  /** Already happened. A past occurrence takes a record, not a host. */
  isPast: boolean;
  /** The `host` assignment, which is what the card face shows. */
  host: RotaAssignment | null;
  /** Every assignment on this occurrence, host included. */
  roles: RotaAssignment[];
  /** Whether a record has been written for it afterwards. */
  hasRecord: boolean;
}

interface MeetingRow {
  id: string;
  org_id: string;
  title: string;
  scheduled_at: string | null;
  recurrence_pattern: string | null;
  recurrence_until: string | null;
  nextcloud_talk_token: string | null;
  reminder_minutes_before: number | null;
}

async function loadMeeting(threadId: string): Promise<MeetingRow | null> {
  const [row] = await db<MeetingRow[]>`
    SELECT id, org_id, title, scheduled_at, recurrence_pattern,
           recurrence_until, nextcloud_talk_token, reminder_minutes_before
    FROM threads WHERE id = ${threadId}
  `;
  return row ?? null;
}

/**
 * The next `count` occurrences of a gathering, from `from` onward.
 *
 * A non-recurring meeting has exactly one, which is the honest answer rather
 * than an error: "plan ahead" on a one-off should show that there is nothing
 * to plan, not refuse to open.
 */
export function occurrencesOf(
  meeting: {
    scheduledAt: string | Date | null;
    recurrencePattern?: string | null;
    recurrenceUntil?: string | Date | null;
  },
  options: { from?: Date; count?: number } = {}
): Date[] {
  if (!meeting.scheduledAt) return [];
  const from = options.from ?? new Date();
  const count = Math.max(1, Math.min(options.count ?? 8, 52));

  const pattern = meeting.recurrencePattern ?? null;
  if (!pattern || pattern === 'NONE') {
    const at = new Date(meeting.scheduledAt);
    return at >= from ? [at] : [];
  }

  // A horizon wide enough that `count` weekly occurrences always fit, then
  // trimmed — expandOccurrences is bounded by date, not by quantity.
  const horizon = new Date(from.getTime() + count * 40 * 24 * 60 * 60 * 1000);
  const until = meeting.recurrenceUntil ? new Date(meeting.recurrenceUntil) : null;
  const end = until && until < horizon ? until : horizon;

  return expandOccurrences(
    [
      {
        scheduledAt:
          typeof meeting.scheduledAt === 'string'
            ? meeting.scheduledAt
            : meeting.scheduledAt.toISOString(),
        recurrencePattern: pattern,
      } as never,
    ],
    from,
    end,
    count
  )
    .slice(0, count)
    .map((o) => o.at);
}

/** The rota for the next `count` occurrences, assignments resolved to people. */
export async function getMeetingRota(
  threadId: string,
  options: { from?: Date; count?: number } = {}
): Promise<{ title: string; occurrences: RotaOccurrence[] }> {
  const meeting = await loadMeeting(threadId);
  if (!meeting) return { title: '', occurrences: [] };

  const dates = occurrencesOf(
    {
      scheduledAt: meeting.scheduled_at,
      recurrencePattern: meeting.recurrence_pattern,
      recurrenceUntil: meeting.recurrence_until,
    },
    options
  );
  if (dates.length === 0) return { title: meeting.title, occurrences: [] };

  const isos = dates.map((d) => d.toISOString());

  const rows = await db<
    Array<{
      occurrence_at: string;
      role: string;
      user_id: string | null;
      note: string | null;
      display_name: string | null;
      email: string | null;
    }>
  >`
    SELECT h.occurrence_at, h.role, h.user_id, h.note,
           u.display_name, u.email
    FROM meeting_hosts h
    LEFT JOIN users u ON u.id = h.user_id
    WHERE h.thread_id = ${threadId}
      AND h.occurrence_at = ANY(${isos}::timestamptz[])
  `;

  const recorded = await db<Array<{ occurrence_at: string }>>`
    SELECT occurrence_at FROM meeting_occurrence_notes
    WHERE thread_id = ${threadId}
      AND occurrence_at = ANY(${isos}::timestamptz[])
  `;
  const hasRecord = new Set(recorded.map((r) => new Date(r.occurrence_at).toISOString()));

  const byInstant = new Map<string, RotaAssignment[]>();
  for (const row of rows) {
    const key = new Date(row.occurrence_at).toISOString();
    const list = byInstant.get(key) ?? [];
    list.push({
      role: row.role,
      userId: row.user_id,
      displayName: row.display_name,
      email: row.email,
      note: row.note,
    });
    byInstant.set(key, list);
  }

  return {
    title: meeting.title,
    occurrences: dates.map((date) => {
      const key = date.toISOString();
      const roles = byInstant.get(key) ?? [];
      return {
        at: key,
        isPast: date.getTime() < Date.now(),
        host: roles.find((r) => r.role === HOST_ROLE) ?? null,
        roles,
        hasRecord: hasRecord.has(key),
      };
    }),
  };
}

/**
 * Assign (or clear) a role on one occurrence.
 *
 * Passing a null `userId` keeps the row rather than deleting it, because
 * "this date needs someone" is a thing a rota wants to say — the note survives
 * with no name against it. Clearing the row entirely is `clearMeetingRole`.
 *
 * The caller must already have established that the actor may edit the org.
 */
export async function assignMeetingRole(input: {
  threadId: string;
  occurrenceAt: string | Date;
  role?: string;
  userId: string | null;
  note?: string | null;
  actorUserId: string | null;
}): Promise<void> {
  const at = new Date(input.occurrenceAt).toISOString();
  const role = input.role ?? HOST_ROLE;
  await db`
    INSERT INTO meeting_hosts (thread_id, occurrence_at, role, user_id, note, assigned_by)
    VALUES (${input.threadId}, ${at}::timestamptz, ${role}, ${input.userId},
            ${input.note ?? null}, ${input.actorUserId})
    ON CONFLICT (thread_id, occurrence_at, role) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          note = EXCLUDED.note,
          assigned_by = EXCLUDED.assigned_by,
          updated_at = NOW()
  `;
}

export async function clearMeetingRole(
  threadId: string,
  occurrenceAt: string | Date,
  role: string = HOST_ROLE
): Promise<void> {
  await db`
    DELETE FROM meeting_hosts
    WHERE thread_id = ${threadId}
      AND occurrence_at = ${new Date(occurrenceAt).toISOString()}::timestamptz
      AND role = ${role}
  `;
}

/**
 * Who a rota may be filled from: the org's members, with owners and guides
 * first because they are the people who actually run sessions.
 */
export async function listRotaCandidates(
  orgId: string
): Promise<Array<{ userId: string; displayName: string; email: string | null }>> {
  const rows = await db<Array<{ id: string; display_name: string | null; email: string | null }>>`
    SELECT u.id, u.display_name, u.email
    FROM user_organizations uo
    JOIN users u ON u.id = uo.user_id
    WHERE uo.org_id = ${orgId}
      AND uo.role IN ('owner', 'guide', 'member')
    ORDER BY CASE uo.role WHEN 'owner' THEN 0 WHEN 'guide' THEN 1 ELSE 2 END,
             COALESCE(u.display_name, u.email)
  `;
  return rows.map((r) => ({
    userId: r.id,
    displayName: r.display_name?.trim() || r.email || 'Someone',
    email: r.email,
  }));
}

// ============================================================================
// What happened at an occurrence
// ============================================================================

export type AttendanceSource = 'call' | 'chat' | 'rsvp' | 'manual';

export interface AttendanceEntry {
  /** A platform user, when the attendee has an account. */
  userId?: string | null;
  /** Talk's actor id — the only identity a guest has. */
  actorId?: string | null;
  name: string;
  /** Where this entry came from. A typed name is never dressed as evidence. */
  source: AttendanceSource;
}

export interface OccurrenceRecord {
  threadId: string;
  at: string;
  note: string | null;
  attended: AttendanceEntry[];
  recordedBy: string | null;
  updatedAt: string | null;
}

export async function getOccurrenceRecord(
  threadId: string,
  occurrenceAt: string | Date
): Promise<OccurrenceRecord | null> {
  const [row] = await db<
    Array<{
      occurrence_at: string;
      note: string | null;
      attended: AttendanceEntry[];
      recorded_by: string | null;
      updated_at: string;
    }>
  >`
    SELECT occurrence_at, note, attended, recorded_by, updated_at
    FROM meeting_occurrence_notes
    WHERE thread_id = ${threadId}
      AND occurrence_at = ${new Date(occurrenceAt).toISOString()}::timestamptz
  `;
  if (!row) return null;
  return {
    threadId,
    at: new Date(row.occurrence_at).toISOString(),
    note: row.note,
    attended: Array.isArray(row.attended) ? row.attended : [],
    recordedBy: row.recorded_by,
    updatedAt: row.updated_at,
  };
}

export async function saveOccurrenceRecord(input: {
  threadId: string;
  occurrenceAt: string | Date;
  note?: string | null;
  attended?: AttendanceEntry[];
  actorUserId: string | null;
}): Promise<void> {
  const at = new Date(input.occurrenceAt).toISOString();
  await db`
    INSERT INTO meeting_occurrence_notes
      (thread_id, occurrence_at, note, attended, recorded_by)
    VALUES (${input.threadId}, ${at}::timestamptz, ${input.note ?? null},
            ${db.json((input.attended ?? []) as never)}, ${input.actorUserId})
    ON CONFLICT (thread_id, occurrence_at) DO UPDATE
      SET note = EXCLUDED.note,
          attended = EXCLUDED.attended,
          recorded_by = EXCLUDED.recorded_by,
          updated_at = NOW()
  `;
}

/**
 * Who Talk thinks was there.
 *
 * A SUGGESTION, never a record: it is returned for a human to accept, and
 * `saveOccurrenceRecord` is what makes it true. Two kinds of evidence, both
 * marked as such:
 *
 *   call — Talk emits system messages (`call_joined`, `call_started`) naming
 *          the actor. This is the good evidence: it catches someone who sat
 *          silently through the whole hour, which is most people.
 *   chat — anyone who typed in the window. Weaker, and it catches a person who
 *          was never in the call at all, so it is labelled differently.
 *
 * ── What this cannot do ────────────────────────────────────────────────────
 *
 * Talk's chat API returns the most recent messages; it has no "give me a time
 * range". So this reads the last `scan` messages and filters by window, which
 * finds a recent occurrence and quietly finds nothing for one far enough back
 * that the room has since filled. That is why the result says how many
 * messages it looked at — a caller showing an empty suggestion can tell the
 * difference between "nobody came" and "too long ago to tell".
 */
export async function suggestAttendanceFromTalk(
  threadId: string,
  occurrenceAt: string | Date,
  options: { windowMinutes?: number; scan?: number } = {}
): Promise<{
  roomToken: string | null;
  scanned: number;
  windowStart: string;
  windowEnd: string;
  suggested: AttendanceEntry[];
}> {
  const meeting = await loadMeeting(threadId);
  const at = new Date(occurrenceAt);
  // Generous on both sides: people join before it starts and linger after.
  const window = (options.windowMinutes ?? 150) * 60 * 1000;
  const start = new Date(at.getTime() - 30 * 60 * 1000);
  const end = new Date(at.getTime() + window);
  const empty = {
    roomToken: meeting?.nextcloud_talk_token ?? null,
    scanned: 0,
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
    suggested: [] as AttendanceEntry[],
  };

  const token = meeting?.nextcloud_talk_token;
  if (!token) return empty;

  let messages: Array<{
    actorId?: string;
    actorType?: string;
    actorDisplayName?: string;
    timestamp?: number;
    systemMessage?: string;
    messageType?: string;
  }> = [];
  try {
    const { getAdminClient } = await import('@elkdonis/nextcloud');
    const { getMessages } = await import('@elkdonis/nextcloud');
    messages = (await getMessages(getAdminClient(), token, options.scan ?? 200)) ?? [];
  } catch (error) {
    console.error(`[meeting-rota] talk read failed for ${threadId}:`, error);
    return empty;
  }

  /** Talk's system messages that mean "this person was in the call". */
  const CALL_PRESENCE = new Set(['call_joined', 'call_started']);

  const byActor = new Map<string, AttendanceEntry>();
  for (const m of messages) {
    const ts = typeof m.timestamp === 'number' ? m.timestamp * 1000 : 0;
    if (!ts || ts < start.getTime() || ts > end.getTime()) continue;
    const actorId = m.actorId;
    if (!actorId) continue;
    // The service account is in every room and is not a participant.
    if (actorId === process.env.NEXTCLOUD_ADMIN_USER) continue;

    const isCall = Boolean(m.systemMessage && CALL_PRESENCE.has(m.systemMessage));
    const isSpeech = !m.systemMessage && m.messageType !== 'system';
    if (!isCall && !isSpeech) continue;

    const existing = byActor.get(actorId);
    // Call evidence outranks chat evidence for the same person.
    if (existing && (existing.source === 'call' || !isCall)) continue;
    byActor.set(actorId, {
      actorId,
      name: m.actorDisplayName || actorId,
      source: isCall ? 'call' : 'chat',
    });
  }

  // Resolve Talk actors back to platform users where the mapping exists, so an
  // accepted suggestion records a person rather than a string.
  const actorIds = [...byActor.keys()];
  if (actorIds.length > 0) {
    try {
      const links = await db<Array<{ actor_id: string; user_id: string }>>`
        SELECT actor_id, user_id FROM talk_guest_sessions
        WHERE room_token = ${token} AND actor_id = ANY(${actorIds})
      `;
      for (const link of links) {
        const entry = byActor.get(link.actor_id);
        if (entry) entry.userId = link.user_id;
      }
    } catch (error) {
      console.error('[meeting-rota] actor resolution failed:', error);
    }
  }

  return {
    ...empty,
    scanned: messages.length,
    suggested: [...byActor.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ============================================================================
// Host reminders
// ============================================================================

export interface HostDuty {
  threadId: string;
  orgId: string;
  title: string;
  occurrenceAt: string;
  userId: string;
  email: string;
  displayName: string;
  note: string | null;
  talkToken: string | null;
}

/**
 * Hosts due a reminder: an assignment whose occurrence falls inside the
 * window, for which no `host` reminder has been logged.
 *
 * Deliberately NOT joined against `threads.scheduled_at` — see the precision
 * note at the top of this file. `meeting_hosts.occurrence_at` is already the
 * instant the occurrence happens, written from the same expansion the card
 * displays, so it is the only column this needs.
 */
export async function listHostRemindersDue(options: {
  orgId?: string;
  withinMinutes?: number;
  limit?: number;
}): Promise<HostDuty[]> {
  const within = options.withinMinutes ?? 60;
  const rows = await db<
    Array<{
      thread_id: string;
      org_id: string;
      title: string;
      occurrence_at: string;
      user_id: string;
      email: string;
      display_name: string | null;
      note: string | null;
      nextcloud_talk_token: string | null;
    }>
  >`
    SELECT h.thread_id, t.org_id, t.title, h.occurrence_at, h.user_id,
           u.email, u.display_name, h.note, t.nextcloud_talk_token
    FROM meeting_hosts h
    JOIN threads t ON t.id = h.thread_id
    JOIN users u ON u.id = h.user_id
    WHERE h.role = ${HOST_ROLE}
      AND h.user_id IS NOT NULL
      AND u.email IS NOT NULL
      AND t.status = 'published'
      AND h.occurrence_at > NOW()
      AND h.occurrence_at <= NOW() + (${within} * INTERVAL '1 minute')
      ${options.orgId ? db`AND t.org_id = ${options.orgId}` : db``}
      AND NOT EXISTS (
        SELECT 1 FROM thread_reminder_sends s
        WHERE s.thread_id = h.thread_id
          AND s.occurrence_at = h.occurrence_at
          AND s.kind = 'host'
      )
    ORDER BY h.occurrence_at
    LIMIT ${options.limit ?? 20}
  `;
  return rows.map((r) => ({
    threadId: r.thread_id,
    orgId: r.org_id,
    title: r.title,
    occurrenceAt: new Date(r.occurrence_at).toISOString(),
    userId: r.user_id,
    email: r.email,
    displayName: r.display_name?.trim() || r.email,
    note: r.note,
    talkToken: r.nextcloud_talk_token,
  }));
}

/**
 * Claim a host reminder. Returns false when another tick already has it —
 * overlapping ticks are normal, two letters are not.
 */
export async function claimHostReminder(
  threadId: string,
  occurrenceAt: string | Date
): Promise<boolean> {
  const claimed = await db`
    INSERT INTO thread_reminder_sends (thread_id, occurrence_at, kind, recipients)
    VALUES (${threadId}, ${new Date(occurrenceAt).toISOString()}::timestamptz, 'host', 1)
    ON CONFLICT DO NOTHING
    RETURNING thread_id
  `;
  return claimed.length > 0;
}

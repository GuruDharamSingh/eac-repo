// ============================================================================
// Per-org Nextcloud calendar — the CalDAV mirror of an org's schedule.
//
// THE DIRECTION MATTERS, so it is stated once here and assumed everywhere else:
// Postgres is the record and the Nextcloud calendar is a PROJECTION.
//
// org-deck.ts goes the other way — Deck owns the cards and Postgres holds one
// integer pointing at the board. Copying that literally for calendars would
// mean moving events into CalDAV, and events are not free-standing here: a
// `threads` row carries RSVPs, replies, purchases, materials and a feed
// section. CalDAV can hold none of that. So events are authored in the app,
// and pushed out so members can subscribe from a phone or a desktop client.
//
// The consequence to keep in mind: a member editing the mirror in Nextcloud
// will have their edit overwritten on the next sync. That is why shares are
// granted READ-ONLY by default.
//
// Isolation follows org-deck's two rules, adapted:
//   1. A calendar uri is never accepted from a caller — always resolved from
//      `organizations.calendar_uri` for the org the caller is scoped to.
//   2. Every thread pushed is verified to belong to that org first, so a
//      caller cannot name another org's thread and have the service account
//      publish it into this calendar.
//
// SHARING — the part that cost a live experiment (2026-09-07, Nextcloud 33):
// a DAV share to `principals/circles/<id>` returns HTTP 200 and persists
// NOTHING in `oc_dav_shares`, and the service account gets 403 reading circle
// membership over OCS. A Circle is a convenience in Nextcloud's own UI; it is
// not a mechanism this platform can drive. So membership comes from
// `user_organizations` and shares fan out one per user principal — exactly
// what syncOrgDeckMembers does for Deck ACLs.
// ============================================================================

import { db } from '@elkdonis/db';
import { addMonths, expandOccurrences, startOfMonth } from '@elkdonis/utils';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  ensureCalendarExists,
  getAdminClient,
  listCalendarShares,
  shareCalendarWithUser,
  unshareCalendarWithUser,
  type CalendarEvent,
  type NextcloudClient,
} from '@elkdonis/nextcloud';

/**
 * Thrown when a caller names a thread that isn't their org's, or acts on an
 * org whose calendar was never provisioned. Distinct from a Nextcloud failure
 * so routes answer 404 rather than reporting a scope refusal as a broken
 * upstream.
 */
export class OrgCalendarScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrgCalendarScopeError';
  }
}

/** Kinds that represent something happening at a time. */
export const SCHEDULED_KINDS = ['event', 'meeting', 'workshop'] as const;

/**
 * Recurrence patterns, mapped to RFC 5545 RRULEs.
 *
 * `threads.recurrence_pattern` has been written since migration 030 and read
 * by nothing — the old sync never set `recurrence` at all, so a weekly meeting
 * exported as a single one-off event. MONTHLY uses BYMONTHDAY rather than a
 * naive 30-day interval so it doesn't drift off its date.
 */
const RRULE_BY_PATTERN: Record<string, string> = {
  DAILY: 'FREQ=DAILY',
  WEEKLY: 'FREQ=WEEKLY',
  MONTHLY: 'FREQ=MONTHLY',
};

export interface OrgCalendar {
  orgId: string;
  uri: string;
  syncedAt: string | null;
}

interface SchedulableThread {
  id: string;
  title: string;
  body: string | null;
  location: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  meeting_url: string | null;
  recurrence_pattern: string | null;
  recurrence_until: string | null;
  reminder_minutes_before: number | null;
}

function client(): NextcloudClient {
  return getAdminClient();
}

async function readCalendarUri(orgId: string): Promise<string | null> {
  const [row] = await db<Array<{ calendar_uri: string | null }>>`
    SELECT calendar_uri FROM organizations WHERE id = ${orgId}
  `;
  return row?.calendar_uri ?? null;
}

/**
 * The org's calendar uri, or null when never provisioned. Read paths use this
 * to render an empty state rather than creating a calendar as a side effect of
 * someone opening a page.
 */
export async function getOrgCalendarUri(orgId: string): Promise<string | null> {
  return readCalendarUri(orgId);
}

export async function getOrgCalendar(orgId: string): Promise<OrgCalendar | null> {
  const [row] = await db<Array<{ calendar_uri: string | null; calendar_synced_at: string | null }>>`
    SELECT calendar_uri, calendar_synced_at FROM organizations WHERE id = ${orgId}
  `;
  if (!row?.calendar_uri) return null;
  return { orgId, uri: row.calendar_uri, syncedAt: row.calendar_synced_at };
}

/**
 * Idempotent create. Safe to call on every provisioning run.
 *
 * The uri is derived from the org id rather than its display name: ids are
 * already slug-shaped and stable, whereas a rename would otherwise orphan the
 * collection. Returns the uri so callers don't re-read.
 */
export async function ensureOrgCalendar(orgId: string): Promise<string> {
  const existing = await readCalendarUri(orgId);
  if (existing) {
    await syncOrgCalendarShares(orgId);
    return existing;
  }

  const [org] = await db<Array<{ name: string }>>`
    SELECT name FROM organizations WHERE id = ${orgId}
  `;
  if (!org) throw new OrgCalendarScopeError(`Unknown organization: ${orgId}`);

  const uri = orgId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  await ensureCalendarExists(
    client(),
    uri,
    org.name,
    `Events and meetings published by ${org.name}.`
  );

  await db`
    UPDATE organizations
    SET calendar_uri = ${uri}, calendar_synced_at = NOW()
    WHERE id = ${orgId}
  `;

  await syncOrgCalendarShares(orgId);
  return uri;
}

/** Every uid this org's members have on Nextcloud. The membership authority. */
async function wantedUids(orgId: string): Promise<string[]> {
  const rows = await db<Array<{ nextcloud_user_id: string }>>`
    SELECT DISTINCT u.nextcloud_user_id
    FROM user_organizations uo
    JOIN users u ON u.id = uo.user_id
    WHERE uo.org_id = ${orgId}
      AND u.nextcloud_user_id IS NOT NULL
  `;
  return rows.map((r) => r.nextcloud_user_id);
}

/**
 * Reconcile who the calendar is shared with, in both directions.
 *
 * Both directions matters: granting on join but never revoking on leave means
 * a former member keeps the org's schedule on their phone indefinitely.
 *
 * A per-user failure warns and continues — one member with a stale
 * `nextcloud_user_id` must not stop everyone else from being granted access.
 */
export async function syncOrgCalendarShares(orgId: string): Promise<void> {
  const uri = await readCalendarUri(orgId);
  if (!uri) return;

  const nc = client();
  const wanted = new Set(await wantedUids(orgId));

  let current: string[];
  try {
    current = await listCalendarShares(nc, uri);
  } catch (error) {
    console.error(`[org-calendar] could not read shares for ${orgId}:`, error);
    return;
  }
  const currentSet = new Set(current);

  for (const uid of wanted) {
    if (currentSet.has(uid)) continue;
    try {
      await shareCalendarWithUser(nc, uri, uid);
    } catch (error) {
      console.warn(`[org-calendar] share to ${uid} failed for ${orgId}:`, error);
    }
  }

  for (const uid of current) {
    if (wanted.has(uid)) continue;
    try {
      await unshareCalendarWithUser(nc, uri, uid);
    } catch (error) {
      console.warn(`[org-calendar] unshare of ${uid} failed for ${orgId}:`, error);
    }
  }

  await db`
    UPDATE organizations SET calendar_synced_at = NOW() WHERE id = ${orgId}
  `;
}

/** Turn a thread's recurrence columns into an RRULE, or undefined. */
function toRrule(thread: SchedulableThread): string | undefined {
  if (!thread.recurrence_pattern) return undefined;
  const base = RRULE_BY_PATTERN[thread.recurrence_pattern];
  // CUSTOM has a `recurrence_custom_rule` column that nothing has ever
  // written. Emitting a guess would be worse than emitting a single event.
  if (!base) return undefined;
  if (!thread.recurrence_until) return base;
  const until = new Date(thread.recurrence_until)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  return `${base};UNTIL=${until}`;
}

/**
 * Push one thread into the org's calendar.
 *
 * The CalDAV UID is the thread id, so this is an upsert: re-pushing an edited
 * thread replaces the same .ics rather than accumulating duplicates.
 */
export async function pushThreadToCalendar(
  orgId: string,
  threadId: string
): Promise<boolean> {
  const uri = await readCalendarUri(orgId);
  if (!uri) throw new OrgCalendarScopeError(`${orgId} has no calendar`);

  // Rule 2: the thread must belong to this org. Without this a caller could
  // name any thread id and have the service account publish it here.
  const [thread] = await db<SchedulableThread[]>`
    SELECT id, title, body, location, scheduled_at, duration_minutes,
           meeting_url, recurrence_pattern, recurrence_until,
           reminder_minutes_before
    FROM threads
    WHERE id = ${threadId} AND org_id = ${orgId}
  `;
  if (!thread) {
    throw new OrgCalendarScopeError(`Thread ${threadId} is not in ${orgId}`);
  }
  // Undated threads are not calendar entries. Not an error — a draft event
  // without a date is a normal state.
  if (!thread.scheduled_at) return false;

  const start = new Date(thread.scheduled_at);
  const minutes = thread.duration_minutes ?? 60;
  const event: CalendarEvent = {
    id: thread.id,
    summary: thread.title,
    start,
    end: new Date(start.getTime() + minutes * 60_000),
    status: 'CONFIRMED',
  };
  if (thread.body) event.description = stripHtml(thread.body).slice(0, 2000);
  if (thread.location) event.location = thread.location;
  if (thread.meeting_url) event.url = thread.meeting_url;
  const rrule = toRrule(thread);
  if (rrule) event.recurrence = rrule;
  if (thread.reminder_minutes_before) {
    event.reminders = [thread.reminder_minutes_before];
  }

  await createCalendarEvent(client(), event, uri);
  await db`
    UPDATE threads SET nextcloud_last_sync = NOW() WHERE id = ${threadId}
  `;
  return true;
}

/** Remove a thread's event — for unpublishing or deleting. */
export async function removeThreadFromCalendar(
  orgId: string,
  threadId: string
): Promise<void> {
  const uri = await readCalendarUri(orgId);
  if (!uri) return;
  try {
    await deleteCalendarEvent(client(), threadId, uri);
  } catch (error) {
    // Already gone is the desired end state, not a failure.
    console.warn(`[org-calendar] delete ${threadId} from ${orgId}:`, error);
  }
}

/**
 * Push every published, dated thread. The reconciliation entry point, for a
 * provisioning script or an admin "resync" button.
 */
export async function syncOrgCalendarEvents(orgId: string): Promise<number> {
  const uri = await readCalendarUri(orgId);
  if (!uri) return 0;

  const rows = await db<Array<{ id: string }>>`
    SELECT id FROM threads
    WHERE org_id = ${orgId}
      AND kind = ANY(${SCHEDULED_KINDS as unknown as string[]})
      AND status = 'published'
      AND scheduled_at IS NOT NULL
  `;

  let pushed = 0;
  for (const row of rows) {
    try {
      if (await pushThreadToCalendar(orgId, row.id)) pushed++;
    } catch (error) {
      console.warn(`[org-calendar] push ${row.id} failed:`, error);
    }
  }

  await db`
    UPDATE organizations SET calendar_synced_at = NOW() WHERE id = ${orgId}
  `;
  return pushed;
}

/**
 * The subscription URL a member pastes into a desktop or phone client.
 *
 * Deliberately built from NEXTCLOUD_PUBLIC_URL: NEXTCLOUD_URL is the
 * container-internal address in this deployment, so a URL built from it looks
 * right and resolves nowhere outside Docker.
 */
export function getCalendarSubscriptionUrl(uri: string): string | null {
  const base = process.env.NEXTCLOUD_PUBLIC_URL || process.env.NEXT_PUBLIC_NEXTCLOUD_URL;
  const account = process.env.NEXTCLOUD_ADMIN_USER;
  if (!base || !account) return null;
  return `${base.replace(/\/$/, '')}/remote.php/dav/calendars/${encodeURIComponent(
    account
  )}/${encodeURIComponent(uri)}/`;
}

/**
 * Dated threads for a calendar view, org-scoped.
 *
 * Lives here rather than in each app because it is the same query every hub
 * calendar needs, and the first app to need it had already written an
 * app-local copy — which is how the network ended up with five of everything
 * else. Nothing about it is org-specific beyond the parameter.
 *
 * Recurring threads are returned whenever their SERIES could still be running,
 * not only when `scheduled_at` itself lands inside the window: a weekly
 * meeting that started in March belongs on September's grid. The caller
 * expands them with `occurrencesByDay` from @elkdonis/utils.
 */
export interface OrgCalendarEvent {
  id: string;
  title: string;
  slug: string;
  kind: string;
  scheduledAt: string | null;
  durationMinutes: number | null;
  location: string | null;
  format: string | null;
  meetingUrl: string | null;
  talkToken: string | null;
  coverImageUrl: string | null;
  recurrencePattern: string | null;
  section: string | null;
  isRsvpEnabled: boolean;
  attendeeLimit: number | null;
  rsvpCount: number;
}

export async function listOrgEventsInRange(
  orgId: string,
  from: Date,
  to: Date,
  limit = 200
): Promise<OrgCalendarEvent[]> {
  try {
    const rows = await db<
      Array<{
        id: string;
        title: string;
        slug: string;
        kind: string;
        scheduled_at: string | null;
        duration_minutes: number | null;
        location: string | null;
        format: string | null;
        meeting_url: string | null;
        nextcloud_talk_token: string | null;
        cover_image_url: string | null;
        recurrence_pattern: string | null;
        section: string | null;
        is_rsvp_enabled: boolean;
        attendee_limit: number | null;
        rsvp_count: number;
      }>
    >`
      SELECT t.id, t.title, t.slug, t.kind, t.scheduled_at, t.duration_minutes,
             t.location, t.format, t.meeting_url, t.nextcloud_talk_token,
             t.recurrence_pattern, t.section, t.is_rsvp_enabled, t.attendee_limit,
             t.metadata->>'coverImageUrl' AS cover_image_url,
             (SELECT COUNT(*)::int FROM thread_rsvps r
               WHERE r.thread_id = t.id AND r.status = 'yes') AS rsvp_count
      FROM threads t
      WHERE t.org_id = ${orgId}
        AND t.status = 'published'
        AND t.kind = ANY(${SCHEDULED_KINDS as unknown as string[]})
        AND t.scheduled_at IS NOT NULL
        AND t.scheduled_at < ${to.toISOString()}
        AND (t.recurrence_pattern IS NOT NULL
             OR t.scheduled_at >= ${from.toISOString()})
      ORDER BY t.scheduled_at ASC
      LIMIT ${limit}
    `;

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      kind: row.kind,
      scheduledAt: row.scheduled_at,
      durationMinutes: row.duration_minutes,
      location: row.location,
      format: row.format,
      meetingUrl: row.meeting_url,
      talkToken: row.nextcloud_talk_token,
      coverImageUrl: row.cover_image_url,
      recurrencePattern: row.recurrence_pattern,
      section: row.section,
      isRsvpEnabled: row.is_rsvp_enabled,
      attendeeLimit: row.attendee_limit,
      rsvpCount: row.rsvp_count,
    }));
  } catch (error) {
    // Fail-soft: an empty calendar is legible, a 500 on the hub is not.
    console.error(`[org-calendar] listOrgEventsInRange ${orgId}:`, error);
    return [];
  }
}

// ─── The standing meeting ────────────────────────────────────────────────────

export type StandingMeetingSource = 'flagged' | 'weekly' | 'next';

export interface StandingMeeting {
  event: OrgCalendarEvent;
  /** The occurrence a member is looking at now, not the series' first date. */
  at: Date;
  /**
   * Why this one. `flagged` = an editor chose it; `weekly` = inferred from a
   * weekly series; `next` = simply the soonest thing coming up. Callers use
   * this to decide whether to call it "the weekly meeting", which is only
   * honest for the first two.
   */
  source: StandingMeetingSource;
}

/** `site_config` key holding `{ threadId }`. */
const STANDING_KEY = 'standing_meeting';

/**
 * The org's standing meeting — the one thing a member opens the hub to check.
 *
 * Flag first, inference second. An editor can pin a thread with
 * `setStandingMeeting`, and that choice wins for as long as the thread is
 * published and still has an upcoming occurrence. Without a flag this falls
 * back to a weekly series, and failing that the soonest upcoming occurrence —
 * so a site that never flags anything still gets a useful tile.
 *
 * That ordering matters because the two candidates disagree: on a site whose
 * standing gathering is monthly, "the next weekly thing" is the wrong answer,
 * and only a person can say which one the hub should lead with.
 *
 * Occurrences are expanded rather than read off `scheduled_at`: a recurring
 * row keeps the date of its FIRST occurrence forever, so a weekly meeting
 * started in March would otherwise report March.
 */
export async function getStandingMeeting(
  orgId: string
): Promise<StandingMeeting | null> {
  const now = new Date();
  // Three months: long enough that a monthly series always has a next
  // occurrence in range, short enough to stay one bounded query.
  const horizon = addMonths(startOfMonth(now), 3);

  const events = await listOrgEventsInRange(orgId, now, horizon);
  const upcoming = expandOccurrences(events, now, horizon);
  if (upcoming.length === 0) return null;

  const flaggedId = await readStandingId(orgId);
  if (flaggedId) {
    const match = upcoming.find((o) => o.item.id === flaggedId);
    // A flag pointing at something unpublished, deleted, or finished is stale
    // rather than an error: fall through to inference instead of showing an
    // empty tile.
    if (match) return { event: match.item, at: match.at, source: 'flagged' };
  }

  const weekly = upcoming.find((o) => o.item.recurrencePattern === 'WEEKLY');
  if (weekly) return { event: weekly.item, at: weekly.at, source: 'weekly' };

  return { event: upcoming[0].item, at: upcoming[0].at, source: 'next' };
}

/** The flagged thread id, or null. */
export async function getStandingMeetingId(orgId: string): Promise<string | null> {
  return readStandingId(orgId);
}

async function readStandingId(orgId: string): Promise<string | null> {
  try {
    const [row] = await db<Array<{ value: { threadId?: string } | null }>>`
      SELECT value FROM site_config
      WHERE org_id = ${orgId} AND key = ${STANDING_KEY}
    `;
    const id = row?.value?.threadId;
    return typeof id === 'string' && id ? id : null;
  } catch (error) {
    console.error(`[org-calendar] readStandingId ${orgId}:`, error);
    return null;
  }
}

/**
 * Flag a thread as the org's standing meeting, or clear it with null.
 *
 * The caller must have established that the viewer may edit the org, and that
 * the thread belongs to it — this writes what it is told.
 */
export async function setStandingMeeting(
  orgId: string,
  threadId: string | null
): Promise<void> {
  if (!threadId) {
    await db`
      DELETE FROM site_config WHERE org_id = ${orgId} AND key = ${STANDING_KEY}
    `;
    return;
  }

  await db`
    INSERT INTO site_config (org_id, key, value)
    VALUES (${orgId}, ${STANDING_KEY}, ${db.json({ threadId } as never)})
    ON CONFLICT (org_id, key) DO UPDATE
      SET value = ${db.json({ threadId } as never)}, updated_at = NOW()
  `;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

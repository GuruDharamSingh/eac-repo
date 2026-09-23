import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import {
  deleteCalendarObject,
  getAdminClient,
  listCalendarObjects,
  listCalendarShareAccess,
  shareCalendarWithUser,
  type CalendarObject,
} from '@elkdonis/nextcloud';
import { createThread } from './posts';
import {
  getOrgCalendarUri,
  pushThreadToCalendar,
  SCHEDULED_KINDS,
  syncOrgCalendarShares,
} from './org-calendar';

// ============================================================================
// The org calendar, kept in step with Nextcloud IN BOTH DIRECTIONS.
//
// `threads` stays the record — the hub reads Postgres, never CalDAV. What
// changed (2026-09-21, owner: "let the Nextcloud calendar be synced with the
// calendar on the /hub") is that the Nextcloud side is no longer write-only:
//
//   ONE KEY. Every event in an org calendar is keyed by a hub thread id (the
//   push has always used the thread id as the CalDAV UID). An event someone
//   ADDS in Nextcloud is imported as a thread and then ADOPTED: re-written
//   under the new thread's id and the original object removed. After one sync
//   there is no second vocabulary to keep in step.
//
//   VISIBILITY IS THE HUB'S. A thread that is archived, a draft, waiting on a
//   moderator, or gone, has no event in Nextcloud. Until this file, archiving
//   a meeting left it on everyone's phone indefinitely (IFAC had four such).
//
//   EDITS GO WHICHEVER WAY WAS LAST. `threads.nextcloud_last_sync` is when the
//   hub last wrote the event. Nextcloud's LAST-MODIFIED after that means a
//   person changed it there, so the hub takes the change; a thread updated
//   after it means the hub changed, so it is pushed. Fields are compared
//   before writing, so a sync that finds nothing different writes nothing.
//
//   DELETED IN NEXTCLOUD archives the thread (never deletes it). Only owners
//   and guides can write the calendar in Nextcloud — see syncEditorWriteAccess
//   — so a deletion there is an editorial act, and an archived thread can be
//   put back.
// ============================================================================

/** The window a sync looks at. Wide enough for a year of planning. */
const PAST_DAYS = 60;
const AHEAD_DAYS = 400;
/** Clock slack between Nextcloud and Postgres before "later" counts. */
const SLACK_MS = 10_000;
/** More than this many vanishing in one run reads as a reset, not deletions. */
const MAX_ARCHIVE_PER_RUN = 2;

export interface CalendarSyncReport {
  orgId: string;
  imported: number;
  pulled: number;
  pushed: number;
  removed: number;
  archived: number;
  error?: string;
}

interface ThreadRow {
  id: string;
  kind: string;
  title: string;
  status: string;
  body: string | null;
  location: string | null;
  meeting_url: string | null;
  scheduled_at: Date | null;
  duration_minutes: number | null;
  recurrence_pattern: string | null;
  recurrence_until: Date | null;
  updated_at: Date;
  nextcloud_last_sync: Date | null;
}

const FREQ_TO_PATTERN: Record<string, string> = { DAILY: 'DAILY', WEEKLY: 'WEEKLY', MONTHLY: 'MONTHLY' };

function patternOf(rrule: string | null): { pattern: string | null; until: Date | null } {
  if (!rrule) return { pattern: null, until: null };
  const parts = Object.fromEntries(
    rrule.split(';').map((p) => {
      const [k, v] = p.split('=');
      return [k.toUpperCase(), v];
    })
  );
  // Anything the hub cannot express (every other week, the 3rd Tuesday) stays
  // a one-off here rather than being turned into a WRONG repetition.
  if (parts.INTERVAL && parts.INTERVAL !== '1') return { pattern: null, until: null };
  if (parts.BYSETPOS || (parts.FREQ === 'MONTHLY' && parts.BYDAY)) return { pattern: null, until: null };
  const pattern = FREQ_TO_PATTERN[parts.FREQ ?? ''] ?? null;
  let until: Date | null = null;
  if (pattern && parts.UNTIL) {
    const m = parts.UNTIL.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/);
    if (m) until = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 23), +(m[5] ?? 59), +(m[6] ?? 59)));
  }
  return { pattern, until };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Who an imported event is attributed to: the org's first owner, else a guide. */
async function orgSteward(orgId: string): Promise<string | null> {
  const [row] = await db<Array<{ user_id: string }>>`
    SELECT user_id FROM user_organizations
    WHERE org_id = ${orgId} AND role IN ('owner', 'guide')
    ORDER BY (role = 'owner') DESC, joined_at ASC NULLS LAST
    LIMIT 1
  `;
  return row?.user_id ?? null;
}

/** A UID minted by a calendar client rather than by the hub. See step 1. */
function isClientUid(uid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(uid) || uid.includes('@');
}

/** Whether a thread has an occurrence inside the window a sync can see. */
function inWindow(t: ThreadRow, from: Date, to: Date): boolean {
  if (!t.scheduled_at) return false;
  const start = new Date(t.scheduled_at);
  if (!t.recurrence_pattern) return start >= from && start <= to;
  if (start > to) return false;
  return !t.recurrence_until || new Date(t.recurrence_until) >= from;
}

/**
 * Bring an org's Nextcloud calendar and its dated threads into line.
 * Safe to run repeatedly; a run that finds nothing to do writes nothing.
 */
export async function reconcileOrgCalendar(
  orgId: string,
  opts: { dryRun?: boolean } = {}
): Promise<CalendarSyncReport> {
  const report: CalendarSyncReport = { orgId, imported: 0, pulled: 0, pushed: 0, removed: 0, archived: 0 };
  // Dry run: count what WOULD happen, write nothing — for previewing a first
  // sync against live calendars before letting the scheduler act.
  const dry = Boolean(opts.dryRun);
  const detail: string[] = [];
  const uri = await getOrgCalendarUri(orgId);
  if (!uri) return report;

  const nc = getAdminClient();
  const from = new Date(Date.now() - PAST_DAYS * 86_400_000);
  const to = new Date(Date.now() + AHEAD_DAYS * 86_400_000);

  // An outage must not read as "everything was deleted" — so a failed read
  // stops the run rather than proceeding with an empty list.
  let objects: CalendarObject[];
  try {
    objects = await listCalendarObjects(nc, uri, from, to);
  } catch (err) {
    report.error = `could not read the calendar: ${(err as Error).message}`;
    return report;
  }
  const objectByUid = new Map(objects.map((o) => [o.uid, o]));

  const threads = await db<ThreadRow[]>`
    SELECT id, kind, title, status, body, location, meeting_url, scheduled_at, duration_minutes,
           recurrence_pattern, recurrence_until, updated_at, nextcloud_last_sync
    FROM threads
    WHERE org_id = ${orgId}
      AND kind = ANY(${SCHEDULED_KINDS as unknown as string[]})
  `;
  const threadById = new Map(threads.map((t) => [t.id, t]));

  // ── 1. what is in Nextcloud ────────────────────────────────────────────────
  for (const obj of objects) {
    const thread = threadById.get(obj.uid);
    const cancelled = obj.status?.toUpperCase() === 'CANCELLED';

    if (!thread) {
      // Not a thread of this org. Either someone added it in Nextcloud (import
      // and adopt it), or it is an ORPHAN — an event the hub pushed for a
      // thread that no longer exists. Telling them apart by the UID: every
      // calendar client mints a UUID (Nextcloud's web app, phones,
      // Thunderbird) or a `…@domain` id (Google, Outlook); the hub's UIDs are
      // thread ids, which are neither. Importing an orphan would resurrect a
      // deleted meeting as a "new event from Nextcloud".
      if (!isClientUid(obj.uid)) {
        if (!dry) await deleteCalendarObject(nc, obj.href).catch(() => {});
        report.removed++;
        detail.push(`remove orphan ${obj.uid} "${obj.summary}"`);
        continue;
      }
      if (cancelled || obj.instances.length === 0) continue;
      if (dry) {
        report.imported++;
        detail.push(`import "${obj.summary}"`);
        continue;
      }
      const imported = await importObject(orgId, obj);
      if (imported) report.imported++;
      continue;
    }

    // The hub decides whether it is visible at all.
    if (thread.status !== 'published' || !thread.scheduled_at) {
      if (!dry) await deleteCalendarObject(nc, obj.href).catch(() => {});
      report.removed++;
      detail.push(`remove ${thread.status} "${thread.title}"`);
      continue;
    }

    // Cancelled in Nextcloud is a deletion there.
    if (cancelled) {
      if (!dry) {
        await archiveFromNextcloud(orgId, thread.id);
        await deleteCalendarObject(nc, obj.href).catch(() => {});
      }
      report.archived++;
      detail.push(`archive (cancelled there) "${thread.title}"`);
      continue;
    }

    // Which side changed since the hub last wrote the event? When BOTH did —
    // including the common case of an event pushed before the hub recorded
    // push times (lastPush 0) — the later edit wins. Without this, amrit's
    // 4AM Yoga, moved on the hub to Oct 17, would have been dragged back to
    // the stale Aug 15 copy sitting in Nextcloud.
    const lastPush = thread.nextcloud_last_sync ? new Date(thread.nextcloud_last_sync).getTime() : 0;
    const modifiedThere = obj.lastModified?.getTime() ?? 0;
    const modifiedHere = new Date(thread.updated_at).getTime();
    const changedThere = modifiedThere > lastPush + SLACK_MS;
    const changedHere = modifiedHere > lastPush + 1_000;
    const editedThere = changedThere && (!changedHere || modifiedThere > modifiedHere + SLACK_MS);
    if (editedThere) {
      if (dry) {
        detail.push(`maybe pull "${thread.title}"`);
      } else if (await pullObject(thread, obj)) {
        report.pulled++;
        continue;
      }
    }

    const editedHere = changedHere;
    if (editedHere) {
      if (dry) {
        report.pushed++;
        detail.push(`push "${thread.title}"`);
      } else if (await pushThreadToCalendar(orgId, thread.id).catch(() => false)) report.pushed++;
    }
  }

  // ── 2. what the hub has that Nextcloud does not ────────────────────────────
  const missing = threads.filter(
    (t) =>
      t.status === 'published' &&
      t.scheduled_at &&
      !objectByUid.has(t.id) &&
      inWindow(t, from, to) // not visible to this read — say nothing
  );
  const vanished = missing.filter((t) => t.nextcloud_last_sync);
  // THE VALVE. One or two events gone is a guide deleting them in Nextcloud.
  // More than that at once is almost certainly a calendar that was reset or
  // re-created — and archiving on that reading would take an org's whole
  // schedule off its hub. Put them back instead, and say so.
  const massVanish = vanished.length > MAX_ARCHIVE_PER_RUN;
  if (massVanish) {
    report.error = `${vanished.length} published events missing from Nextcloud at once — re-pushed, not archived`;
  }

  for (const thread of missing) {
    if (thread.nextcloud_last_sync && !massVanish) {
      // It WAS in Nextcloud and is not any more: somebody deleted it there.
      if (!dry) await archiveFromNextcloud(orgId, thread.id);
      report.archived++;
      detail.push(`archive (deleted there) "${thread.title}"`);
    } else if (dry) {
      report.pushed++;
      detail.push(`push missing "${thread.title}"`);
    } else if (await pushThreadToCalendar(orgId, thread.id).catch(() => false)) {
      report.pushed++;
    }
  }

  if (dry) {
    (report as CalendarSyncReport & { detail?: string[] }).detail = detail;
    return report;
  }
  await db`UPDATE organizations SET calendar_synced_at = NOW() WHERE id = ${orgId}`;
  return report;
}

/**
 * An event someone made in Nextcloud becomes a hub event, then takes the
 * thread's id as its own: pushed under that id, original removed.
 */
async function importObject(orgId: string, obj: CalendarObject): Promise<boolean> {
  const authorId = await orgSteward(orgId);
  if (!authorId) {
    console.warn(`[org-calendar-sync] ${orgId}: no owner or guide to attribute "${obj.summary}" to`);
    return false;
  }
  const first = obj.instances[0];
  const { pattern, until } = patternOf(obj.rrule);
  const minutes = Math.max(15, Math.round((first.end.getTime() - first.start.getTime()) / 60_000));

  const thread = await createThread({
    kind: pattern ? 'meeting' : 'event',
    orgId,
    authorId,
    title: obj.summary.slice(0, 200),
    body: obj.description ? `<p>${escapeHtml(obj.description).replace(/\n/g, '<br>')}</p>` : undefined,
    status: 'published',
    // It came from the org's own calendar, which only members can see — so it
    // stays members-only until a guide chooses to make it public.
    visibility: 'ORGANIZATION',
    scheduledAt: first.start.toISOString(),
    durationMinutes: minutes,
    location: obj.location ?? null,
    meetingUrl: obj.url ?? null,
    isRsvpEnabled: true,
    metadata: { source: 'nextcloud', importedAt: new Date().toISOString(), originalUid: obj.uid },
  } as never);

  if (pattern) {
    await db`
      UPDATE threads SET recurrence_pattern = ${pattern}, recurrence_until = ${until}
      WHERE id = ${thread.id}
    `;
  }

  // Adopt: write it under the thread id first, THEN remove the original, so a
  // failure between the two leaves a duplicate for the next run to settle,
  // never a hole.
  const pushed = await pushThreadToCalendar(orgId, thread.id).catch(() => false);
  if (pushed) await deleteCalendarObject(getAdminClient(), obj.href).catch(() => {});

  await logCalendarEvent(orgId, authorId, 'calendar_imported', thread.id, { from: obj.uid, title: obj.summary });
  return true;
}

/** Take a change made in Nextcloud. Returns whether anything was different. */
async function pullObject(thread: ThreadRow, obj: CalendarObject): Promise<boolean> {
  const first = obj.instances[0];
  if (!first) return false;
  const { pattern, until } = patternOf(obj.rrule);

  // For a repeating thread the anchor is its FIRST date, which may be long
  // before the window — so only its time of day and weekday are compared,
  // by testing whether Nextcloud's next instance is one the thread produces.
  const current = thread.scheduled_at ? new Date(thread.scheduled_at) : null;
  let scheduledAt = first.start;
  if (thread.recurrence_pattern && current && pattern === thread.recurrence_pattern) {
    const sameSlot =
      current.getUTCHours() === first.start.getUTCHours() &&
      current.getUTCMinutes() === first.start.getUTCMinutes() &&
      (pattern !== 'WEEKLY' || current.getUTCDay() === first.start.getUTCDay());
    if (sameSlot) scheduledAt = current;
  }
  const minutes = Math.max(15, Math.round((first.end.getTime() - first.start.getTime()) / 60_000));

  const next = {
    title: obj.summary.slice(0, 200),
    location: obj.location ?? null,
    scheduled_at: scheduledAt,
    duration_minutes: minutes,
    recurrence_pattern: pattern,
    recurrence_until: until,
  };
  const same =
    next.title === thread.title &&
    (next.location ?? null) === (thread.location ?? null) &&
    (current?.getTime() ?? 0) === next.scheduled_at.getTime() &&
    (thread.duration_minutes ?? 60) === next.duration_minutes &&
    (thread.recurrence_pattern ?? null) === next.recurrence_pattern;
  if (same) {
    // Nothing that matters changed (a client re-saved it, or touched a field
    // the hub does not hold) — record that we have seen it, and move on.
    await db`UPDATE threads SET nextcloud_last_sync = NOW() WHERE id = ${thread.id}`;
    return false;
  }

  await db`
    UPDATE threads SET
      title = ${next.title},
      location = ${next.location},
      scheduled_at = ${next.scheduled_at},
      duration_minutes = ${next.duration_minutes},
      recurrence_pattern = ${next.recurrence_pattern},
      recurrence_until = ${next.recurrence_until},
      updated_at = NOW(),
      nextcloud_last_sync = NOW()
    WHERE id = ${thread.id}
  `;
  await logCalendarEvent(
    (await db<Array<{ org_id: string }>>`SELECT org_id FROM threads WHERE id = ${thread.id}`)[0]?.org_id ?? '',
    null,
    'calendar_pulled',
    thread.id,
    { title: next.title }
  );
  return true;
}

/** Deleted in Nextcloud → archived on the hub, recoverably, and logged. */
async function archiveFromNextcloud(orgId: string, threadId: string): Promise<void> {
  await db`
    UPDATE threads SET status = 'archived', updated_at = NOW()
    WHERE id = ${threadId} AND status = 'published'
  `;
  await logCalendarEvent(orgId, null, 'content_hidden', threadId, { via: 'nextcloud-calendar' });
}

async function logCalendarEvent(
  orgId: string,
  userId: string | null,
  action: string,
  threadId: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    // `events.user_id` is NOT NULL. A change that arrived from Nextcloud has
    // no hub user behind it, so it is logged against the org's steward — the
    // same person an imported event is attributed to — with `via` saying so.
    const actor = userId ?? (await orgSteward(orgId));
    if (!actor) return;
    await db`
      INSERT INTO events (id, org_id, user_id, action, resource_type, resource_id, data, created_at)
      VALUES (${nanoid()}, ${orgId}, ${actor}, ${action}, 'post', ${threadId},
              ${db.json({ ...data, via: data.via ?? 'nextcloud-calendar' } as never)}, NOW())
    `;
  } catch (err) {
    console.error('[org-calendar-sync] log:', err);
  }
}

/**
 * Owners and guides may WRITE the org calendar from Nextcloud (so something
 * added there reaches the hub); members read it. Re-applied every run because
 * a person's role changes on the hub, and a share's level only changes when
 * it is set again.
 */
export async function syncEditorWriteAccess(orgId: string): Promise<void> {
  const uri = await getOrgCalendarUri(orgId);
  if (!uri) return;
  const editors = await db<Array<{ nextcloud_user_id: string }>>`
    SELECT DISTINCT u.nextcloud_user_id
    FROM user_organizations uo JOIN users u ON u.id = uo.user_id
    WHERE uo.org_id = ${orgId} AND uo.role IN ('owner', 'guide') AND u.nextcloud_user_id IS NOT NULL
  `;
  const nc = getAdminClient();
  // Only the ones that are NOT already read-write. This used to re-send a
  // share for every editor of every org on every 3-minute tick, which ran the
  // service account into Nextcloud's per-hour limit on share requests
  // ("Too many addressbook or calendar share requests") and blocked ALL
  // calendar sharing network-wide until the window passed (2026-09-21).
  let access: Map<string, 'read' | 'read-write'>;
  try {
    access = await listCalendarShareAccess(nc, uri);
  } catch (err) {
    console.warn(`[org-calendar-sync] read shares on ${orgId}:`, (err as Error).message);
    return;
  }
  for (const e of editors) {
    if (access.get(e.nextcloud_user_id) === 'read-write') continue;
    try {
      await shareCalendarWithUser(nc, uri, e.nextcloud_user_id, true);
    } catch (err) {
      console.warn(`[org-calendar-sync] write share ${e.nextcloud_user_id} on ${orgId}:`, (err as Error).message);
    }
  }
}

// ── scheduling ───────────────────────────────────────────────────────────────

const STALE_MS = 2 * 60_000;
const running = new Map<string, Promise<CalendarSyncReport>>();

/** One run per org at a time, however many callers ask. */
function runOnce(orgId: string): Promise<CalendarSyncReport> {
  const inFlight = running.get(orgId);
  if (inFlight) return inFlight;
  const p = reconcileOrgCalendar(orgId)
    .catch((err) => ({ orgId, imported: 0, pulled: 0, pushed: 0, removed: 0, archived: 0, error: String(err) }))
    .finally(() => running.delete(orgId));
  running.set(orgId, p);
  return p;
}

/**
 * Reconcile if the last run is older than two minutes — what a hub calls when
 * its calendar is opened, so a change made in Nextcloud a moment ago is there.
 * Bounded: a slow Nextcloud costs the freshness, never the page.
 */
export async function syncOrgCalendarIfStale(orgId: string, waitMs = 2_500): Promise<void> {
  const [row] = await db<Array<{ calendar_uri: string | null; calendar_synced_at: Date | null }>>`
    SELECT calendar_uri, calendar_synced_at FROM organizations WHERE id = ${orgId}
  `;
  if (!row?.calendar_uri) return;
  const age = row.calendar_synced_at ? Date.now() - new Date(row.calendar_synced_at).getTime() : Infinity;
  if (age < STALE_MS) return;
  await Promise.race([runOnce(orgId), new Promise((r) => setTimeout(r, waitMs))]);
}

/** Every org with a calendar — the scheduler's tick. One host runs it. */
export async function runOrgCalendarSyncTick(): Promise<CalendarSyncReport[]> {
  const orgs = await db<Array<{ id: string }>>`
    SELECT id FROM organizations WHERE calendar_uri IS NOT NULL ORDER BY id
  `;
  const reports: CalendarSyncReport[] = [];
  for (const org of orgs) {
    // Members first (read), then editors (read-write). Both send a share only
    // for someone missing or at the wrong level — see the note in
    // syncEditorWriteAccess about Nextcloud's per-hour share limit. Before
    // this, a new member was only ever given the calendar when the calendar
    // itself was first created, so anyone who joined later never got it.
    await syncOrgCalendarShares(org.id).catch(() => {});
    await syncEditorWriteAccess(org.id).catch(() => {});
    reports.push(await runOnce(org.id));
  }
  return reports;
}

import { db } from '@elkdonis/db';
import { createThread } from './posts';
import { canModerateOrg } from './moderation';
import { getOrgFeed } from './org-feeds';
import { PERSONAL_ORG_ID } from './thread-listing';
import { SERIES_KIND, SERIES_SESSION_KIND } from './thread-kinds';
import { removeThreadAs } from './thread-admin';
import { ensureOrgCalendar, getOrgCalendarUri, pushThreadToCalendar } from './org-calendar';
import {
  SeriesError,
  cancelSeriesSession,
  ensureSeriesTalkRoom,
  isSeriesOccurrence,
  publishSeriesSession,
  saveSeriesSchedule,
  saveSeriesSession,
  seriesCoverOf,
  seriesLocalToInstant,
  validTimeZone,
  type SeriesClock,
} from './meeting-series';
import { saveSeriesPageSettings } from './series-page';
import { audienceToStorage } from './thread-audience';

// ============================================================================
// A NEW meeting series from the publication forms (pass 2, 2026-11-08).
// Contract: docs/open/publishing-forms-handoff/PLAN.md §12.
//
// The form is a gathering that repeats weekly and is "presented as a series".
// An existing series is edited in its planner, never here: this file only
// makes series. A series draft the form saved earlier is REBUILT on the next
// explicit save (archived, and a fresh draft takes its place), because every
// series service reads published rows only (meeting-series.ts loadSeries), so
// none of them can edit a draft.
//
// What a draft is: the series thread (kind `series`, status `draft`) with the
// whole row in place (first session, WEEKLY, exclusive end, zone, interval,
// cover, lede, join link), the same columns IFAC's createSeries writes. The
// weeks the person typed (titles, notes, skips) and the Series page choices
// wait in `metadata.forms` (PLAN §3: design keys live under metadata.forms),
// because a week can only be materialised on a published series.
//
// Publish, in order:
//   1. flip      one UPDATE: status published, but HIDDEN while it fills:
//                visibility INVITE_ONLY, share_to_network off, listed and
//                landing off. Not featured, not on the calendar yet.
//   2. schedule  saveSeriesSchedule (its own transaction): recomputes the
//                first session and the end from the schedule strings, sets
//                numberOffset and the interval.
//   3. weeks     per typed week: saveSeriesSession (title, note → subtitle),
//                then cancelSeriesSession for a skip, else publishSeriesSession
//                for a titled week. Each call is its own short write.
//   4. go-live   one transaction: the series takes the chosen audience
//                (audienceToStorage: everyone = PUBLIC; members = INVITE_ONLY +
//                min_role member), share_to_network and listed / landing as
//                asked, metadata.forms dropped; and the week threads step 3
//                made take the same audience. (Since cc440377 a week thread
//                copies its series' audience when it is made, which in step 3
//                is the hidden INVITE_ONLY one, so go-live sets theirs too.)
//   5. extras    best-effort, reported as warnings, never undone: the Talk
//                room (after go-live: a draft or a hidden series makes no
//                public room), featuring on the Series page, the calendar (an
//                everyone series only: the shared calendar never carries an
//                INVITE_ONLY thread, org-calendar.ts pushThreadToCalendar).
//
// How atomic: the existing functions each write with the global `db` (no
// transaction can be passed in), so steps 1–4 are NOT one transaction. What
// holds instead:
//   - everything that can be refused is checked before the first write;
//   - the series row is created in this same call, so everything attached to
//     it was made by this call;
//   - if step 1, 2, 3 or 4 fails, ONE transaction undoes it: the week threads
//     this series made are archived, its series_sessions rows and notes are
//     deleted, and the row goes back to an unlisted draft. The result is
//     `ok` with that draft and `notPublished`, so the form keeps its id;
//   - between 1 and 4 (a few queries) the row is published but INVITE_ONLY and
//     unlisted, which the feeds, forum and search predicates filter out
//     (thread-kinds.ts header). getMeetingSeries does not check visibility, so
//     someone who already knew the slug could open it in that window;
//   - if the undo itself fails (the database went away mid-publish), the
//     series is left published but hidden (members-only, unlisted), never
//     public, and the error says so.
//
// Who may: an owner or guide of the org (canModerateOrg), not the personal
// org: the same rule as a new meeting (meeting-content.ts
// meetingComposeContext) and the series services' "organisers only".
// ============================================================================

/** Marks a series draft as this form's, so a later save may rebuild it. */
export const SERIES_FORM_ORIGIN = 'series-form';

export type SeriesWhereMode = 'place' | 'link' | 'talk';

export interface SeriesFormSession {
  /** The week's local date, "YYYY-MM-DD", in the series' zone. */
  date: string;
  title?: string | null;
  /** The line under the week's title (the week's `subtitle`). */
  note?: string | null;
  skipped?: boolean;
  /** Not stored by the series services (cancelSeriesSession takes none); kept on a draft only. */
  reason?: string | null;
}

export interface SeriesFormPage {
  /** metadata.series.listed: on the org's Series page. */
  listed: boolean;
  /** metadata.series.landing: in the landing page's slides. */
  slides: boolean;
  /** The org's featured series (site_config presented_series). Replaces the current one. */
  featured: boolean;
}

export interface SeriesFormInput {
  intent: 'draft' | 'published';
  /** A series draft this form saved before: archived, and a fresh draft takes its place. */
  replaces?: string | null;
  title: string;
  /** The lede: threads.excerpt and metadata.series.lede. */
  excerpt?: string | null;
  /** "About the series": threads.body, sanitised. */
  bodyHtml?: string | null;
  coverImageUrl?: string | null;
  schedule: {
    /** "YYYY-MM-DD": the first session. Its weekday is the series' weekday. */
    firstDate: string;
    /** "HH:MM", 24-hour, in `timeZone`. */
    time: string;
    timeZone: string;
    /** The last session's local date, inclusive; null = open-ended. */
    lastDate: string | null;
    durationMinutes: number | null;
    /** Every n weeks, 1–4. */
    intervalWeeks: number;
  };
  /** 'place': threads.location (+ a join link = hybrid); 'link': metadata.joinDetails.url; 'talk': a Talk room on publish. */
  where: { mode: SeriesWhereMode; location?: string | null; joinUrl?: string | null };
  /** Copied onto every week's thread when it is made (ensureSeriesSession). */
  attendeeLimit?: number | null;
  /** org_feeds slug. */
  section?: string | null;
  shareToNetwork?: boolean;
  sessions: SeriesFormSession[];
  page: SeriesFormPage;
  /** "N sessions" as the form counted them; kept on a draft so it reopens counting. Not stored on a published series. */
  repeatCount?: number | null;
  /**
   * Who may see the series and its weeks (thread-audience.ts): 'everyone' (default) or
   * 'members' (INVITE_ONLY + min_role member). Applied at go-live; a draft keeps it in its input.
   */
  audience?: SeriesAudience;
}

export type SeriesAudience = 'everyone' | 'members';

export interface SeriesFormRecord {
  id: string;
  orgId: string;
  kind: 'series';
  isSeries: true;
  slug: string;
  title: string;
  status: 'draft' | 'pending' | 'published' | 'archived';
  authorId: string;
  scheduledAt: string | null;
  recurrenceUntil: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** What the form saved, for a draft this form made; null = it is edited in its planner. */
  input: SeriesFormInput | null;
}

/** Which input a refusal is about, so the form can put it beside the field. */
export type SeriesFormField =
  | 'title'
  | 'firstDate'
  | 'time'
  | 'timeZone'
  | 'lastDate'
  | 'duration'
  | 'intervalWeeks'
  | 'joinUrl'
  | 'location'
  | 'cover'
  | 'attendeeLimit'
  | 'section'
  | 'sessions'
  | 'audience'
  | 'replaces';

export type SeriesPublishStep = 'publish' | 'schedule' | 'sessions' | 'go-live';

export type SeriesFormResult =
  | {
      ok: true;
      value: SeriesFormRecord;
      warnings: string[];
      /** Publish was asked and did not happen: the series is this draft, nothing went public. */
      notPublished: { step: SeriesPublishStep; message: string } | null;
    }
  | { ok: false; error: string; field?: SeriesFormField };

// ── helpers ──────────────────────────────────────────────────────────────────

type Row = {
  id: string;
  org_id: string;
  kind: string;
  slug: string;
  title: string;
  status: string;
  author_id: string;
  scheduled_at: Date | null;
  recurrence_until: Date | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, unknown> | null;
};

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? null : x.toISOString();
}

function clean(v: string | null | undefined, max: number): string | null {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return s ? s : null;
}

function parseDate(value: string | null | undefined): { y: number; mo: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return { y, mo, d };
}

function nextDay(p: { y: number; mo: number; d: number }): string {
  return new Date(Date.UTC(p.y, p.mo - 1, p.d + 1)).toISOString().slice(0, 10);
}

function httpUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function refuse(error: string, field?: SeriesFormField): { ok: false; error: string; field?: SeriesFormField } {
  return field ? { ok: false, error, field } : { ok: false, error };
}

async function readRow(id: string): Promise<Row | null> {
  const [row] = await db<Row[]>`
    SELECT id, org_id, kind, slug, title, status, author_id, scheduled_at, recurrence_until,
           published_at, created_at, updated_at, metadata
    FROM threads WHERE id = ${id} LIMIT 1
  `;
  return row ?? null;
}

function formsOf(row: Row): { origin?: unknown; input?: unknown } {
  const f = (row.metadata ?? {}).forms;
  return f && typeof f === 'object' ? (f as { origin?: unknown; input?: unknown }) : {};
}

function isFormDraft(row: Row): boolean {
  return row.kind === SERIES_KIND && row.status === 'draft' && formsOf(row).origin === SERIES_FORM_ORIGIN;
}

function toRecord(row: Row): SeriesFormRecord {
  const stored = formsOf(row).input;
  return {
    id: row.id,
    orgId: row.org_id,
    kind: 'series',
    isSeries: true,
    slug: row.slug,
    title: row.title,
    status: (['draft', 'pending', 'published', 'archived'].includes(row.status) ? row.status : 'draft') as SeriesFormRecord['status'],
    authorId: row.author_id,
    scheduledAt: iso(row.scheduled_at),
    recurrenceUntil: iso(row.recurrence_until),
    publishedAt: iso(row.published_at),
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
    input: isFormDraft(row) && stored && typeof stored === 'object' ? (stored as SeriesFormInput) : null,
  };
}

async function mayMakeSeries(viewerId: string, orgId: string): Promise<boolean> {
  if (!orgId || orgId === PERSONAL_ORG_ID) return false;
  return canModerateOrg(viewerId, orgId).catch(() => false);
}

// ── the plan: everything checked before the first write ──────────────────────

interface Week {
  date: string;
  /** ISO instant the week meets at: the key every series write takes. */
  at: string;
  title: string | null;
  note: string | null;
  skipped: boolean;
  reason: string | null;
}

interface Plan {
  title: string;
  lede: string | null;
  body: string | null;
  cover: string | null;
  zone: string;
  weekday: number;
  time: string;
  firstDate: string;
  lastDate: string | null;
  duration: number;
  interval: number;
  anchorIso: string;
  untilIso: string | null;
  format: 'in_person' | 'online' | 'hybrid';
  location: string | null;
  joinUrl: string | null;
  talk: boolean;
  attendeeLimit: number | null;
  section: string | null;
  shareToNetwork: boolean;
  weeks: Week[];
  page: SeriesFormPage;
  audience: SeriesAudience;
  /** The audience as columns: visibility + min_role. */
  storage: ReturnType<typeof audienceToStorage>;
  /** The input as stored on the draft (metadata.forms.input). */
  stored: SeriesFormInput;
}

async function planOf(
  orgId: string,
  input: SeriesFormInput
): Promise<{ ok: true; plan: Plan } | { ok: false; error: string; field?: SeriesFormField }> {
  const title = clean(input.title, 200);
  if (!title || title.length < 2) return refuse('Give the series a title.', 'title');

  const s = input.schedule ?? ({} as SeriesFormInput['schedule']);
  const zone = validTimeZone(s.timeZone);
  if (!zone) return refuse('Pick a time zone from the list.', 'timeZone');
  const first = parseDate(s.firstDate);
  if (!first) return refuse('Pick the date of the first session.', 'firstDate');
  const tm = /^(\d{1,2}):(\d{2})$/.exec(String(s.time ?? '').trim());
  if (!tm || Number(tm[1]) > 23 || Number(tm[2]) > 59) return refuse('Write the time as HH:MM.', 'time');
  const time = `${tm[1].padStart(2, '0')}:${tm[2]}`;
  const interval = Number(s.intervalWeeks ?? 1);
  if (!Number.isInteger(interval) || interval < 1 || interval > 4) return refuse('A series meets every 1 to 4 weeks.', 'intervalWeeks');
  const duration = s.durationMinutes === null || s.durationMinutes === undefined ? 60 : Math.round(Number(s.durationMinutes));
  if (!Number.isFinite(duration) || duration < 15 || duration > 600) {
    return refuse('A session lasts between 15 minutes and 10 hours.', 'duration');
  }
  const last = s.lastDate ? parseDate(s.lastDate) : null;
  if (s.lastDate && !last) return refuse('The last date is not a date.', 'lastDate');

  const firstDate = s.firstDate.trim();
  const anchor = seriesLocalToInstant(`${firstDate}T${time}`, zone);
  if (!anchor) return refuse('Pick the date of the first session.', 'firstDate');
  // `recurrence_until` is exclusive: the start of the day after the last date (as saveSeriesSchedule).
  const until = last ? seriesLocalToInstant(`${nextDay(last)}T00:00`, zone) : null;
  if (until && until.getTime() <= anchor.getTime()) return refuse('The last session is before the first.', 'lastDate');
  const clock: SeriesClock = {
    scheduledAt: anchor,
    recurrencePattern: 'WEEKLY',
    recurrenceUntil: until,
    timeZone: zone,
    intervalWeeks: interval,
  };

  const mode: SeriesWhereMode = input.where?.mode === 'link' || input.where?.mode === 'talk' ? input.where.mode : 'place';
  const joinUrl = mode === 'talk' ? null : clean(input.where?.joinUrl, 1000);
  if (mode === 'link' && !joinUrl) return refuse('Paste the link people join from.', 'joinUrl');
  if (joinUrl && !httpUrl(joinUrl)) return refuse('The join link must start with https://', 'joinUrl');
  const location = mode === 'place' ? clean(input.where?.location, 500) : null;
  const format = mode === 'place' ? (joinUrl ? 'hybrid' : 'in_person') : 'online';

  const coverRaw = clean(input.coverImageUrl, 1000);
  const cover = coverRaw ? seriesCoverOf({ url: coverRaw, kind: 'image' }) : null;
  if (coverRaw && !cover) return refuse('The picture needs an address starting with https:// or /.', 'cover');

  const limit = input.attendeeLimit;
  if (limit !== null && limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
    return refuse('The limit is a whole number, at least 1.', 'attendeeLimit');
  }

  const section = clean(input.section, 100);
  if (section) {
    const feed = await getOrgFeed(orgId, section).catch(() => null);
    if (!feed) return refuse('That page does not exist on this site.', 'section');
  }

  const seen = new Set<string>();
  const weeks: Week[] = [];
  for (const raw of Array.isArray(input.sessions) ? input.sessions.slice(0, 260) : []) {
    const date = String(raw?.date ?? '').trim();
    if (!parseDate(date)) return refuse('A session date could not be read.', 'sessions');
    if (seen.has(date)) return refuse(`${date} is listed twice.`, 'sessions');
    seen.add(date);
    const at = seriesLocalToInstant(`${date}T${time}`, zone);
    if (!at || !isSeriesOccurrence(clock, at)) return refuse(`${date} is not a session of this series.`, 'sessions');
    const week: Week = {
      date,
      at: at.toISOString(),
      title: clean(raw.title, 200),
      note: clean(raw.note, 300),
      skipped: raw.skipped === true,
      reason: clean(raw.reason, 500),
    };
    // Only weeks with something on them are kept: an untouched week is the rule's.
    if (week.title || week.note || week.skipped || week.reason) weeks.push(week);
  }
  weeks.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const page: SeriesFormPage = {
    listed: input.page?.listed !== false,
    slides: input.page?.slides === true,
    featured: input.page?.featured === true,
  };
  const lede = clean(input.excerpt, 1000);
  const body = typeof input.bodyHtml === 'string' && input.bodyHtml.trim() ? input.bodyHtml.trim().slice(0, 60_000) : null;
  const shareToNetwork = input.shareToNetwork === true;
  const count = Number(input.repeatCount);
  const repeatCount = Number.isInteger(count) && count >= 1 && count <= 260 ? count : null;
  const audienceRaw = input.audience ?? 'everyone';
  if (audienceRaw !== 'everyone' && audienceRaw !== 'members') return refuse('A series is for everyone or for members.', 'audience');
  const audience: SeriesAudience = audienceRaw;

  const stored: SeriesFormInput = {
    intent: 'draft',
    replaces: null,
    title,
    excerpt: lede,
    bodyHtml: body,
    coverImageUrl: cover?.url ?? null,
    schedule: { firstDate, time, timeZone: zone, lastDate: last ? s.lastDate!.trim() : null, durationMinutes: duration, intervalWeeks: interval },
    where: { mode, location, joinUrl },
    attendeeLimit: limit ?? null,
    section,
    shareToNetwork,
    sessions: weeks.map((w) => ({ date: w.date, title: w.title, note: w.note, skipped: w.skipped, reason: w.reason })),
    page,
    repeatCount,
    audience,
  };

  return {
    ok: true,
    plan: {
      title,
      lede,
      body,
      cover: cover?.url ?? null,
      zone,
      weekday: new Date(Date.UTC(first.y, first.mo - 1, first.d)).getUTCDay(),
      time,
      firstDate,
      lastDate: stored.schedule.lastDate,
      duration,
      interval,
      anchorIso: anchor.toISOString(),
      untilIso: until ? until.toISOString() : null,
      format,
      location,
      joinUrl,
      talk: mode === 'talk',
      attendeeLimit: limit ?? null,
      section,
      shareToNetwork,
      weeks,
      page,
      audience,
      storage: audienceToStorage(audience),
      stored,
    },
  };
}

// ── writes ───────────────────────────────────────────────────────────────────

/** The draft row: complete columns, the typed weeks waiting in metadata.forms. */
async function writeDraft(viewerId: string, orgId: string, plan: Plan): Promise<string> {
  const thread = await createThread({
    kind: SERIES_KIND,
    orgId,
    authorId: viewerId,
    title: plan.title,
    ...(plan.lede ? { excerpt: plan.lede } : {}),
    ...(plan.body ? { body: plan.body } : {}),
    status: 'draft',
    visibility: 'PUBLIC',
    section: plan.section,
    scheduledAt: plan.anchorIso,
    durationMinutes: plan.duration,
    location: plan.location,
    format: plan.format,
    isRsvpEnabled: true,
    attendeeLimit: plan.attendeeLimit,
    metadata: {
      timeZone: plan.zone,
      ...(plan.cover ? { coverImageUrl: plan.cover } : {}),
      series: {
        lede: plan.lede,
        interval: plan.interval,
        listed: false,
        landing: false,
        ...(plan.cover ? { cover: { url: plan.cover, kind: 'image', posterUrl: null, frame: null } } : {}),
      },
      joinDetails: { url: plan.joinUrl, meetingId: null, passcode: null, other: null },
      forms: { origin: SERIES_FORM_ORIGIN, version: 1, input: plan.stored },
    },
  });
  try {
    // createThread covers the shared columns; recurrence is a dated kind's own (as IFAC's createSeries).
    await db`
      UPDATE threads SET
        recurrence_pattern = 'WEEKLY',
        recurrence_until = ${plan.untilIso}::timestamptz,
        updated_at = NOW()
      WHERE id = ${thread.id} AND org_id = ${orgId}
    `;
  } catch (err) {
    await db`UPDATE threads SET status = 'archived', updated_at = NOW() WHERE id = ${thread.id} AND org_id = ${orgId}`.catch(() => {});
    throw err;
  }
  return thread.id;
}

/**
 * Undo a publish that did not finish, in one transaction: the week threads this
 * series made are archived, its series_sessions rows and week notes go, and the
 * row is an unlisted draft again (metadata.forms is still on it: go-live is the
 * step that drops it). Only for a series created in the same call.
 */
async function undoPublish(orgId: string, threadId: string): Promise<void> {
  await db.begin(async (tx) => {
    await tx`
      UPDATE threads SET status = 'archived', updated_at = NOW()
      WHERE org_id = ${orgId} AND kind = ${SERIES_SESSION_KIND}
        AND (
          id IN (SELECT session_thread_id FROM series_sessions WHERE series_id = ${threadId} AND org_id = ${orgId})
          OR metadata->'seriesSession'->>'seriesId' = ${threadId}
        )
    `;
    await tx`DELETE FROM series_sessions WHERE series_id = ${threadId} AND org_id = ${orgId}`;
    await tx`DELETE FROM meeting_occurrence_notes WHERE thread_id = ${threadId}`;
    await tx`
      UPDATE threads SET
        status = 'draft',
        published_at = NULL,
        visibility = 'PUBLIC',
        min_role = NULL,
        share_to_network = false,
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb), '{series}',
          COALESCE(metadata->'series', '{}'::jsonb) || ${tx.json({ listed: false, landing: false } as never)}
        ),
        updated_at = NOW()
      WHERE id = ${threadId} AND org_id = ${orgId}
    `;
  });
}

function stepMessage(err: unknown): string {
  if (err instanceof SeriesError) return err.message;
  if (err instanceof Error && /^(The|A|Pick|Write|That|This|Give|Restore)\b/.test(err.message)) return err.message;
  return 'Something went wrong while publishing.';
}

/** Steps 1–4 (see the header); the extras are the caller's. */
async function publishDraft(
  viewerId: string,
  orgId: string,
  threadId: string,
  plan: Plan
): Promise<{ ok: true } | { ok: false; step: SeriesPublishStep; message: string; undone: boolean }> {
  let step: SeriesPublishStep = 'publish';
  try {
    const flipped = await db<Array<{ id: string }>>`
      UPDATE threads SET
        status = 'published',
        published_at = COALESCE(published_at, NOW()),
        visibility = 'INVITE_ONLY',
        share_to_network = false,
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb), '{series}',
          COALESCE(metadata->'series', '{}'::jsonb) || ${db.json({ listed: false, landing: false } as never)}
        ),
        updated_at = NOW()
      WHERE id = ${threadId} AND org_id = ${orgId} AND kind = ${SERIES_KIND} AND status = 'draft'
      RETURNING id
    `;
    if (!flipped[0]) throw new Error('The series draft could not be published.');

    step = 'schedule';
    await saveSeriesSchedule({
      orgId,
      threadId,
      schedule: {
        weekday: plan.weekday,
        time: plan.time,
        timeZone: plan.zone,
        firstDate: plan.firstDate,
        lastDate: plan.lastDate,
        durationMinutes: plan.duration,
        alsoZones: null,
        intervalWeeks: plan.interval,
        monthly: false,
      },
    });

    step = 'sessions';
    for (const w of plan.weeks) {
      if (w.title || w.note) {
        await saveSeriesSession({
          orgId,
          threadId,
          occurrenceAt: w.at,
          ...(w.title ? { title: w.title } : {}),
          ...(w.note ? { subtitle: w.note } : {}),
          actorUserId: viewerId,
        });
      }
      if (w.skipped) {
        await cancelSeriesSession({ orgId, threadId, occurrenceAt: w.at, actorUserId: viewerId });
      } else if (w.title) {
        // A week is public only with a title AND published_at (meeting-series.ts isPublished).
        await publishSeriesSession({ orgId, threadId, occurrenceAt: w.at, published: true, actorUserId: viewerId });
      }
    }

    step = 'go-live';
    const { visibility, minRole } = plan.storage;
    await db.begin(async (tx) => {
      const live = await tx<Array<{ id: string }>>`
        UPDATE threads SET
          visibility = ${visibility},
          min_role = ${minRole},
          share_to_network = ${plan.shareToNetwork},
          metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb) - 'forms', '{series}',
            COALESCE(metadata->'series', '{}'::jsonb) || ${tx.json({ listed: plan.page.listed, landing: plan.page.slides } as never)}
          ),
          updated_at = NOW()
        WHERE id = ${threadId} AND org_id = ${orgId} AND status = 'published'
        RETURNING id
      `;
      if (!live[0]) throw new Error('The series could not be put live.');
      // The weeks made in step 3 copied the hidden audience; they take the series' own.
      await tx`
        UPDATE threads SET visibility = ${visibility}, min_role = ${minRole}, updated_at = NOW()
        WHERE org_id = ${orgId} AND kind = ${SERIES_SESSION_KIND} AND status <> 'archived'
          AND metadata->'seriesSession'->>'seriesId' = ${threadId}
      `;
    });
    return { ok: true };
  } catch (err) {
    console.error(`[series-form] publish failed at ${step}:`, err);
    const undone = await undoPublish(orgId, threadId).then(
      () => true,
      (e) => {
        console.error('[series-form] undoPublish:', e);
        return false;
      }
    );
    return { ok: false, step, message: stepMessage(err), undone };
  }
}

/** Best-effort steps after go-live. Each failure is a warning; none takes the series down. */
async function afterLive(viewerId: string, orgId: string, threadId: string, plan: Plan): Promise<string[]> {
  const warnings: string[] = [];
  if (plan.talk) {
    try {
      await ensureSeriesTalkRoom({ orgId, threadId, actorUserId: viewerId });
    } catch (err) {
      console.error('[series-form] ensureSeriesTalkRoom:', err);
      warnings.push('The series is live, but its Talk room could not be created. Make it from the planner.');
    }
  }
  if (plan.page.featured) {
    try {
      await saveSeriesPageSettings({ orgId, featuredId: threadId });
    } catch (err) {
      console.error('[series-form] saveSeriesPageSettings:', err);
      warnings.push('The series is live, but it could not be made the featured series.');
    }
  }
  // The shared calendar never carries an INVITE_ONLY thread (org-calendar.ts pushThreadToCalendar).
  if (plan.storage.visibility !== 'INVITE_ONLY') {
    try {
      if (!(await getOrgCalendarUri(orgId))) await ensureOrgCalendar(orgId);
      await pushThreadToCalendar(orgId, threadId);
    } catch (err) {
      // The reconciler (org-calendar-sync.ts) picks it up later.
      console.error('[series-form] calendar mirror failed:', err);
    }
  }
  return warnings;
}

// ── entry points ─────────────────────────────────────────────────────────────

/**
 * Make a series from the publication form: a draft, or (intent 'published')
 * a published series with its schedule, typed weeks and Series page row.
 * `input.replaces` names a series draft this form saved before, which is
 * archived once the fresh one exists. See the header for the steps and how
 * atomic they are.
 */
export async function createSeriesFromForm(viewerId: string, orgId: string, input: SeriesFormInput): Promise<SeriesFormResult> {
  if (!viewerId) return refuse('Sign in first.');
  if (!(await mayMakeSeries(viewerId, orgId))) {
    return refuse(
      orgId === PERSONAL_ORG_ID
        ? 'A series goes on an organisation’s calendar. Choose the organisation under “Making as”.'
        : 'Only an owner or guide of this organisation can make a series.'
    );
  }

  let old: Row | null = null;
  if (input.replaces) {
    old = await readRow(input.replaces);
    if (!old || old.org_id !== orgId || old.status === 'archived') return refuse('That draft no longer exists here.', 'replaces');
    if (old.kind !== SERIES_KIND) return refuse('That is not a series draft.', 'replaces');
    if (old.status !== 'draft') return refuse('This series is published: change it in its planner.', 'replaces');
    if (!isFormDraft(old)) return refuse('This series draft was not made with this form: change it where it was made.', 'replaces');
  }

  const planned = await planOf(orgId, input);
  if (planned.ok === false) return planned;
  const plan = planned.plan;

  const warnings: string[] = [];
  if (plan.weeks.some((w) => w.skipped && w.reason)) {
    warnings.push('Reasons for skipped weeks are kept on the draft only: a published series does not store them yet.');
  }

  let id: string;
  try {
    if (old) {
      // Free the old draft's address, so the fresh one keeps the title's slug rather than "-2".
      await db`
        UPDATE threads SET slug = LEFT(slug, 160) || '-r' || substr(md5(random()::text), 1, 8)
        WHERE id = ${old.id} AND org_id = ${orgId} AND status = 'draft'
      `;
    }
    id = await writeDraft(viewerId, orgId, plan);
  } catch (err) {
    console.error('[series-form] writeDraft:', err);
    return refuse('Could not save the series. Try again.');
  }
  if (old) {
    // removeThread's rules: archived, never deleted, off the calendar, logged.
    const removed = await removeThreadAs(viewerId, old.id, { editor: true }).catch((err) => {
      console.error('[series-form] archive replaced draft:', err);
      return { ok: false as const, error: 'failed' };
    });
    if (removed.ok === false) warnings.push('The earlier draft of this series could not be removed; it is still in your drafts.');
  }

  let notPublished: { step: SeriesPublishStep; message: string } | null = null;
  if (input.intent === 'published') {
    const published = await publishDraft(viewerId, orgId, id, plan);
    if (published.ok === false) {
      if (!published.undone) {
        return refuse(
          `Publishing stopped (${published.message}) and could not be undone. The series is hidden: members-only and off the Series page. Open it in its planner.`
        );
      }
      notPublished = { step: published.step, message: `Not published: ${published.message} The series is saved as a draft.` };
    } else {
      warnings.push(...(await afterLive(viewerId, orgId, id, plan)));
    }
  }

  const row = await readRow(id);
  if (!row) return refuse('Saved, but the series could not be read back.');
  return { ok: true, value: toRecord(row), warnings, notPublished };
}

/**
 * A series for the form. `input` is set only for a draft this form made (the
 * form reopens it); a published series, or a draft made elsewhere, comes back
 * with `input: null`, which means: edit it in its planner (PLAN §12). Null when
 * it does not exist or the viewer is not an organiser of its org.
 */
export async function loadSeriesForForm(viewerId: string, threadId: string): Promise<SeriesFormRecord | null> {
  if (!viewerId) return null;
  const row = await readRow(threadId);
  if (!row || row.kind !== SERIES_KIND || row.status === 'archived') return null;
  if (!(await mayMakeSeries(viewerId, row.org_id))) return null;
  return toRecord(row);
}

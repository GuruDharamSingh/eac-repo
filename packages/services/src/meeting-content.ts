import { db } from '@elkdonis/db';
import { sanitizePostBody } from '@elkdonis/utils';
import { createThread } from './posts';
import { canModerateOrg, statusForNewThread } from './moderation';
import { listOrgFeeds, getOrgFeed } from './org-feeds';
import { assignMeetingRole, clearMeetingRole, getMeetingRota, listRotaCandidates } from './meeting-rota';
import { createCollaborativeDocument, createTalkRoom } from './nextcloud';
import { ensureOrgCalendar, getOrgCalendarUri, pushThreadToCalendar, removeThreadFromCalendar } from './org-calendar';
import { removeThreadAs } from './thread-admin';
import { validTimeZone } from './meeting-series';
import { SERIES_KIND } from './thread-kinds';

// ============================================================================
// Dated threads — meetings and events — written for ANY org (2026-11-01).
//
// Every org app carries its own copy of this (ifac, innergathering, amrit,
// sunjay, elktours, hidden-enneagram `lib/cms/actions.ts`), each bound to its
// `siteConfig.orgId`. The Studio acts for whichever org the person picks, so
// it needs the same save with the org as an argument; and if the apps merge
// into one, this is the copy that survives. Modelled on IFAC's
// `saveContentAction`, the most complete of them: Talk room and document
// (idempotent, best-effort), "Who's hosting" onto the rota for the next
// occurrence, the org calendar mirror, the members'-posts review rule.
//
// Field names are the shared composer's vocabulary
// (`packages/cms-ui/src/compose/content-fields.ts`) in camelCase. Dates
// arrive as instants: the caller converts the form's wall clock in
// `timeZone` before calling, as IFAC's compose-adapter does.
//
// A meeting SERIES (kind `series`, or a meeting carrying `metadata.series`)
// is the planner's: its weeks key on occurrence instants, so its schedule is
// never written from here. It is listed so the Studio can link to its planner.
// ============================================================================

export type MeetingKind = 'meeting' | 'event';
export const MEETING_KINDS: MeetingKind[] = ['meeting', 'event'];

const PERSONAL_ORG_ID = 'oad';

export interface MeetingInput {
  kind: MeetingKind;
  title: string;
  body?: string | null;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  /** The zone the form showed its times in. */
  timeZone?: string | null;
  /** ISO instants. */
  scheduledAt: string | null;
  durationMinutes?: number | null;
  format?: 'in_person' | 'online' | 'hybrid' | null;
  location?: string | null;
  recurrencePattern?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | null;
  recurrenceUntil?: string | null;
  /** Prose for people; never parsed. */
  recurrenceCustomRule?: string | null;
  meetingUrl?: string | null;
  videoLink?: string | null;
  isRsvpEnabled?: boolean;
  attendeeLimit?: number | null;
  rsvpDeadline?: string | null;
  minAttendees?: number | null;
  notifyOnMinAttendees?: boolean;
  /** `org_feeds.slug`. */
  section?: string | null;
  visibility?: 'PUBLIC' | 'ORGANIZATION' | 'INVITE_ONLY';
  shareToNetwork?: boolean;
  createTalkRoom?: boolean;
  createDocument?: boolean;
  /** Host of the NEXT occurrence. undefined = not asked; "" = nobody. */
  hostUserId?: string;
  coHostUserId?: string;
  /**
   * Remind people who said yes this many minutes before each occurrence
   * (`threads.reminder_minutes_before`, read by attendee-reminders.ts:94).
   * undefined = not asked (the stored value is kept); null = no reminder.
   */
  reminderMinutesBefore?: number | null;
}

export interface MeetingSummary {
  id: string;
  orgId: string;
  kind: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  recurrencePattern: string | null;
  coverImageUrl: string | null;
  updatedAt: string;
  /** A series: edited in its planner, not here. */
  isSeries: boolean;
}

export interface MeetingRecord extends MeetingSummary {
  slug: string;
  authorId: string;
  publishedAt: string | null;
  createdAt: string;
  input: MeetingInput;
  talkToken: string | null;
  documentUrl: string | null;
}

export interface MeetingComposeContext {
  /** May write dated things here: owner or guide (or a network admin). */
  canEdit: boolean;
  /** Why not, in a sentence, when `canEdit` is false. */
  reason: string | null;
  feeds: Array<{ slug: string; name: string }>;
  hostCandidates: Array<{ userId: string; displayName: string }>;
  canCreateTalkRoom: boolean;
  canCreateDocument: boolean;
  canShareToNetwork: boolean;
}

export type MeetingResult<T = void> =
  | { ok: true; value: T; warnings?: string[] }
  | { ok: false; error: string };

const NEXTCLOUD = Boolean(process.env.NEXTCLOUD_URL);

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? null : x.toISOString();
}

function httpUrl(value: string | null | undefined): boolean {
  if (!value) return true;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function validInstant(value: string | null | undefined): boolean {
  return !value || !Number.isNaN(Date.parse(value));
}

/** What the composer may offer under this org, and whether the viewer may use it. */
export async function meetingComposeContext(viewerId: string, orgId: string): Promise<MeetingComposeContext> {
  const personal = orgId === PERSONAL_ORG_ID;
  const canEdit = !personal && (await canModerateOrg(viewerId, orgId).catch(() => false));
  const [feeds, candidates] = canEdit
    ? await Promise.all([
        listOrgFeeds(orgId, { includePrivate: true }).catch(() => []),
        listRotaCandidates(orgId).catch(() => []),
      ])
    : [[], []];
  return {
    canEdit,
    reason: canEdit
      ? null
      : personal
        ? 'A meeting goes on an organisation’s calendar. Choose the organisation under “Making as”.'
        : 'Only an owner or guide of this organisation can put a meeting on its calendar.',
    feeds: feeds.map((f) => ({ slug: f.slug, name: f.name })),
    hostCandidates: candidates.map((c) => ({ userId: c.userId, displayName: c.displayName || c.email || 'Member' })),
    canCreateTalkRoom: NEXTCLOUD,
    canCreateDocument: NEXTCLOUD,
    canShareToNetwork: true,
  };
}

type Row = {
  id: string;
  org_id: string;
  author_id: string;
  kind: string;
  slug: string;
  title: string;
  body: string | null;
  excerpt: string | null;
  status: string;
  visibility: string;
  share_to_network: boolean;
  section: string | null;
  scheduled_at: Date | null;
  duration_minutes: number | null;
  location: string | null;
  format: string | null;
  meeting_url: string | null;
  video_link: string | null;
  recurrence_pattern: string | null;
  recurrence_until: Date | null;
  recurrence_custom_rule: string | null;
  is_rsvp_enabled: boolean;
  attendee_limit: number | null;
  rsvp_deadline: Date | null;
  min_attendees: number | null;
  notify_on_min_attendees: boolean;
  reminder_minutes_before: number | null;
  nextcloud_talk_token: string | null;
  document_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
  is_series: boolean;
};

const DATED_KINDS = [...MEETING_KINDS, SERIES_KIND];

function summary(r: Row): MeetingSummary {
  const cover = r.metadata?.coverImageUrl;
  return {
    id: r.id,
    orgId: r.org_id,
    kind: r.kind,
    title: r.title,
    status: r.status,
    scheduledAt: iso(r.scheduled_at),
    recurrencePattern: r.recurrence_pattern,
    coverImageUrl: typeof cover === 'string' ? cover : null,
    updatedAt: iso(r.updated_at)!,
    isSeries: r.is_series,
  };
}

/**
 * The org's dated threads, newest first. An owner or guide sees all of them;
 * anyone else sees only the ones they wrote.
 */
export async function listOrgMeetings(viewerId: string, orgId: string): Promise<MeetingSummary[]> {
  const all = await canModerateOrg(viewerId, orgId).catch(() => false);
  const rows = await db<Row[]>`
    SELECT t.*, (t.kind = ${SERIES_KIND} OR COALESCE(jsonb_typeof(t.metadata->'series') = 'object', false)) AS is_series
    FROM threads t
    WHERE t.org_id = ${orgId}
      AND t.kind = ANY(${DATED_KINDS})
      AND t.status <> 'archived'
      ${all ? db`` : db`AND t.author_id = ${viewerId}::uuid`}
    ORDER BY COALESCE(t.scheduled_at, t.updated_at) DESC
    LIMIT 200
  `;
  return rows.map(summary);
}

async function readRow(id: string): Promise<Row | null> {
  const [row] = await db<Row[]>`
    SELECT t.*, (t.kind = ${SERIES_KIND} OR COALESCE(jsonb_typeof(t.metadata->'series') = 'object', false)) AS is_series
    FROM threads t WHERE t.id = ${id} AND t.kind = ANY(${DATED_KINDS}) LIMIT 1
  `;
  return row ?? null;
}

async function mayChange(viewerId: string, row: Row): Promise<boolean> {
  if (row.author_id === viewerId) return true;
  return canModerateOrg(viewerId, row.org_id).catch(() => false);
}

/** One dated thread with everything the form shows, or null when the viewer may not edit it. */
export async function loadMeetingContent(viewerId: string, id: string): Promise<MeetingRecord | null> {
  const row = await readRow(id);
  if (!row || !(await mayChange(viewerId, row))) return null;
  const meta = row.metadata ?? {};
  let hostUserId: string | undefined;
  let coHostUserId: string | undefined;
  if (!row.is_series) {
    try {
      const next = (await getMeetingRota(id, { from: new Date(), count: 1 })).occurrences[0];
      const pick = (role: string) => next?.roles.find((a) => a.role === role)?.userId ?? '';
      if (next) {
        hostUserId = pick('host');
        coHostUserId = pick('co-host');
      }
    } catch {
      // No rota yet: the form shows "Nobody yet".
    }
  }
  return {
    ...summary(row),
    slug: row.slug,
    authorId: row.author_id,
    publishedAt: iso(row.published_at),
    createdAt: iso(row.created_at)!,
    talkToken: row.nextcloud_talk_token,
    documentUrl: row.document_url,
    input: {
      kind: (row.kind === 'event' ? 'event' : 'meeting') as MeetingKind,
      title: row.title,
      body: row.body,
      excerpt: row.excerpt,
      coverImageUrl: typeof meta.coverImageUrl === 'string' ? meta.coverImageUrl : null,
      timeZone: typeof meta.timeZone === 'string' ? meta.timeZone : null,
      scheduledAt: iso(row.scheduled_at),
      durationMinutes: row.duration_minutes,
      format: (row.format as MeetingInput['format']) ?? null,
      location: row.location,
      recurrencePattern: (row.recurrence_pattern as MeetingInput['recurrencePattern']) ?? null,
      recurrenceUntil: iso(row.recurrence_until),
      recurrenceCustomRule: row.recurrence_custom_rule,
      meetingUrl: row.meeting_url,
      videoLink: row.video_link,
      isRsvpEnabled: row.is_rsvp_enabled,
      attendeeLimit: row.attendee_limit,
      rsvpDeadline: iso(row.rsvp_deadline),
      minAttendees: row.min_attendees,
      notifyOnMinAttendees: row.notify_on_min_attendees,
      section: row.section,
      visibility: row.visibility as MeetingInput['visibility'],
      shareToNetwork: row.share_to_network,
      createTalkRoom: Boolean(row.nextcloud_talk_token),
      createDocument: Boolean(row.document_url),
      hostUserId,
      coHostUserId,
      reminderMinutesBefore: row.reminder_minutes_before ?? null,
    },
  };
}

/** Everything that can be refused, before anything is written. */
async function validate(orgId: string, input: MeetingInput): Promise<string | null> {
  if (!MEETING_KINDS.includes(input.kind)) return 'That is not a meeting or an event.';
  if ((input.title ?? '').trim().length < 2) return 'Give it a title.';
  if (!input.scheduledAt || !validInstant(input.scheduledAt)) return 'Pick a date and time.';
  if (!validInstant(input.recurrenceUntil) || !validInstant(input.rsvpDeadline)) return 'One of the dates could not be read.';
  if (input.recurrencePattern && input.recurrenceUntil && Date.parse(input.recurrenceUntil) <= Date.parse(input.scheduledAt)) {
    return 'It stops repeating before it starts.';
  }
  if (input.rsvpDeadline && input.isRsvpEnabled && Date.parse(input.rsvpDeadline) > Date.parse(input.scheduledAt) + 864e5 * 366 * 5) {
    return 'The RSVP deadline is too far ahead.';
  }
  const d = input.durationMinutes ?? 60;
  if (!Number.isFinite(d) || d < 5 || d > 24 * 60) return 'It lasts between 5 minutes and 24 hours.';
  if (input.attendeeLimit != null && (!Number.isInteger(input.attendeeLimit) || input.attendeeLimit < 1)) return 'The limit is a whole number, at least 1.';
  if (input.minAttendees != null && (!Number.isInteger(input.minAttendees) || input.minAttendees < 1)) return 'The minimum is a whole number, at least 1.';
  if (!httpUrl(input.meetingUrl)) return 'The joining link must start with https://';
  if (!httpUrl(input.videoLink)) return 'The recording link must start with https://';
  if (input.timeZone && !validTimeZone(input.timeZone)) return 'Pick a time zone from the list.';
  const r = input.reminderMinutesBefore;
  if (r != null && (!Number.isInteger(r) || r < 5 || r > 14 * 24 * 60)) return 'A reminder goes out between 5 minutes and two weeks before.';
  if (input.section) {
    const feed = await getOrgFeed(orgId, input.section).catch(() => null);
    if (!feed) return 'That page does not exist on this site.';
  }
  return null;
}

/**
 * The columns this form owns. Metadata is merged, not replaced: other writers
 * keep state there (the meeting light, series details).
 */
async function writeColumns(threadId: string, orgId: string, input: MeetingInput, status: string): Promise<void> {
  const body = input.body?.trim() ? sanitizePostBody(input.body.trim()) : null;
  const zone = validTimeZone(input.timeZone ?? null);
  const meta: Record<string, string> = {};
  if (input.coverImageUrl) meta.coverImageUrl = input.coverImageUrl;
  if (zone) meta.timeZone = zone;
  const rsvp = input.isRsvpEnabled ?? true;
  const pattern = input.recurrencePattern || null;
  await db`
    UPDATE threads SET
      kind              = ${input.kind},
      title             = ${input.title.trim().slice(0, 200)},
      body              = ${body},
      excerpt           = ${input.excerpt?.trim() || null},
      status            = ${status},
      visibility        = ${input.visibility ?? 'PUBLIC'},
      share_to_network  = ${Boolean(input.shareToNetwork)},
      section           = ${input.section || null},
      is_meeting        = TRUE,
      scheduled_at      = ${input.scheduledAt},
      duration_minutes  = ${input.durationMinutes ?? 60},
      location          = ${input.location?.trim() || null},
      format            = ${input.format ?? 'in_person'},
      is_online         = ${input.format === 'online'},
      meeting_url       = ${input.meetingUrl?.trim() || null},
      video_link        = ${input.videoLink?.trim() || null},
      recurrence_pattern     = ${pattern},
      recurrence_until       = ${pattern ? (input.recurrenceUntil ?? null) : null},
      recurrence_custom_rule = ${input.recurrenceCustomRule?.trim() || null},
      is_rsvp_enabled   = ${rsvp},
      attendee_limit    = ${rsvp ? (input.attendeeLimit ?? null) : null},
      rsvp_deadline     = ${rsvp ? (input.rsvpDeadline ?? null) : null},
      min_attendees     = ${rsvp ? (input.minAttendees ?? null) : null},
      notify_on_min_attendees = ${rsvp && input.minAttendees ? Boolean(input.notifyOnMinAttendees) : false},
      reminder_minutes_before = CASE WHEN ${input.reminderMinutesBefore !== undefined}::boolean
                                     THEN ${input.reminderMinutesBefore ?? null}::int
                                     ELSE reminder_minutes_before END,
      metadata          = (COALESCE(metadata, '{}'::jsonb) - 'coverImageUrl' - 'timeZone') || ${db.json(meta)},
      published_at      = CASE WHEN ${status} = 'published' AND published_at IS NULL THEN NOW() ELSE published_at END,
      updated_at        = NOW()
    WHERE id = ${threadId} AND org_id = ${orgId}
  `;
}

/** Talk room and document: "there should be one", never "make another". Best-effort. */
async function attachRooms(orgId: string, threadId: string, title: string, input: MeetingInput): Promise<string[]> {
  const warnings: string[] = [];
  const wantTalk = Boolean(input.createTalkRoom) && !input.meetingUrl;
  const wantDoc = Boolean(input.createDocument);
  if (!wantTalk && !wantDoc) return warnings;
  const [current] = await db<Array<{ nextcloud_talk_token: string | null; document_url: string | null; nc: string | null }>>`
    SELECT t.nextcloud_talk_token, t.document_url, u.nextcloud_user_id AS nc
    FROM threads t JOIN users u ON u.id = t.author_id WHERE t.id = ${threadId}
  `;
  if (wantTalk && !current?.nextcloud_talk_token) {
    try {
      // Public (type 3): joinable from a link without an account. The author moderates it.
      const token = await createTalkRoom(title, 'public', { moderator: current?.nc ?? null, listable: 1 });
      if (token) await db`UPDATE threads SET nextcloud_talk_token = ${token} WHERE id = ${threadId}`;
      else warnings.push('The Talk room could not be created.');
    } catch (err) {
      console.error('[meeting-content] createTalkRoom:', err);
      warnings.push('The Talk room could not be created.');
    }
  }
  if (wantDoc && !current?.document_url) {
    try {
      const doc = await createCollaborativeDocument(orgId, title, threadId);
      if (doc?.url) await db`UPDATE threads SET document_url = ${doc.url}, nextcloud_doc_url = ${doc.editUrl ?? doc.url} WHERE id = ${threadId}`;
      else warnings.push('The document could not be created.');
    } catch (err) {
      console.error('[meeting-content] createCollaborativeDocument:', err);
      warnings.push('The document could not be created.');
    }
  }
  return warnings;
}

/** "Who's hosting" onto the rota for the next occurrence; only this org's candidates. */
async function assignNextHosts(orgId: string, threadId: string, input: MeetingInput, actorUserId: string): Promise<string[]> {
  if (input.hostUserId === undefined && input.coHostUserId === undefined) return [];
  const warnings: string[] = [];
  try {
    const next = (await getMeetingRota(threadId, { from: new Date(), count: 1 })).occurrences[0];
    if (!next) return warnings;
    const allowed = new Set((await listRotaCandidates(orgId)).map((c) => c.userId));
    for (const [role, userId] of [
      ['host', input.hostUserId],
      ['co-host', input.coHostUserId],
    ] as const) {
      if (userId === undefined) continue;
      if (userId === '') await clearMeetingRole(threadId, next.at, role);
      else if (allowed.has(userId)) await assignMeetingRole({ threadId, occurrenceAt: next.at, role, userId, actorUserId });
      else warnings.push(`That ${role} is not a member here, so they were not put down.`);
    }
  } catch (err) {
    console.error('[meeting-content] assignNextHosts:', err);
    warnings.push('The host could not be saved to the rota.');
  }
  return warnings;
}

async function syncCalendar(orgId: string, threadId: string, status: string): Promise<void> {
  try {
    if (status === 'published') {
      if (!(await getOrgCalendarUri(orgId))) await ensureOrgCalendar(orgId);
      await pushThreadToCalendar(orgId, threadId);
    } else {
      await removeThreadFromCalendar(orgId, threadId);
    }
  } catch (err) {
    console.error('[meeting-content] calendar mirror failed:', err);
  }
}

/**
 * Create (`threadId` absent) or update a meeting or event under `orgId`.
 * `intent` is the button pressed; a member's publish may become `pending`
 * under the org's review rule (statusForNewThread).
 */
export async function saveMeetingContent(
  viewerId: string,
  orgId: string,
  input: MeetingInput,
  intent: 'draft' | 'published',
  threadId?: string | null
): Promise<MeetingResult<MeetingRecord>> {
  const problem = await validate(orgId, input);
  if (problem) return { ok: false, error: problem };

  let id = threadId ?? null;
  if (id) {
    const row = await readRow(id);
    if (!row || row.org_id !== orgId) return { ok: false, error: 'That meeting no longer exists here.' };
    if (!(await mayChange(viewerId, row))) return { ok: false, error: 'Only its author, or an owner or guide, can change this.' };
    if (row.is_series) {
      return { ok: false, error: 'This is a series: change it in its planner, where moving the schedule moves the weeks with it.' };
    }
  } else {
    const ctx = await meetingComposeContext(viewerId, orgId);
    if (!ctx.canEdit) return { ok: false, error: ctx.reason ?? 'Not allowed here.' };
  }

  const status = await statusForNewThread(viewerId, orgId, intent);
  const title = input.title.trim();
  try {
    if (!id) {
      const created = await createThread({
        kind: input.kind,
        orgId,
        authorId: viewerId,
        title,
        status: 'draft',
        visibility: input.visibility ?? 'PUBLIC',
        scheduledAt: input.scheduledAt,
      });
      id = created.id;
    }
    await writeColumns(id, orgId, input, status);
    const warnings = [
      ...(await attachRooms(orgId, id, title, input)),
      ...(await assignNextHosts(orgId, id, input, viewerId)),
    ];
    await syncCalendar(orgId, id, status);
    const record = await loadMeetingContent(viewerId, id);
    if (!record) return { ok: false, error: 'Saved, but it could not be read back.' };
    return { ok: true, value: record, warnings };
  } catch (err) {
    console.error('[meeting-content] saveMeetingContent:', err);
    return { ok: false, error: 'Could not save that. Try again.' };
  }
}

/** Archive it (removeThread's rules) and take it off the calendar. */
export async function removeMeetingContent(viewerId: string, threadId: string): Promise<MeetingResult> {
  const row = await readRow(threadId);
  if (!row) return { ok: false, error: 'That meeting no longer exists.' };
  const editor = await canModerateOrg(viewerId, row.org_id).catch(() => false);
  const r = await removeThreadAs(viewerId, threadId, { editor });
  if (r.ok === false) return { ok: false, error: r.error };
  await removeThreadFromCalendar(row.org_id, threadId).catch(() => {});
  return { ok: true, value: undefined };
}

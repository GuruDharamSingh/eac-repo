import { db } from '@elkdonis/db';
import { sanitizePostBody, sanitizeRichText } from '@elkdonis/utils';
import { renderEssayHtml, type EssayDoc } from '@elkdonis/utils/essay';
import { createThread } from './posts';
import { canModerateOrg, statusForNewThread } from './moderation';
import { listOrgFeeds, getOrgFeed } from './org-feeds';
import { assignMeetingRole, clearMeetingRole, getMeetingRota, listRotaCandidates } from './meeting-rota';
import { createCollaborativeDocument, createTalkRoom, syncTalkRoomAudience, talkRoomPolicy } from './nextcloud';
import { ensureOrgCalendar, getOrgCalendarUri, pushThreadToCalendar, removeThreadFromCalendar } from './org-calendar';
import { removeThreadAs } from './thread-admin';
import { audienceToStorage, isAudience, type Audience, type ThreadRole } from './thread-audience';
import { validTimeZone } from './meeting-series';
import { cleanSectionNotes } from './section-notes';
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
const VISIBILITIES: Array<NonNullable<MeetingInput['visibility']>> = ['PUBLIC', 'ORGANIZATION', 'INVITE_ONLY'];
const ROLES: ThreadRole[] = ['viewer', 'member', 'guide', 'owner'];

/**
 * The audience columns to write. `visibility: null` and `minRole: undefined` keep the stored
 * value. PUBLIC and ORGANIZATION never carry a minimum role (audienceToStorage), so setting
 * either clears it.
 */
function readAccess(input: MeetingInput): { visibility: NonNullable<MeetingInput['visibility']> | null; minRole: ThreadRole | null | undefined } {
  if (input.audience !== undefined) return audienceToStorage(input.audience);
  const visibility = input.visibility ?? null;
  return { visibility, minRole: visibility && visibility !== 'INVITE_ONLY' ? null : input.minRole };
}

/**
 * A field left out (`undefined`) keeps the stored value; `null` clears it (2026-11-14, for
 * `body`, `bodyDoc`, `visibility`, `minRole` and `audience`). Quick forms and Channel sheets send
 * only the fields they show, so leaving a field out must never erase it. The other columns are
 * still written as sent: a caller that edits a stored meeting loads it first and sends it back
 * whole, as the Studio forms do (useFormState keeps every answer of the loaded record).
 */
export interface MeetingInput {
  kind: MeetingKind;
  title: string;
  /**
   * HTML. A body sent without `bodyDoc` also clears `threads.body_doc`: the stored document
   * would otherwise contradict the newer HTML wherever the document is opened. Both left out
   * keep the body, the document and `body_format` as they are.
   */
  body?: string | null;
  /**
   * The description as an essay Canvas document (the Studio forms, 2026-11-11). Set, `body` is
   * rendered from it (renderEssayHtml, then sanitizeRichText, as writing.ts updateWritingPost does)
   * and it is kept in threads.body_doc; null clears the document (the body is kept unless `body`
   * is sent too).
   */
  bodyDoc?: EssayDoc | null;
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
  /**
   * Who may read it. Left out: kept (a new meeting starts PUBLIC, createThread's default; a
   * host whose org is private by default must send it). `audience` (thread-audience.ts), when
   * sent, decides both `visibility` and `minRole` and wins over them. `visibility` other than
   * INVITE_ONLY clears `min_role`, as audienceToStorage pairs them; INVITE_ONLY with no
   * `minRole` keeps the stored one.
   */
  visibility?: 'PUBLIC' | 'ORGANIZATION' | 'INVITE_ONLY';
  /** `threads.min_role` (migration 188). Left out: kept; null: cleared. */
  minRole?: ThreadRole | null;
  audience?: Audience;
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
  /**
   * `threads.metadata` keys a form owns (2026-11-14), merged into what is stored: a key left out is
   * kept, a null removes it. Only MEETING_FORM_METADATA keys are written; anything else is ignored,
   * so a form can never touch the series, the meeting light or the join details.
   */
  metadata?: Record<string, unknown>;
}

/**
 * The metadata keys the meeting form may write. `showCycleBadge`: innergathering's "Confirmed / Not yet
 * confirmed" badge on the meeting page; stored only as false (absent means shown). `sectionNotes`: row notes
 * shown as "More details" (section-notes.ts); validated in `validate`, an empty list removes the key.
 */
export const MEETING_FORM_METADATA = ['showCycleBadge', 'sectionNotes'] as const;

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
        ? 'A meeting goes on an organisation’s calendar. Choose the organisation in the “On …” menu at the top.'
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
  body_doc: unknown;
  excerpt: string | null;
  status: string;
  visibility: string;
  min_role: string | null;
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
      bodyDoc: row.body_doc && typeof row.body_doc === 'object' ? (row.body_doc as EssayDoc) : null,
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
      minRole: (row.min_role as ThreadRole | null) ?? null,
      shareToNetwork: row.share_to_network,
      createTalkRoom: Boolean(row.nextcloud_talk_token),
      createDocument: Boolean(row.document_url),
      hostUserId,
      coHostUserId,
      reminderMinutesBefore: row.reminder_minutes_before ?? null,
      metadata: Object.fromEntries(MEETING_FORM_METADATA.filter((k) => k in meta).map((k) => [k, meta[k]])),
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
  if (input.metadata && input.metadata.sectionNotes != null) {
    const notes = cleanSectionNotes(input.metadata.sectionNotes);
    // Cast: hosts with strict off (sunjay) do not narrow this union.
    if (!notes.ok) return (notes as { ok: false; error: string }).error;
  }
  if (input.visibility !== undefined && !VISIBILITIES.includes(input.visibility)) return 'Pick who can see it.';
  if (input.minRole != null && !ROLES.includes(input.minRole)) return 'Pick who can see it.';
  if (input.audience !== undefined && !isAudience(input.audience)) return 'Pick who can see it.';
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
  const doc = input.bodyDoc && typeof input.bodyDoc === 'object' ? input.bodyDoc : null;
  // The body columns: a document wins; a body alone replaces the HTML and drops the document;
  // `bodyDoc: null` alone drops the document and keeps the HTML; neither keeps all three.
  const setBody = doc !== null || input.body !== undefined;
  const setDoc = doc !== null || input.body !== undefined || input.bodyDoc === null;
  const body = doc ? sanitizeRichText(renderEssayHtml(doc)) || null : input.body?.trim() ? sanitizePostBody(input.body.trim()) : null;
  const access = readAccess(input);
  const zone = validTimeZone(input.timeZone ?? null);
  const meta: Record<string, string> = {};
  if (input.coverImageUrl) meta.coverImageUrl = input.coverImageUrl;
  if (zone) meta.timeZone = zone;
  const rsvp = input.isRsvpEnabled ?? true;
  const pattern = input.recurrencePattern || null;
  // The form's own metadata keys: set the given ones, drop the ones sent as null.
  const formMeta: Record<string, unknown> = {};
  const dropMeta: string[] = [];
  for (const k of MEETING_FORM_METADATA) {
    if (!input.metadata || !(k in input.metadata) || input.metadata[k] === undefined) continue;
    if (k === 'sectionNotes') {
      // Cleaned again here (validate refused the bad ones): an empty list removes the key.
      const notes = cleanSectionNotes(input.metadata[k]);
      if (notes.ok && notes.value.length) formMeta[k] = notes.value;
      else dropMeta.push(k);
      continue;
    }
    if (input.metadata[k] === null) dropMeta.push(k);
    else formMeta[k] = input.metadata[k];
  }
  await db`
    UPDATE threads SET
      kind              = ${input.kind},
      title             = ${input.title.trim().slice(0, 200)},
      body              = CASE WHEN ${setBody}::boolean THEN ${body}::text ELSE body END,
      body_doc          = CASE WHEN ${setDoc}::boolean THEN ${doc ? db.json(doc as never) : null}::jsonb ELSE body_doc END,
      body_format       = CASE WHEN ${doc !== null}::boolean THEN 'doc'
                               WHEN ${setDoc}::boolean AND body_format = 'doc' THEN 'html'
                               ELSE body_format END,
      excerpt           = ${input.excerpt?.trim() || null},
      status            = ${status},
      visibility        = COALESCE(${access.visibility}::varchar, visibility),
      min_role          = CASE WHEN ${access.minRole !== undefined}::boolean THEN ${access.minRole ?? null}::varchar ELSE min_role END,
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
      metadata          = (COALESCE(metadata, '{}'::jsonb) - 'coverImageUrl' - 'timeZone' - ${dropMeta}::text[]) || ${db.json(meta)} || ${db.json(formMeta as never)},
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
  const [current] = await db<Array<{ nextcloud_talk_token: string | null; document_url: string | null; nc: string | null; visibility: string; min_role: string | null; circle: string | null }>>`
    SELECT t.nextcloud_talk_token, t.document_url, u.nextcloud_user_id AS nc,
           t.visibility, t.min_role, o.nextcloud_circle_id AS circle
    FROM threads t JOIN users u ON u.id = t.author_id
    LEFT JOIN organizations o ON o.id = t.org_id
    WHERE t.id = ${threadId}
  `;
  if (wantTalk && current?.nextcloud_talk_token) {
    // Already has one: if the audience has narrowed since, make it unlisted / circle-only.
    await syncTalkRoomAudience(current.nextcloud_talk_token, current.visibility, current.min_role, current.circle);
  }
  if (wantTalk && !current?.nextcloud_talk_token) {
    try {
      // Public thread: a public, listable room (type 3; guests join from the link).
      // Anything else: unlisted, and restricted to the org circle when there is one.
      const policy = talkRoomPolicy(current?.visibility, current?.min_role, current?.circle);
      const token = await createTalkRoom(title, policy.type, { moderator: current?.nc ?? null, listable: policy.listable, circle: policy.circle });
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
  threadId?: string | null,
  /**
   * `autosave`: a save the person did not press (the publication forms' draft autosave,
   * 2026-11-08). It may only touch a draft: over a pending or published row it is refused
   * and nothing is written, since an explicit "Save draft" there means "take it down", and
   * an autosave must never mean that.
   */
  opts: { autosave?: boolean } = {}
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
    if (opts.autosave && row.status !== 'draft') {
      return { ok: false, error: 'Not saved automatically: it is no longer a draft. Press Save to update it.' };
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
        // writeColumns sets the audience right after; this only satisfies the NOT NULL column.
        visibility: readAccess(input).visibility ?? 'PUBLIC',
        scheduledAt: input.scheduledAt,
      });
      id = created.id;
    }
    await writeColumns(id, orgId, input, status);
    const warnings = [
      // A draft makes no rooms: a public, listable Talk room named after a half-typed title
      // (an autosave, or "Save draft") is a leak. They are made once it is submitted or published.
      ...(status === 'draft' ? [] : await attachRooms(orgId, id, title, input)),
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

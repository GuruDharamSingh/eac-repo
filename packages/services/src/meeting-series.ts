import { db } from '@elkdonis/db';
import { emailHtmlToText, sanitizeRichText } from '@elkdonis/utils';
import { nanoid } from 'nanoid';
import { createThread } from './posts';
import { CO_HOST_ROLE, HOST_ROLE, assignMeetingRole, clearMeetingRole, getRoleHolder } from './meeting-rota';
import type { RotaAssignment } from './meeting-rota';
import { checkRsvpEligibility, countConfirmedRsvps, deleteRsvp, setRsvpStatus } from './thread-rsvp';
import { SERIES_KIND, SERIES_SESSION_KIND } from './thread-kinds';
import { getOrgRole } from './org-membership';
import { createTalkRoom } from './nextcloud';
import type { MeetingMaterial } from './standing-meeting';

/**
 * A meeting series: one recurring `threads` row whose occurrences are weeks
 * that different people host, each with its own title, summary, materials
 * and RSVP list. The public face is a series page ("Art for Non-Professionals"
 * on IFAC); the member face is the hub's Series planner.
 *
 * Storage (migration 201):
 *   - the series itself is the recurring thread (kind `series`; WEEKLY).
 *     `meeting` and `event` are read as legacy aliases until the IFAC row
 *     flips (docs/open/SERIES_KIND_DESIGN_2026-10-10.md, step 4)
 *   - who hosts a week: `meeting_hosts` (migration 136)
 *   - what a week is: `meeting_occurrence_notes.title/summary/materials/
 *     cover_image_url`, beside the rota's `plan` and the record's `note`
 *   - RSVP per week: `thread_rsvps` is keyed by thread, so each week that
 *     anyone RSVPs to gets a `series_session` thread (same move as the
 *     reading circles' per-sitting topic), linked from
 *     `meeting_occurrence_notes.topic_thread_id` and carrying
 *     `metadata.seriesSession = { seriesId, occurrenceAt, number }`.
 *     The kind is in OFF_FEED_KINDS, so sessions never reach feeds, the forum
 *     or search, and it is not in SCHEDULED_KINDS, so the calendar shows the
 *     series once, not once per week.
 *
 * Occurrence keys follow meeting-rota.ts: JS-computed ISO instants, compared
 * only against values that made the same trip.
 *
 * Occurrences step in the series' own zone (`metadata.timeZone`), keeping
 * the wall-clock time across daylight-saving changes (2026-10-10): a series
 * at 6:00 pm Pacific stays at 6:00 pm Pacific after 1 November. Without a
 * zone the clock is UTC, which is the same stepping as `expandOccurrences`.
 * Only this module uses the zoned clock; reading circles, the rota face and
 * the calendar still step in UTC (`packages/utils/src/recurrence.ts`).
 *
 * Drafts (2026-10-10): a week is public (series page, landing, emails' list
 * of coming sessions) only once it has a title and an organiser has
 * published it, and is not cancelled. The flag is
 * `series_sessions.published_at` (migration 203); publishing also keeps
 * writing `metadata.seriesSession.publishedAt` on the week's thread for one
 * release.
 *
 * Materialised weeks (migration 203, design §3): the rule still produces
 * empty future slots; a slot becomes a `series_sessions` row (keyed by the
 * week's `series_session` thread) the first time anything is written to it:
 * a host, a write-up, publishing, an RSVP, a comment, a cancel or a move.
 * The row holds the week's stable `number`, its rule `slot_at`, the
 * `starts_at` it actually meets at (a move changes only this), `status`
 * (`scheduled|cancelled`) and `published_at`. A row wins over the rule slot
 * it belongs to. `meeting_occurrence_notes` and `meeting_hosts` stay keyed
 * by `(series thread, starts_at)`; a move rewrites both keys and the week's
 * `scheduled_at` in one transaction. Weeks without a row are numbered from
 * the rule plus `metadata.series.numberOffset`, which `saveSeriesSchedule`
 * sets so that a schedule change keeps every number.
 *
 * Subscriptions (2026-10-10): a `thread_rsvps` row with status `subscribed`
 * on the series' own thread (migration 202 widens the CHECK). Not `yes`:
 * every generic RSVP reader counts `yes` as attendance. Attendance for a
 * week stays on that week's topic thread.
 */

/**
 * Kinds a series row may carry: `series`, plus `meeting`/`event` as legacy
 * aliases until IFAC's series is flipped to `series` (design step 4; drop the
 * aliases one stable release after). `workshop` was accepted before
 * 2026-10-10 and dropped: no published workshop was ever a series.
 */
const SERIES_ROW_KINDS: string[] = [SERIES_KIND, 'meeting', 'event'];

// ─── The series clock ────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** What the clock needs from a series row. */
export interface SeriesClock {
  scheduledAt: string | Date | null;
  recurrencePattern?: string | null;
  recurrenceUntil?: string | Date | null;
  /** IANA zone the series keeps its wall-clock time in; UTC when absent. */
  timeZone?: string | null;
  /** WEEKLY only: meets every n weeks (`metadata.series.interval`, 1–4; 2026-10-18). */
  intervalWeeks?: number | null;
}

/** 1–4, from stored or posted values; 1 when absent or unusable. */
export function intervalWeeksOf(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 4 ? n : 1;
}

/** The zone if Intl knows it, else null. */
export function validTimeZone(zone: string | null | undefined): string | null {
  if (!zone || typeof zone !== 'string') return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone;
  } catch {
    return null;
  }
}

const wallFormatters = new Map<string, Intl.DateTimeFormat>();

/** The wall clock in `zone` at instant `ms`. */
function wallClock(ms: number, zone: string): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
  let f = wallFormatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    wallFormatters.set(zone, f);
  }
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(new Date(ms))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  return { y: p.year, mo: p.month, d: p.day, h: p.hour === 24 ? 0 : p.hour, mi: p.minute, s: p.second };
}

/** Local minus UTC, in ms, at instant `ms`. */
function zoneOffsetMs(ms: number, zone: string): number {
  const w = wallClock(ms, zone);
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - Math.floor(ms / 1000) * 1000;
}

/** The instant at which the wall clock in `zone` reads the given local time. Day overflow is allowed. */
function zonedInstant(y: number, mo: number, d: number, h: number, mi: number, s: number, ms: number, zone: string): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s, ms);
  const first = guess - zoneOffsetMs(guess, zone);
  // Second pass: the offset at the guess and at the answer differ across a
  // daylight-saving change.
  return guess - zoneOffsetMs(first, zone);
}

function stepDaysOf(pattern: string | null | undefined): number {
  switch ((pattern ?? '').toUpperCase()) {
    case 'DAILY':
      return 1;
    case 'MONTHLY':
      return 30; // matches recurrenceIntervalMs in @elkdonis/utils
    default:
      return 7;
  }
}

function clockParts(clock: SeriesClock) {
  if (!clock.scheduledAt) return null;
  const anchor = new Date(clock.scheduledAt).getTime();
  if (Number.isNaN(anchor)) return null;
  const zone = validTimeZone(clock.timeZone) ?? 'UTC';
  const pattern = clock.recurrencePattern && clock.recurrencePattern !== 'NONE' ? clock.recurrencePattern : null;
  const untilRaw = clock.recurrenceUntil ? new Date(clock.recurrenceUntil).getTime() : null;
  const until = untilRaw !== null && !Number.isNaN(untilRaw) ? untilRaw : null;
  const stepDays = stepDaysOf(pattern) * ((pattern ?? '').toUpperCase() === 'WEEKLY' ? intervalWeeksOf(clock.intervalWeeks) : 1);
  const wall = wallClock(anchor, zone);
  const msPart = ((anchor % 1000) + 1000) % 1000;
  const nth = (k: number) => zonedInstant(wall.y, wall.mo, wall.d + k * stepDays, wall.h, wall.mi, wall.s, msPart, zone);
  return { anchor, zone, pattern, until, stepMs: stepDays * DAY_MS, nth };
}

/**
 * The next `count` occurrences at or after `from`. Like `occurrencesOf`
 * (meeting-rota.ts), an occurrence at or after `recurrenceUntil` is not one.
 */
export function seriesOccurrencesFrom(clock: SeriesClock, from: Date, count = 8): Date[] {
  const c = clockParts(clock);
  if (!c) return [];
  const limit = Math.max(1, Math.min(count, 104));
  if (!c.pattern) return c.anchor >= from.getTime() ? [new Date(c.anchor)] : [];
  const out: Date[] = [];
  let k = Math.max(0, Math.floor((from.getTime() - c.anchor) / c.stepMs) - 1);
  for (let guard = 0; guard < limit + 8 && out.length < limit; guard++, k++) {
    const t = c.nth(k);
    if (c.until !== null && t >= c.until) break;
    if (t >= from.getTime()) out.push(new Date(t));
  }
  return out;
}

/** Up to `count` occurrences strictly before `before`, oldest first. */
export function seriesOccurrencesBefore(clock: SeriesClock, before: Date, count = 1): Date[] {
  const c = clockParts(clock);
  if (!c || count <= 0) return [];
  if (!c.pattern) return c.anchor < before.getTime() ? [new Date(c.anchor)] : [];
  const out: Date[] = [];
  let k = Math.floor((before.getTime() - c.anchor) / c.stepMs) + 1;
  for (; k >= 0 && out.length < count; k--) {
    const t = c.nth(k);
    if (t >= before.getTime()) continue;
    if (c.until !== null && t >= c.until) continue;
    out.push(new Date(t));
  }
  return out.reverse();
}

/** 1-based position of `at` in the series. */
export function seriesOccurrenceNumber(clock: SeriesClock, at: Date | string): number {
  const c = clockParts(clock);
  if (!c || !c.pattern) return 1;
  // A daylight-saving hour is far smaller than a step, so rounding is exact.
  return Math.max(1, Math.round((new Date(at).getTime() - c.anchor) / c.stepMs) + 1);
}

/** Whether `at` is one of the series' occurrences (to the millisecond). */
export function isSeriesOccurrence(clock: SeriesClock, at: Date | string): boolean {
  const t = new Date(at).getTime();
  if (Number.isNaN(t)) return false;
  const [hit] = seriesOccurrencesFrom(clock, new Date(t - 60_000), 1);
  return Boolean(hit) && hit.getTime() === t;
}

/** The `ordinal`-th occurrence (1-based), or null past `recurrenceUntil` or for a bad ordinal. */
function seriesOccurrenceByOrdinal(clock: SeriesClock, ordinal: number): Date | null {
  const c = clockParts(clock);
  if (!c || !Number.isInteger(ordinal) || ordinal < 1) return null;
  if (!c.pattern) return ordinal === 1 ? new Date(c.anchor) : null;
  const t = c.nth(ordinal - 1);
  if (c.until !== null && t >= c.until) return null;
  return new Date(t);
}

/**
 * The instant a local "YYYY-MM-DDTHH:MM" names in `zone` (e.g. the value of
 * an `<input type="datetime-local">` read in the series' zone), or null.
 */
export function seriesLocalToInstant(local: string, zone: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(local ?? '').trim());
  if (!m) return null;
  const date = parseLocalDate(`${m[1]}-${m[2]}-${m[3]}`);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  if (!date || h > 23 || mi > 59) return null;
  const z = validTimeZone(zone) ?? 'UTC';
  return new Date(zonedInstant(date.y, date.mo, date.d, h, mi, 0, 0, z));
}

function clockOf(row: SeriesRow): SeriesClock {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    scheduledAt: row.scheduled_at,
    recurrencePattern: row.recurrence_pattern,
    recurrenceUntil: row.recurrence_until,
    timeZone: typeof meta.timeZone === 'string' ? meta.timeZone : null,
    intervalWeeks: intervalWeeksOf(((meta.series ?? {}) as Record<string, unknown>).interval),
  };
}

export interface SeriesSession {
  /** ISO instant the week meets at (`series_sessions.starts_at` once materialised); the key for every write. */
  at: string;
  /** The rule slot the week belongs to; differs from `at` when the week was moved. Null for a week with no slot. */
  slotAt: string | null;
  /** Stable week number: `series_sessions.number`, else the rule's ordinal plus `metadata.series.numberOffset`. */
  number: number;
  isPast: boolean;
  /** The first week that has not ended yet and is not cancelled. */
  isNext: boolean;
  /** `series_sessions.status`; a week without a row is `scheduled`. */
  status: 'scheduled' | 'cancelled';
  /** Cancelled: kept for organisers, left out of public lists and reminders (`isPublished` is false). */
  isCancelled: boolean;
  /** Moved off its slot (`starts_at <> slot_at`). */
  isMoved: boolean;
  /**
   * A materialised coming week whose slot is no longer on the series' rule
   * (left behind by a schedule change). Shown to organisers; not public.
   */
  isOffSchedule: boolean;
  title: string | null;
  /** Optional line under the title (migration 205). */
  subtitle: string | null;
  /**
   * Plain text of the write-up. Since migration 205 it is derived from
   * `bodyHtml` when the rich write-up is saved; mail, the .ics feed and page
   * descriptions read it.
   */
  summary: string | null;
  /** The write-up as sanitised rich text; null for weeks written before migration 205. */
  bodyHtml: string | null;
  plan: string | null;
  coverImageUrl: string | null;
  /** How the cover sits in its box; null = centred, no zoom. */
  coverFrame: CoverFrame | null;
  /** What the cover is (migration 206): a picture, an uploaded video, or a YouTube/Vimeo page. */
  coverKind: 'image' | 'video' | 'embed';
  /** A video's still, chosen by the host; null for pictures or when none was given. */
  coverPosterUrl: string | null;
  /** A picture for places that cannot play video (cards, mail, share previews): the picture, or the video's still. */
  coverStillUrl: string | null;
  materials: MeetingMaterial[];
  host: RotaAssignment | null;
  coHost: RotaAssignment | null;
  topicThreadId: string | null;
  rsvpCount: number;
  /** When an organiser published the week (`series_sessions.published_at`). */
  publishedAt: string | null;
  /**
   * Public: has a title, has been published, is not cancelled and (if still
   * to come) is on the series' schedule. Every other week is a draft or
   * cancelled.
   */
  isPublished: boolean;
}

/** The series' schedule as an organiser edits it, read in its own zone. */
export interface SeriesSchedule {
  /** 0 = Sunday … 6 = Saturday, in `timeZone`. */
  weekday: number;
  /** "18:00", in `timeZone`. */
  time: string;
  timeZone: string;
  /** First session's local date, "YYYY-MM-DD". */
  firstDate: string;
  /** Last local date a session may fall on, or null for open-ended. */
  lastDate: string | null;
  durationMinutes: number;
  /** `metadata.series.alsoZones`: zones printed beside the series' own. */
  alsoZones: string[] | null;
  /** Meets every n weeks (1 = weekly). */
  intervalWeeks: number;
}

export interface MeetingSeries {
  id: string;
  orgId: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  scheduledAt: string | null;
  durationMinutes: number | null;
  recurrencePattern: string | null;
  recurrenceUntil: string | null;
  format: string | null;
  location: string | null;
  meetingUrl: string | null;
  videoLink: string | null;
  talkToken: string | null;
  isRsvpEnabled: boolean;
  attendeeLimit: number | null;
  timeZone: string | null;
  /** `metadata.coverImageUrl`: the series' cover picture, or its video's poster. */
  coverImageUrl: string | null;
  /**
   * The series' cover media (`metadata.series.cover`, 2026-10-13): a picture,
   * an uploaded video or a YouTube/Vimeo link, shown under the title on the
   * series page. Falls back to `coverImageUrl` as a picture.
   */
  cover: SeriesCoverMedia | null;
  /** Free-form presentation fields: `metadata.series`. */
  presentation: SeriesPresentation;
  /**
   * How to join: `metadata.joinDetails`. Not for anonymous visitors; render
   * it only behind the same gate as the join link (an RSVP'd viewer) and in
   * mail to people who RSVP'd. Kept out of `meeting_url` on purpose: the
   * forum and the thread surfaces show that column on any PUBLIC thread.
   */
  joinDetails: SeriesJoinDetails;
  /** Days before a published session that subscribers are mailed (`metadata.series.reminderDays`, default 2; 0 = off). */
  reminderDays: number;
  schedule: SeriesSchedule | null;
  sessions: SeriesSession[];
}

export const DEFAULT_SUBSCRIBER_REMINDER_DAYS = 2;

/**
 * How a picture sits in a box of any shape: the focal point in percent (CSS
 * `object-position`) and a zoom (1 = just fills the box, up to 4), scaled
 * about the focal point. The same convention as gallery tiles
 * (`profiles.ts` `fx`/`fy`/`zoom`).
 */
export interface CoverFrame {
  fx: number;
  fy: number;
  zoom: number;
}

/** A series' cover: a picture, an uploaded video, or a YouTube/Vimeo page ("embed"). */
export interface SeriesCoverMedia {
  url: string;
  kind: 'image' | 'video' | 'embed';
  /** Still shown before a video plays. */
  posterUrl?: string | null;
  /** Pictures only. */
  frame?: CoverFrame | null;
}

/** A frame from stored or posted JSON, clamped; null when absent or unusable. */
export function coverFrameOf(value: unknown): CoverFrame | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const num = (x: unknown, lo: number, hi: number, dflt: number) => {
    const n = typeof x === 'number' ? x : typeof x === 'string' ? Number(x) : NaN;
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n * 100) / 100)) : dflt;
  };
  const frame = { fx: num(v.fx, 0, 100, 50), fy: num(v.fy, 0, 100, 50), zoom: num(v.zoom, 1, 4, 1) };
  return frame.fx === 50 && frame.fy === 50 && frame.zoom === 1 ? null : frame;
}

/** A same-site path or an http(s) address; anything else is refused. */
function mediaUrlOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim().slice(0, 1000);
  if (!url) return null;
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol) ? url : null;
  } catch {
    return null;
  }
}

/** A week's cover columns as `SeriesSession` fields (migrations 205, 206). */
function weekCoverFields(url: string | null, frame: unknown, media: unknown) {
  const m = media && typeof media === 'object' ? (media as Record<string, unknown>) : {};
  const kind: 'image' | 'video' | 'embed' = url && (m.kind === 'video' || m.kind === 'embed') ? m.kind : 'image';
  const poster = kind === 'image' ? null : mediaUrlOf(m.posterUrl);
  return {
    coverFrame: url && kind === 'image' ? coverFrameOf(frame) : null,
    coverKind: kind,
    coverPosterUrl: poster,
    coverStillUrl: kind === 'image' ? url : poster,
  };
}

/** A cover from stored or posted JSON; null when it has no usable address. */
export function seriesCoverOf(value: unknown): SeriesCoverMedia | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const url = mediaUrlOf(v.url);
  if (!url) return null;
  const kind = v.kind === 'video' || v.kind === 'embed' ? v.kind : 'image';
  return {
    url,
    kind,
    posterUrl: kind === 'image' ? null : mediaUrlOf(v.posterUrl),
    frame: kind === 'image' ? coverFrameOf(v.frame) : null,
  };
}

/** Rich text as stored: sanitised, and null when nothing readable is left. */
function richOf(html: string | null | undefined): string | null | undefined {
  if (html === undefined) return undefined;
  const clean = sanitizeRichText((html ?? '').slice(0, 60_000)).trim();
  if (!clean) return null;
  const readable = emailHtmlToText(clean).trim() !== '' || /<(img|iframe|video)\b/i.test(clean);
  return readable ? clean : null;
}

/** `threads.metadata.joinDetails`: the private half of a series' joining instructions. */
export interface SeriesJoinDetails {
  /** The join link (Zoom or similar). Wins over `meeting_url`/`video_link`. */
  url?: string | null;
  meetingId?: string | null;
  passcode?: string | null;
  /** Free text: dial-in numbers, SIP, H.323, one line per way. */
  other?: string | null;
}

/**
 * The link a series' attendees use: `metadata.joinDetails.url`, then the
 * thread's `meeting_url`, then `video_link`, then the Talk room when a base
 * URL is given.
 *
 * A calendar-file link is skipped (2026-10-10): Zoom's invitation carries an
 * "add to calendar" link (`…/meeting/<id>/ics?icsToken=…`) that is easy to
 * paste as the join link, and "Join the session" then downloaded an `.ics`.
 * When the skipped link is a Zoom one and the meeting ID is known, the join
 * link is `https://<zoom host>/j/<id>`; Zoom asks for the passcode, which the
 * join details show.
 */
export function seriesJoinUrl(series: MeetingSeries, talkBaseUrl?: string | null): string | null {
  const talk = series.talkToken && talkBaseUrl ? `${talkBaseUrl.replace(/\/$/, '')}/call/${series.talkToken}` : null;
  const pasted = series.joinDetails.url?.trim() || null;
  if (pasted && !isCalendarFileUrl(pasted)) return pasted;
  const fromId = pasted ? zoomJoinUrlFromId(pasted, series.joinDetails.meetingId) : null;
  const usable = (u: string | null | undefined) => (u && !isCalendarFileUrl(u) ? u : null);
  return fromId ?? usable(series.meetingUrl) ?? usable(series.videoLink) ?? talk;
}

/** A link that downloads a calendar file instead of opening a meeting: `.ics`, Zoom's `/ics?icsToken=`, `webcal:`. */
export function isCalendarFileUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'webcal:' || /(\.ics|\/ics)\/?$/i.test(u.pathname) || u.searchParams.has('icsToken');
  } catch {
    return false;
  }
}

/** `https://<zoom host>/j/<digits>` when `url` is on zoom.us and the meeting ID has 9 to 12 digits. */
function zoomJoinUrlFromId(url: string, meetingId: string | null | undefined): string | null {
  const digits = (meetingId ?? '').replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 12) return null;
  try {
    const u = new URL(url);
    if (!/(^|\.)zoom\.us$/i.test(u.hostname)) return null;
    return `https://${u.hostname}/j/${digits}`;
  } catch {
    return null;
  }
}

/** `threads.metadata.series`: copy the public page shows around the title. */
export interface SeriesPresentation {
  /** "Elkdonis Arts Collective presents" */
  eyebrow?: string | null;
  /** "by International Fine Art Collectors" */
  byline?: string | null;
  /** Shown under the title on the series page and the landing hero. */
  lede?: string | null;
  /** Extra zones to print beside the series' own zone, e.g. Central/Pacific. */
  alsoZones?: string[] | null;
  /** Days before a published session that subscribers are mailed. */
  reminderDays?: number | null;
  /** The series' cover media; read through `seriesCoverOf`. */
  cover?: SeriesCoverMedia | null;
  /** The series' colour on the Series page (dot, row edge, calendar chip): an id from `SERIES_ACCENTS` (series-page.ts). */
  accent?: string | null;
  /** Listed on the public Series page and in the landing slides; absent = listed (2026-10-18). */
  listed?: boolean | null;
  /** The card's rhythm line in the organiser's own words; absent = from the schedule ("Weekly · Mondays"). */
  rhythm?: string | null;
  /** 'hide' leaves the status label ("Running", "Starts 5 Nov") off the card; absent = shown. */
  statusChip?: 'hide' | null;
  /**
   * Added to the rule's ordinal to number a week that has no
   * `series_sessions` row. Written by `saveSeriesSchedule` so that a
   * schedule change keeps the numbers (and `/series/<slug>/<n>` links).
   */
  numberOffset?: number | null;
}

interface SeriesRow {
  id: string;
  org_id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  scheduled_at: Date | null;
  duration_minutes: number | null;
  recurrence_pattern: string | null;
  recurrence_until: Date | null;
  format: string | null;
  location: string | null;
  meeting_url: string | null;
  video_link: string | null;
  nextcloud_talk_token: string | null;
  is_rsvp_enabled: boolean;
  attendee_limit: number | null;
  metadata: Record<string, unknown> | null;
}

async function loadSeries(orgId: string, ref: { threadId?: string; slug?: string }): Promise<SeriesRow | null> {
  if (!ref.threadId && !ref.slug) return null;
  const [row] = await db<SeriesRow[]>`
    SELECT id, org_id, slug, title, excerpt, body, scheduled_at, duration_minutes,
           recurrence_pattern, recurrence_until, format, location, meeting_url, video_link,
           nextcloud_talk_token, is_rsvp_enabled, attendee_limit, metadata
    FROM threads
    WHERE org_id = ${orgId}
      AND status = 'published'
      AND kind = ANY(${SERIES_ROW_KINDS})
      AND ${ref.threadId ? db`id = ${ref.threadId}` : db`slug = ${ref.slug!}`}
    LIMIT 1
  `;
  return row ?? null;
}

function materialsOf(value: unknown): MeetingMaterial[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((m): m is Record<string, unknown> => Boolean(m) && typeof m === 'object')
    .map((m) => ({
      id: String(m.id ?? nanoid(8)),
      name: String(m.name ?? ''),
      url: String(m.url ?? ''),
      kind: (['image', 'video', 'audio', 'document'].includes(String(m.kind)) ? m.kind : 'document') as MeetingMaterial['kind'],
      mimeType: typeof m.mimeType === 'string' ? m.mimeType : null,
      size: typeof m.size === 'number' ? m.size : null,
      external: Boolean(m.external),
    }))
    .filter((m) => m.url);
}


/** `site_config` key naming the series an org presents on its landing page. */
const PRESENTED_KEY = 'presented_series';

export async function getPresentedSeriesId(orgId: string): Promise<string | null> {
  const [row] = await db<Array<{ value: { threadId?: string } | null }>>`
    SELECT value FROM site_config WHERE org_id = ${orgId} AND key = ${PRESENTED_KEY}
  `;
  const id = row?.value?.threadId;
  return typeof id === 'string' && id ? id : null;
}

/** Recurring meetings an org could present as a series (for the hub face). */
export async function listMeetingSeries(orgId: string): Promise<Array<{ id: string; slug: string; title: string; scheduledAt: string | null; recurrencePattern: string | null }>> {
  const rows = await db<Array<{ id: string; slug: string; title: string; scheduled_at: Date | null; recurrence_pattern: string | null }>>`
    SELECT id, slug, title, scheduled_at, recurrence_pattern FROM threads
    WHERE org_id = ${orgId} AND status = 'published'
      AND kind = ANY(${SERIES_ROW_KINDS})
      AND recurrence_pattern IS NOT NULL
    ORDER BY scheduled_at DESC NULLS LAST
  `;
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    scheduledAt: r.scheduled_at ? new Date(r.scheduled_at).toISOString() : null,
    recurrencePattern: r.recurrence_pattern,
  }));
}

// ─── Materialised weeks (series_sessions, migration 203) ─────────────────────

/** A `series_sessions` row whose week thread is not archived. */
interface SessionRow {
  session_thread_id: string;
  number: number;
  slot_at: Date | null;
  starts_at: Date;
  status: string;
  published_at: Date | null;
}

const msOf = (d: Date | string | null | undefined): number => (d ? new Date(d).getTime() : NaN);
const isoOf = (d: Date | string): string => new Date(d).toISOString();

/**
 * The series' materialised weeks. A row whose week thread was archived
 * (removed) does not count; `ensureSeriesSession` clears such a row before
 * it materialises the slot again.
 */
async function loadSessionRows(orgId: string, seriesId: string, q: typeof db = db): Promise<SessionRow[]> {
  return q<SessionRow[]>`
    SELECT ss.session_thread_id, ss.number, ss.slot_at, ss.starts_at, ss.status, ss.published_at
    FROM series_sessions ss
    JOIN threads t ON t.id = ss.session_thread_id AND t.org_id = ss.org_id
    WHERE ss.series_id = ${seriesId}
      AND ss.org_id = ${orgId}
      AND t.status <> 'archived'
    ORDER BY ss.starts_at
  `;
}

function numberOffsetOf(row: SeriesRow): number {
  const series = ((row.metadata ?? {}) as Record<string, unknown>).series as Record<string, unknown> | undefined;
  const n = Number(series?.numberOffset);
  return Number.isInteger(n) ? n : 0;
}

/** The number a week without a row takes: the rule's ordinal plus the offset, at least 1. */
function derivedNumber(clock: SeriesClock, offset: number, at: Date | string): number {
  return Math.max(1, seriesOccurrenceNumber(clock, at) + offset);
}

/** One week before its notes, hosts and counts are attached. */
interface WeekEntry {
  at: string;
  slotAt: string | null;
  number: number;
  row: SessionRow | null;
  cancelled: boolean;
  onSchedule: boolean;
}

/**
 * The weeks around `from`: the series' materialised rows merged with the
 * rule's empty slots, ordered by when they meet. A row wins for its
 * `slot_at`, its `starts_at` and its `number`, so a moved week is listed at
 * its new time and the rule slot it left is not listed twice (and a slot the
 * rule would number like a row, e.g. a past date of a changed schedule, is
 * not listed). Returns the last `pastCount` weeks before `from` and the first
 * `count` at or after it.
 */
function weekEntries(row: SeriesRow, rows: SessionRow[], from: Date, count: number, pastCount: number): WeekEntry[] {
  const clock = clockOf(row);
  const offset = numberOffsetOf(row);
  const margin = rows.length;
  const upcoming = seriesOccurrencesFrom(clock, from, count + margin);
  const past = pastCount > 0 ? seriesOccurrencesBefore(clock, from, pastCount + margin) : [];
  const slots = new Set(rows.map((r) => msOf(r.slot_at)).filter((t) => !Number.isNaN(t)));
  const starts = new Set(rows.map((r) => msOf(r.starts_at)));
  const numbers = new Set(rows.map((r) => r.number));

  const entries: WeekEntry[] = rows.map((r) => ({
    at: isoOf(r.starts_at),
    slotAt: r.slot_at ? isoOf(r.slot_at) : null,
    number: r.number,
    row: r,
    cancelled: r.status === 'cancelled',
    onSchedule: r.slot_at ? isSeriesOccurrence(clock, r.slot_at) : false,
  }));
  for (const d of [...past, ...upcoming]) {
    const t = d.getTime();
    const n = derivedNumber(clock, offset, d);
    if (slots.has(t) || starts.has(t) || numbers.has(n)) continue;
    entries.push({ at: d.toISOString(), slotAt: d.toISOString(), number: n, row: null, cancelled: false, onSchedule: true });
  }
  entries.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.number - b.number);
  const f = from.getTime();
  const before = entries.filter((e) => Date.parse(e.at) < f);
  const after = entries.filter((e) => Date.parse(e.at) >= f);
  return [...(pastCount > 0 ? before.slice(-pastCount) : []), ...after.slice(0, count)];
}

/** What a write addresses: the week meeting at `at`. */
interface ResolvedWeek {
  row: SessionRow | null;
  /** The rule slot (null for a row with none). */
  slotAt: string | null;
  /** When it meets: the key in `meeting_occurrence_notes` / `meeting_hosts`. */
  startsAt: string;
  number: number;
}

/**
 * The week a write for instant `at` belongs to: the row meeting at `at`;
 * else the row whose slot is `at` (a moved week still answers to its old
 * instant, so links mailed before the move keep working); else the rule's
 * empty slot at `at`. Null when `at` is none of these, or when the slot's
 * number is already held by a row (such a slot is not listed either).
 */
async function resolveWeek(series: SeriesRow, at: string | Date, rows?: SessionRow[]): Promise<ResolvedWeek | null> {
  const t = msOf(at);
  if (Number.isNaN(t)) return null;
  const list = rows ?? (await loadSessionRows(series.org_id, series.id));
  const toWeek = (r: SessionRow): ResolvedWeek => ({
    row: r,
    slotAt: r.slot_at ? isoOf(r.slot_at) : null,
    startsAt: isoOf(r.starts_at),
    number: r.number,
  });
  const byStart =
    list.find((r) => msOf(r.starts_at) === t && r.status !== 'cancelled') ?? list.find((r) => msOf(r.starts_at) === t);
  if (byStart) return toWeek(byStart);
  const bySlot = list.find((r) => msOf(r.slot_at) === t);
  if (bySlot) return toWeek(bySlot);
  const clock = clockOf(series);
  if (!isSeriesOccurrence(clock, new Date(t))) return null;
  const n = derivedNumber(clock, numberOffsetOf(series), new Date(t));
  if (list.some((r) => r.number === n)) return null;
  const iso = new Date(t).toISOString();
  return { row: null, slotAt: iso, startsAt: iso, number: n };
}

/**
 * The series with its coming weeks. `from` defaults to the start of the
 * current occurrence (so a week stays "this week" until it has ended);
 * `pastCount` adds that many finished weeks in front for the planner.
 *
 * Weeks come from `weekEntries`: materialised rows (moved weeks at their new
 * time, cancelled weeks flagged) merged with the rule's empty slots.
 */
export async function getMeetingSeries(
  orgId: string,
  ref: { threadId?: string; slug?: string },
  options: { from?: Date; count?: number; pastCount?: number } = {}
): Promise<MeetingSeries | null> {
  const row = await loadSeries(orgId, ref);
  if (!row) return null;
  const rows = await loadSessionRows(row.org_id, row.id);
  return buildSeries(row, rows, options);
}

/**
 * Week `number` of a series with the weeks around it (for `/series/<slug>/<n>`).
 * Resolves by `(series_id, number)` first, then by the rule's ordinal plus
 * `metadata.series.numberOffset`. Null when there is no such week.
 */
export async function getMeetingSeriesWeek(
  orgId: string,
  ref: { threadId?: string; slug?: string },
  number: number,
  options: { count?: number; pastCount?: number } = {}
): Promise<{ series: MeetingSeries; week: SeriesSession } | null> {
  if (!Number.isInteger(number) || number < 1) return null;
  const row = await loadSeries(orgId, ref);
  if (!row) return null;
  const rows = await loadSessionRows(row.org_id, row.id);
  let at: Date | null = null;
  const hit = rows.find((r) => r.number === number);
  if (hit) {
    at = new Date(hit.starts_at);
  } else {
    const slot = seriesOccurrenceByOrdinal(clockOf(row), number - numberOffsetOf(row));
    const week = slot ? await resolveWeek(row, slot, rows) : null;
    if (week && !week.row && week.number === number) at = new Date(week.startsAt);
  }
  if (!at) return null;
  const series = await buildSeries(row, rows, { from: at, count: options.count ?? 13, pastCount: options.pastCount ?? 12 });
  const week = series.sessions.find((s) => s.number === number) ?? null;
  return week ? { series, week } : null;
}

async function buildSeries(
  row: SeriesRow,
  rows: SessionRow[],
  options: { from?: Date; count?: number; pastCount?: number }
): Promise<MeetingSeries> {
  const duration = row.duration_minutes ?? 60;
  const now = Date.now();
  // Occurrences are keyed by start; a week is "current" until its end.
  const current = new Date(now - duration * 60_000);
  const from = options.from ?? current;
  const count = options.count ?? 8;
  const pastCount = Math.max(0, options.pastCount ?? 0);

  const entries = weekEntries(row, rows, from, count, pastCount);
  // "This week" is the first week not yet ended and not cancelled, wherever
  // the requested window starts.
  const nextAt =
    weekEntries(row, rows, current, rows.length + 1, 0).find((e) => !e.cancelled && e.onSchedule)?.at ?? null;
  const isos = entries.map((e) => e.at);

  type HostRow = { occurrence_at: Date; role: string; user_id: string | null; note: string | null; display_name: string | null; email: string | null };
  type NoteRow = {
    occurrence_at: Date;
    title: string | null;
    subtitle: string | null;
    summary: string | null;
    body_html: string | null;
    plan: string | null;
    cover_image_url: string | null;
    cover_frame: unknown;
    cover_media: unknown;
    materials: unknown;
    topic_thread_id: string | null;
    legacy_published_at: string | null;
  };
  const hosts: HostRow[] = isos.length
    ? await db<HostRow[]>`
        SELECT h.occurrence_at, h.role, h.user_id, h.note, u.display_name, u.email
        FROM meeting_hosts h LEFT JOIN users u ON u.id = h.user_id
        WHERE h.thread_id = ${row.id} AND h.occurrence_at = ANY(${isos}::timestamptz[])
      `
    : [];
  // legacy_published_at: a week thread made before migration 203 that has no
  // row yet (ensureSeriesSession adopts it on the next write).
  const notes: NoteRow[] = isos.length
    ? await db<NoteRow[]>`
        SELECT n.occurrence_at, n.title, n.subtitle, n.summary, n.body_html, n.plan,
               n.cover_image_url, n.cover_frame, n.cover_media, n.materials,
               t.id AS topic_thread_id,
               t.metadata->'seriesSession'->>'publishedAt' AS legacy_published_at
        FROM meeting_occurrence_notes n
        LEFT JOIN threads t ON t.id = n.topic_thread_id AND t.org_id = ${row.org_id} AND t.status <> 'archived'
        WHERE n.thread_id = ${row.id} AND n.occurrence_at = ANY(${isos}::timestamptz[])
      `
    : [];
  const noteByAt = new Map(notes.map((n) => [new Date(n.occurrence_at).toISOString(), n]));
  const topicOf = (e: WeekEntry) => e.row?.session_thread_id ?? noteByAt.get(e.at)?.topic_thread_id ?? null;
  const topicIds = entries.map(topicOf).filter((id): id is string => Boolean(id));
  const counts: Array<{ thread_id: string; n: string }> = topicIds.length
    ? await db<Array<{ thread_id: string; n: string }>>`
        SELECT thread_id, COUNT(*)::text AS n FROM thread_rsvps
        WHERE thread_id = ANY(${topicIds}) AND status = 'yes' GROUP BY thread_id
      `
    : [];
  const countByTopic = new Map(counts.map((c) => [c.thread_id, Number(c.n)]));
  const hostByAt = new Map<string, RotaAssignment[]>();
  for (const h of hosts) {
    const key = new Date(h.occurrence_at).toISOString();
    const list = hostByAt.get(key) ?? [];
    list.push({ role: h.role, userId: h.user_id, displayName: h.display_name, email: h.email, note: h.note });
    hostByAt.set(key, list);
  }

  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const presentation = ((meta.series ?? {}) as SeriesPresentation) || {};

  const sessions: SeriesSession[] = entries.map((e) => {
    const at = e.at;
    const roles = hostByAt.get(at) ?? [];
    const note = noteByAt.get(at);
    const topicThreadId = topicOf(e);
    const isPast = Date.parse(at) + duration * 60_000 < now;
    const publishedAt = e.row
      ? e.row.published_at
        ? isoOf(e.row.published_at)
        : null
      : note?.legacy_published_at || null;
    const offSchedule = !e.onSchedule && !isPast;
    return {
      at,
      slotAt: e.slotAt,
      number: e.number,
      isPast,
      isNext: at === nextAt,
      status: e.cancelled ? 'cancelled' : 'scheduled',
      isCancelled: e.cancelled,
      isMoved: Boolean(e.slotAt) && e.slotAt !== at,
      isOffSchedule: offSchedule,
      title: note?.title ?? null,
      subtitle: note?.subtitle ?? null,
      summary: note?.summary ?? null,
      bodyHtml: note?.body_html ?? null,
      plan: note?.plan ?? null,
      coverImageUrl: note?.cover_image_url ?? null,
      ...weekCoverFields(note?.cover_image_url ?? null, note?.cover_frame, note?.cover_media),
      materials: materialsOf(note?.materials),
      host: roles.find((r) => r.role === HOST_ROLE) ?? null,
      coHost: roles.find((r) => r.role === CO_HOST_ROLE) ?? null,
      topicThreadId,
      rsvpCount: topicThreadId ? countByTopic.get(topicThreadId) ?? 0 : 0,
      publishedAt,
      isPublished: Boolean(publishedAt && note?.title) && !e.cancelled && !offSchedule,
    };
  });

  return {
    id: row.id,
    orgId: row.org_id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
    durationMinutes: row.duration_minutes,
    recurrencePattern: row.recurrence_pattern,
    recurrenceUntil: row.recurrence_until ? new Date(row.recurrence_until).toISOString() : null,
    format: row.format,
    location: row.location,
    meetingUrl: row.meeting_url,
    videoLink: row.video_link,
    talkToken: row.nextcloud_talk_token,
    isRsvpEnabled: row.is_rsvp_enabled,
    attendeeLimit: row.attendee_limit,
    timeZone: typeof meta.timeZone === 'string' ? meta.timeZone : null,
    coverImageUrl: typeof meta.coverImageUrl === 'string' && meta.coverImageUrl ? meta.coverImageUrl : null,
    cover:
      seriesCoverOf(presentation.cover) ??
      (typeof meta.coverImageUrl === 'string' && meta.coverImageUrl ? seriesCoverOf({ url: meta.coverImageUrl, kind: 'image' }) : null),
    presentation,
    joinDetails: joinDetailsOf(meta.joinDetails),
    reminderDays: reminderDaysOf(presentation.reminderDays),
    schedule: scheduleOf(row),
    sessions,
  };
}

function reminderDaysOf(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return DEFAULT_SUBSCRIBER_REMINDER_DAYS;
  return Math.max(0, Math.min(14, Math.round(n)));
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** The schedule read back in the series' zone (UTC when it has none). */
function scheduleOf(row: SeriesRow): SeriesSchedule | null {
  if (!row.scheduled_at) return null;
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const zone = validTimeZone(typeof meta.timeZone === 'string' ? meta.timeZone : null) ?? 'UTC';
  const anchor = new Date(row.scheduled_at).getTime();
  const w = wallClock(anchor, zone);
  let lastDate: string | null = null;
  if (row.recurrence_until) {
    // `until` is exclusive; the last date is the local day of the instant before it.
    const l = wallClock(new Date(row.recurrence_until).getTime() - 1, zone);
    lastDate = `${l.y}-${pad2(l.mo)}-${pad2(l.d)}`;
  }
  const series = (meta.series ?? {}) as SeriesPresentation;
  return {
    weekday: new Date(Date.UTC(w.y, w.mo - 1, w.d)).getUTCDay(),
    time: `${pad2(w.h)}:${pad2(w.mi)}`,
    timeZone: zone,
    firstDate: `${w.y}-${pad2(w.mo)}-${pad2(w.d)}`,
    lastDate,
    durationMinutes: row.duration_minutes ?? 60,
    alsoZones: Array.isArray(series.alsoZones) ? series.alsoZones.filter((z): z is string => typeof z === 'string') : null,
    intervalWeeks: intervalWeeksOf((series as Record<string, unknown>).interval),
  };
}

function joinDetailsOf(value: unknown): SeriesJoinDetails {
  const v = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const str = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : null);
  return { url: str(v.url), meetingId: str(v.meetingId), passcode: str(v.passcode), other: str(v.other) };
}

export interface SaveSeriesSettingsInput {
  orgId: string;
  threadId: string;
  /** `undefined` leaves a field alone; `null` or '' clears it (title cannot be cleared). */
  title?: string | null;
  lede?: string | null;
  joinUrl?: string | null;
  meetingId?: string | null;
  passcode?: string | null;
  otherWaysToJoin?: string | null;
  /** Days before a published session that subscribers are mailed; 0 turns it off. */
  reminderDays?: number | null;
  /** The series' cover media; null removes it. Also sets `metadata.coverImageUrl` (the picture, or a video's poster). */
  cover?: SeriesCoverMedia | null;
  /** "About the series" as rich text (`threads.body`), sanitised here. */
  bodyHtml?: string | null;
  /** Colour id (`SERIES_ACCENTS`); null clears it. */
  accent?: string | null;
  /** Listed on the Series page and in the landing slides. */
  listed?: boolean;
  /** In the landing page's slides; absent = as `listed`. */
  landing?: boolean;
  /** The card's rhythm line; null or '' = from the schedule. */
  rhythm?: string | null;
  /** Show the status label on the card ('auto') or not ('hide'). */
  statusChip?: 'auto' | 'hide';
}

/**
 * Write the series-level settings: the name (`threads.title`; the slug is
 * left alone so existing links keep working), the lede
 * (`metadata.series.lede`) and the joining instructions
 * (`metadata.joinDetails`). Both metadata keys are merged, so other keys
 * written by other features survive. A rename also re-titles the weeks'
 * `series_session` topics, which embed the series name and which RSVP and
 * reminder mail fall back to. The caller authorises (organisers only).
 */
export async function saveSeriesSettings(input: SaveSeriesSettingsInput): Promise<void> {
  const series = await loadSeries(input.orgId, { threadId: input.threadId });
  if (!series) throw new Error('Series not found');

  const clean = (v: string | null | undefined, max: number) =>
    v === undefined ? undefined : (v ?? '').trim().slice(0, max) || null;
  const title = clean(input.title, 200);
  if (input.title !== undefined && !title) throw new Error('The series needs a title.');
  const lede = clean(input.lede, 1000);
  const joinUrl = clean(input.joinUrl, 1000);
  if (joinUrl) {
    let ok = false;
    try {
      ok = ['http:', 'https:'].includes(new URL(joinUrl).protocol);
    } catch {
      ok = false;
    }
    if (!ok) throw new Error('The join link must start with https://');
  }
  const join: Record<string, string | null> = {};
  if (joinUrl !== undefined) join.url = joinUrl;
  const meetingId = clean(input.meetingId, 100);
  if (meetingId !== undefined) join.meetingId = meetingId;
  const passcode = clean(input.passcode, 100);
  if (passcode !== undefined) join.passcode = passcode;
  const other = clean(input.otherWaysToJoin, 4000);
  if (other !== undefined) join.other = other;

  // Merge rather than assign: metadata carries timeZone, coverImageUrl and
  // the rest of metadata.series (eyebrow, byline, alsoZones).
  let metadata = db`COALESCE(metadata, '{}'::jsonb)`;
  const seriesPatch: Record<string, unknown> = {};
  if (lede !== undefined) seriesPatch.lede = lede;
  if (input.accent !== undefined) seriesPatch.accent = typeof input.accent === 'string' && /^[a-z]{2,16}$/.test(input.accent) ? input.accent : null;
  if (typeof input.listed === 'boolean') seriesPatch.listed = input.listed;
  if (typeof input.landing === 'boolean') seriesPatch.landing = input.landing;
  if (input.rhythm !== undefined) seriesPatch.rhythm = (input.rhythm ?? '').trim().slice(0, 80) || null;
  if (input.statusChip !== undefined) seriesPatch.statusChip = input.statusChip === 'hide' ? 'hide' : null;
  if (input.reminderDays !== undefined) {
    seriesPatch.reminderDays = input.reminderDays === null ? null : reminderDaysOf(input.reminderDays);
  }
  let coverPatch: Record<string, unknown> | null = null;
  if (input.cover !== undefined) {
    const cover = input.cover === null ? null : seriesCoverOf(input.cover);
    if (input.cover !== null && !cover) throw new Error('The cover needs an address starting with https:// or /.');
    seriesPatch.cover = cover;
    // The picture other pages fall back to (landing, this week's card).
    coverPatch = { coverImageUrl: cover ? (cover.kind === 'image' ? cover.url : cover.posterUrl ?? null) : null };
  }
  if (Object.keys(seriesPatch).length > 0) {
    metadata = db`jsonb_set(${metadata}, '{series}', COALESCE(metadata->'series', '{}'::jsonb) || ${db.json(seriesPatch as never)})`;
  }
  if (Object.keys(join).length > 0) {
    metadata = db`jsonb_set(${metadata}, '{joinDetails}', COALESCE(metadata->'joinDetails', '{}'::jsonb) || ${db.json(join as never)})`;
  }
  if (coverPatch) metadata = db`${metadata} || ${db.json(coverPatch as never)}`;
  const body = richOf(input.bodyHtml);

  await db`
    UPDATE threads SET
      title = ${title ?? db`title`},
      body = ${body === undefined ? db`body` : body},
      metadata = ${metadata},
      updated_at = NOW()
    WHERE id = ${input.threadId} AND org_id = ${input.orgId}
  `;

  if (title && title !== series.title) {
    // Same shape as sessionTitle(): series name, then the week's own title
    // or "Session N".
    await db`
      UPDATE threads t SET
        title = LEFT(CONCAT_WS(' · ', ${title}::text,
                     COALESCE(n.title, 'Session ' || (t.metadata->'seriesSession'->>'number'))), 200),
        updated_at = NOW()
      FROM meeting_occurrence_notes n
      WHERE n.thread_id = ${input.threadId}
        AND n.topic_thread_id = t.id
        AND t.org_id = ${input.orgId}
        AND t.kind = ${SERIES_SESSION_KIND}
    `;
  }
}

export interface SaveSeriesSessionInput {
  orgId: string;
  threadId: string;
  occurrenceAt: string | Date;
  /** `undefined` leaves a field alone; `null` or '' clears it. */
  title?: string | null;
  subtitle?: string | null;
  /** Plain text. Left out while `bodyHtml` is given, it is derived from the rich write-up. */
  summary?: string | null;
  /** The write-up as rich text; sanitised here (migration 205). */
  bodyHtml?: string | null;
  plan?: string | null;
  coverImageUrl?: string | null;
  coverFrame?: CoverFrame | null;
  /** 'image' (default), 'video' or 'embed'; sent with `coverImageUrl`. */
  coverKind?: 'image' | 'video' | 'embed' | null;
  /** A video's still. */
  coverPosterUrl?: string | null;
  materials?: MeetingMaterial[] | null;
  actorUserId: string;
}

/**
 * Write a week's own fields. The caller authorises (organiser, or that
 * week's host). The week is materialised first (a write-up makes it a row,
 * design §3), and the fields are keyed by when it meets.
 *
 * A rich write-up (`bodyHtml`) also rewrites `summary` as its plain text,
 * so the letters and feeds that read `summary` stay in step with the page.
 */
export async function saveSeriesSession(input: SaveSeriesSessionInput): Promise<void> {
  const session = await ensureSeriesSession(input.orgId, input.threadId, input.occurrenceAt, input.actorUserId);
  const at = session.startsAt;
  const clean = (v: string | null | undefined, max: number) =>
    v === undefined ? undefined : (v ?? '').trim().slice(0, max) || null;
  const title = clean(input.title, 200);
  const subtitle = clean(input.subtitle, 300);
  const bodyHtml = richOf(input.bodyHtml);
  const summary =
    input.summary === undefined && bodyHtml !== undefined
      ? clean(bodyHtml === null ? null : emailHtmlToText(bodyHtml), 8000)
      : clean(input.summary, 8000);
  const plan = clean(input.plan, 2000);
  const cover = clean(input.coverImageUrl, 1000);
  // A new picture starts centred unless a frame comes with it.
  const frame = input.coverFrame !== undefined ? coverFrameOf(input.coverFrame) : cover !== undefined ? null : undefined;
  const materials = input.materials === undefined ? undefined : materialsOf(input.materials ?? []).slice(0, 40);
  const json = (v: unknown) => (v === null ? null : db.json(v as never));
  // What the cover is: null for a picture. Written whenever the cover is.
  const media =
    cover === undefined && input.coverKind === undefined
      ? undefined
      : cover && (input.coverKind === 'video' || input.coverKind === 'embed')
        ? { kind: input.coverKind, posterUrl: mediaUrlOf(input.coverPosterUrl) }
        : null;

  await db`
    INSERT INTO meeting_occurrence_notes (thread_id, occurrence_at, title, subtitle, summary, body_html, plan, planned_by, planned_at, cover_image_url, cover_frame, cover_media, materials)
    VALUES (
      ${input.threadId}, ${at}::timestamptz,
      ${title ?? null}, ${subtitle ?? null}, ${summary ?? null}, ${bodyHtml ?? null}, ${plan ?? null},
      ${plan !== undefined ? input.actorUserId : null}, ${plan !== undefined ? db`NOW()` : null},
      ${cover ?? null}, ${json(frame ?? null)}, ${json(media ?? null)}, ${db.json((materials ?? []) as never)}
    )
    ON CONFLICT (thread_id, occurrence_at) DO UPDATE SET
      title = ${title === undefined ? db`meeting_occurrence_notes.title` : title},
      subtitle = ${subtitle === undefined ? db`meeting_occurrence_notes.subtitle` : subtitle},
      summary = ${summary === undefined ? db`meeting_occurrence_notes.summary` : summary},
      body_html = ${bodyHtml === undefined ? db`meeting_occurrence_notes.body_html` : bodyHtml},
      plan = ${plan === undefined ? db`meeting_occurrence_notes.plan` : plan},
      planned_by = ${plan === undefined ? db`meeting_occurrence_notes.planned_by` : input.actorUserId},
      planned_at = ${plan === undefined ? db`meeting_occurrence_notes.planned_at` : db`NOW()`},
      cover_image_url = ${cover === undefined ? db`meeting_occurrence_notes.cover_image_url` : cover},
      cover_frame = ${frame === undefined ? db`meeting_occurrence_notes.cover_frame` : json(frame)},
      cover_media = ${media === undefined ? db`meeting_occurrence_notes.cover_media` : json(media)},
      materials = ${materials === undefined ? db`meeting_occurrence_notes.materials` : db.json(materials as never)},
      updated_at = NOW()
  `;
  // Keep the week's thread title in step so RSVP emails name the week.
  if (title !== undefined) {
    const [series] = await db<Array<{ title: string }>>`SELECT title FROM threads WHERE id = ${input.threadId} AND org_id = ${input.orgId}`;
    await db`
      UPDATE threads SET title = ${sessionTitle(series?.title ?? '', title, session.number)}, updated_at = NOW()
      WHERE id = ${session.id} AND org_id = ${input.orgId}
    `;
  }
}

function sessionTitle(seriesTitle: string, weekTitle: string | null, number: number | null): string {
  const n = number ? `Session ${number}` : null;
  return [seriesTitle, weekTitle ?? n].filter(Boolean).join(' · ').slice(0, 200);
}

/** A materialised week: its thread and its `series_sessions` row. */
export interface SeriesSessionRef {
  /** The week's `series_session` thread (RSVP, replies, attendance). */
  id: string;
  slug: string | null;
  number: number;
  /** When it meets (ISO); the key for notes and hosts. */
  startsAt: string;
  slotAt: string | null;
  status: 'scheduled' | 'cancelled';
}

async function sessionRef(orgId: string, sessionThreadId: string): Promise<SeriesSessionRef | null> {
  const [r] = await db<Array<{ id: string; slug: string | null; number: number; starts_at: Date; slot_at: Date | null; status: string }>>`
    SELECT t.id, t.slug, ss.number, ss.starts_at, ss.slot_at, ss.status
    FROM series_sessions ss JOIN threads t ON t.id = ss.session_thread_id AND t.org_id = ss.org_id
    WHERE ss.session_thread_id = ${sessionThreadId} AND ss.org_id = ${orgId}
  `;
  if (!r) return null;
  return {
    id: r.id,
    slug: r.slug,
    number: r.number,
    startsAt: isoOf(r.starts_at),
    slotAt: r.slot_at ? isoOf(r.slot_at) : null,
    status: r.status === 'cancelled' ? 'cancelled' : 'scheduled',
  };
}

/**
 * The week at `occurrenceAt`, materialised on first use (design §3): its
 * `series_session` thread (RSVP, replies, attendance; it carries the series'
 * RSVP settings so `checkRsvpEligibility` applies per week) and its
 * `series_sessions` row.
 *
 * `occurrenceAt` may be when the week meets or, for a moved week, its old
 * slot. A week thread made before migration 203 and linked from the notes is
 * adopted rather than duplicated.
 *
 * Duplicates: the thread is created first, then the row is inserted with
 * `ON CONFLICT DO NOTHING RETURNING`; a caller that loses the race archives
 * the thread it made and returns the winner's week.
 */
export async function ensureSeriesSession(
  orgId: string,
  threadId: string,
  occurrenceAt: string | Date,
  actorUserId: string
): Promise<SeriesSessionRef> {
  const series = await loadSeries(orgId, { threadId });
  if (!series) throw new SeriesError('Series not found', 404);
  const week = await resolveWeek(series, occurrenceAt);
  if (!week) throw new SeriesError('That date is not a session of this series.');
  if (week.row) {
    const ref = await sessionRef(orgId, week.row.session_thread_id);
    if (ref) return ref;
  }

  // Adopt a week thread made before migration 203 (linked from the notes, no row).
  const [legacy] = await db<Array<{ id: string; published_at: string | null }>>`
    SELECT t.id, t.metadata->'seriesSession'->>'publishedAt' AS published_at
    FROM meeting_occurrence_notes n
    JOIN threads t ON t.id = n.topic_thread_id
    WHERE n.thread_id = ${series.id}
      AND n.occurrence_at = ${week.startsAt}::timestamptz
      AND t.org_id = ${orgId}
      AND t.kind = ${SERIES_SESSION_KIND}
      AND t.status <> 'archived'
  `;
  let sessionThreadId: string;
  let created = false;
  if (legacy) {
    sessionThreadId = legacy.id;
  } else {
    // A row left by a removed (archived) week thread may hold this slot,
    // time or number; clear it.
    await db`
      DELETE FROM series_sessions ss USING threads t
      WHERE ss.series_id = ${series.id} AND ss.org_id = ${orgId}
        AND (ss.slot_at = ${week.slotAt}::timestamptz OR ss.starts_at = ${week.startsAt}::timestamptz OR ss.number = ${week.number})
        AND t.id = ss.session_thread_id AND t.status = 'archived'
    `;
    const [note] = await db<Array<{ title: string | null }>>`
      SELECT title FROM meeting_occurrence_notes WHERE thread_id = ${series.id} AND occurrence_at = ${week.startsAt}::timestamptz
    `;
    let topicId: string | null = null;
    for (let attempt = 0; topicId === null; attempt++) {
      try {
        const topic = await createThread({
          kind: SERIES_SESSION_KIND,
          orgId,
          authorId: actorUserId,
          title: sessionTitle(series.title, note?.title ?? null, week.number),
          slug: `${series.slug}-session-${week.number}`,
          status: 'published',
          visibility: 'PUBLIC',
          scheduledAt: week.startsAt,
          durationMinutes: series.duration_minutes,
          isRsvpEnabled: true,
          attendeeLimit: series.attendee_limit,
          metadata: { seriesSession: { seriesId: series.id, occurrenceAt: week.startsAt, number: week.number } },
        });
        topicId = topic.id;
      } catch (e) {
        // A parallel caller making the same week took the slug between
        // createThread's check and its insert (threads_org_id_slug_key).
        // Return its week if it is in place; otherwise try again, which
        // allocates the next free slug.
        if ((e as { code?: string }).code !== '23505' || attempt >= 2) throw e;
        const again = await resolveWeek(series, occurrenceAt);
        const ref = again?.row ? await sessionRef(orgId, again.row.session_thread_id) : null;
        if (ref) return ref;
      }
    }
    sessionThreadId = topicId;
    created = true;
  }

  const legacyPublished = legacy?.published_at && !Number.isNaN(Date.parse(legacy.published_at)) ? legacy.published_at : null;
  const inserted = await db<Array<{ session_thread_id: string }>>`
    INSERT INTO series_sessions (session_thread_id, series_id, org_id, number, slot_at, starts_at, status, published_at)
    VALUES (
      ${sessionThreadId}, ${series.id}, ${orgId}, ${week.number},
      ${week.slotAt}::timestamptz, ${week.startsAt}::timestamptz, 'scheduled', ${legacyPublished}::timestamptz
    )
    ON CONFLICT DO NOTHING
    RETURNING session_thread_id
  `;
  if (inserted.length === 0) {
    // Lost the race (or the slot, time or number is taken): drop our thread
    // and return whatever now holds this week.
    if (created) {
      await db`UPDATE threads SET status = 'archived', updated_at = NOW() WHERE id = ${sessionThreadId} AND org_id = ${orgId}`;
    }
    const again = await resolveWeek(series, occurrenceAt);
    const ref = again?.row ? await sessionRef(orgId, again.row.session_thread_id) : null;
    if (!ref) throw new SeriesError('This week could not be set up. Try again.');
    return ref;
  }
  await db`
    INSERT INTO meeting_occurrence_notes (thread_id, occurrence_at, topic_thread_id)
    VALUES (${series.id}, ${week.startsAt}::timestamptz, ${sessionThreadId})
    ON CONFLICT (thread_id, occurrence_at) DO UPDATE SET topic_thread_id = EXCLUDED.topic_thread_id, updated_at = NOW()
  `;
  const ref = await sessionRef(orgId, sessionThreadId);
  if (!ref) throw new SeriesError('This week could not be set up. Try again.');
  return ref;
}

/**
 * The week's thread, made on first use. Kept for callers written before
 * migration 203; new code calls `ensureSeriesSession`.
 */
export async function ensureSeriesSessionTopic(
  orgId: string,
  threadId: string,
  occurrenceAt: string | Date,
  actorUserId: string
): Promise<{ id: string; slug: string | null }> {
  const s = await ensureSeriesSession(orgId, threadId, occurrenceAt, actorUserId);
  return { id: s.id, slug: s.slug };
}

export interface SeriesRsvpResult {
  ok: boolean;
  error?: string;
  topicThreadId: string;
  status: 'yes' | 'no';
  rsvpCount: number;
}

/** A member's RSVP for one week. A cancelled week takes no new yes. */
export async function rsvpSeriesSession(input: {
  orgId: string;
  threadId: string;
  occurrenceAt: string | Date;
  userId: string;
  going: boolean;
}): Promise<SeriesRsvpResult> {
  const topic = await ensureSeriesSession(input.orgId, input.threadId, input.occurrenceAt, input.userId);
  if (input.going) {
    if (topic.status === 'cancelled') {
      return { ok: false, error: 'This session is cancelled.', topicThreadId: topic.id, status: 'no', rsvpCount: await countConfirmedRsvps(topic.id) };
    }
    const eligible = await checkRsvpEligibility(topic.id);
    if (!eligible.ok) {
      return { ok: false, error: eligible.error, topicThreadId: topic.id, status: 'no', rsvpCount: await countConfirmedRsvps(topic.id) };
    }
    await setRsvpStatus(topic.id, input.userId, 'yes');
  } else {
    await deleteRsvp(topic.id, input.userId);
  }
  return { ok: true, topicThreadId: topic.id, status: input.going ? 'yes' : 'no', rsvpCount: await countConfirmedRsvps(topic.id) };
}

/** The viewer's answers across the loaded weeks: occurrence ISO → 'yes'. */
export async function getSeriesRsvps(series: MeetingSeries, userId: string): Promise<Record<string, 'yes' | 'maybe' | 'no'>> {
  const ids = series.sessions.map((s) => s.topicThreadId).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return {};
  const rows = await db<Array<{ thread_id: string; status: string }>>`
    SELECT thread_id, status FROM thread_rsvps WHERE user_id = ${userId} AND thread_id = ANY(${ids})
  `;
  const byTopic = new Map(rows.map((r) => [r.thread_id, r.status]));
  const out: Record<string, 'yes' | 'maybe' | 'no'> = {};
  for (const s of series.sessions) {
    const st = s.topicThreadId ? byTopic.get(s.topicThreadId) : undefined;
    if (st === 'yes' || st === 'maybe' || st === 'no') out[s.at] = st;
  }
  return out;
}

export interface SeriesAttendee {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/** Who said yes to a week (for the "12 going" row). */
export async function listSeriesSessionAttendees(topicThreadId: string, limit = 12): Promise<SeriesAttendee[]> {
  const rows = await db<Array<{ user_id: string; display_name: string | null; avatar_url: string | null }>>`
    SELECT r.user_id, u.display_name, u.avatar_url
    FROM thread_rsvps r JOIN users u ON u.id = r.user_id
    WHERE r.thread_id = ${topicThreadId} AND r.status = 'yes'
    ORDER BY r.created_at ASC LIMIT ${limit}
  `;
  return rows.map((r) => ({ userId: r.user_id, displayName: r.display_name, avatarUrl: r.avatar_url }));
}

// ─── Hosts ───────────────────────────────────────────────────────────────────

const MEMBER_ROLES = ['owner', 'guide', 'member'];

export class SeriesError extends Error {
  constructor(message: string, readonly status: 400 | 403 | 404 | 503 = 400) {
    super(message);
    this.name = 'SeriesError';
  }
}

/**
 * Put somebody down to host (or co-host) one week. The series must belong to
 * `orgId`, `occurrenceAt` must be one of its weeks (when it meets, or a moved
 * week's old slot), and the person must hold member, guide or owner in that
 * org (a `viewer` follower cannot host). The week is materialised (design
 * §3) and the role is keyed by when it meets. The caller decides who may
 * assign (organisers only on IFAC). `changed` is false when the same person
 * already held the role, so the caller can skip mail.
 */
export async function assignSeriesRole(input: {
  orgId: string;
  threadId: string;
  occurrenceAt: string | Date;
  role: 'host' | 'co-host';
  userId: string;
  actorUserId: string;
}): Promise<{ changed: boolean; number: number }> {
  const series = await loadSeries(input.orgId, { threadId: input.threadId });
  if (!series) throw new SeriesError('Series not found', 404);
  const week = await resolveWeek(series, input.occurrenceAt);
  if (!week) throw new SeriesError('That date is not a session of this series.');
  const role = await getOrgRole(input.userId, input.orgId);
  if (!role || !MEMBER_ROLES.includes(role)) {
    throw new SeriesError('Only members of this organisation can host a session.');
  }
  const session = await ensureSeriesSession(input.orgId, series.id, week.startsAt, input.actorUserId);
  const at = session.startsAt;
  const previous = await getRoleHolder(series.id, at, input.role);
  await assignMeetingRole({
    threadId: series.id,
    occurrenceAt: at,
    role: input.role,
    userId: input.userId,
    actorUserId: input.actorUserId,
  });
  return { changed: previous !== input.userId, number: session.number };
}

/** Clear a host or co-host slot on one week of a series in `orgId`. */
export async function clearSeriesRole(input: {
  orgId: string;
  threadId: string;
  occurrenceAt: string | Date;
  role: 'host' | 'co-host';
}): Promise<void> {
  const series = await loadSeries(input.orgId, { threadId: input.threadId });
  if (!series) throw new SeriesError('Series not found', 404);
  const week = await resolveWeek(series, input.occurrenceAt);
  await clearMeetingRole(series.id, week?.startsAt ?? new Date(input.occurrenceAt).toISOString(), input.role);
}

// ─── Publishing a week ───────────────────────────────────────────────────────

/**
 * Publish or unpublish one week. Publishing needs a title (the week must be
 * filled out) and materialises the week if it has no row; the flag is
 * `series_sessions.published_at`. `metadata.seriesSession.publishedAt` on
 * the week's thread is written too, for one release (readers built before
 * migration 203). A cancelled week cannot be published. The caller
 * authorises.
 */
export async function publishSeriesSession(input: {
  orgId: string;
  threadId: string;
  occurrenceAt: string | Date;
  published: boolean;
  actorUserId: string;
}): Promise<{ publishedAt: string | null }> {
  const series = await loadSeries(input.orgId, { threadId: input.threadId });
  if (!series) throw new SeriesError('Series not found', 404);
  const week = await resolveWeek(series, input.occurrenceAt);
  if (!week) throw new SeriesError('That date is not a session of this series.');

  const [note] = await db<Array<{ title: string | null }>>`
    SELECT title FROM meeting_occurrence_notes
    WHERE thread_id = ${series.id} AND occurrence_at = ${week.startsAt}::timestamptz
  `;
  if (input.published && !note?.title) throw new SeriesError('Give the week a title before publishing it.');
  if (input.published && week.row?.status === 'cancelled') throw new SeriesError('Restore the week before publishing it.');
  if (!input.published && !week.row) {
    // Nothing to unpublish unless a thread made before migration 203 carries the flag.
    const [legacy] = await db<Array<{ id: string }>>`
      SELECT t.id FROM meeting_occurrence_notes n JOIN threads t ON t.id = n.topic_thread_id
      WHERE n.thread_id = ${series.id} AND n.occurrence_at = ${week.startsAt}::timestamptz
        AND t.org_id = ${input.orgId} AND t.status <> 'archived'
    `;
    if (!legacy) return { publishedAt: null };
  }

  const session = await ensureSeriesSession(input.orgId, series.id, week.startsAt, input.actorUserId);
  const publishedAt = input.published ? new Date().toISOString() : null;
  await db.begin(async (tx) => {
    await tx`
      UPDATE series_sessions SET published_at = ${publishedAt}::timestamptz, updated_at = NOW()
      WHERE session_thread_id = ${session.id} AND org_id = ${input.orgId}
    `;
    await tx`
      UPDATE threads SET
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb), '{seriesSession}',
          COALESCE(metadata->'seriesSession', '{}'::jsonb) || ${db.json({ publishedAt } as never)}
        ),
        updated_at = NOW()
      WHERE id = ${session.id} AND org_id = ${input.orgId}
    `;
  });
  return { publishedAt };
}

// ─── Cancelling and moving a week ────────────────────────────────────────────

/**
 * Cancel one week: `series_sessions.status = 'cancelled'` and the week
 * thread's `is_rsvp_enabled = false`, in one transaction. The week is
 * materialised first if it has no row. A cancelled week stays in
 * `getMeetingSeries` (flagged) for organisers and leaves the public lists
 * and reminders. Its notes, hosts and RSVPs are kept. Nobody is emailed. The
 * caller authorises (organisers only).
 */
export async function cancelSeriesSession(input: {
  orgId: string;
  threadId: string;
  occurrenceAt: string | Date;
  actorUserId: string;
}): Promise<SeriesSessionRef> {
  const session = await ensureSeriesSession(input.orgId, input.threadId, input.occurrenceAt, input.actorUserId);
  await db.begin(async (tx) => {
    await tx`
      UPDATE series_sessions SET status = 'cancelled', updated_at = NOW()
      WHERE session_thread_id = ${session.id} AND org_id = ${input.orgId}
    `;
    await tx`
      UPDATE threads SET is_rsvp_enabled = false, updated_at = NOW()
      WHERE id = ${session.id} AND org_id = ${input.orgId}
    `;
  });
  return { ...session, status: 'cancelled' };
}

/**
 * Undo `cancelSeriesSession`: status back to `scheduled` and RSVPs on
 * again. Refused when another week now meets at the same time.
 */
export async function restoreSeriesSession(input: {
  orgId: string;
  threadId: string;
  occurrenceAt: string | Date;
}): Promise<SeriesSessionRef> {
  const series = await loadSeries(input.orgId, { threadId: input.threadId });
  if (!series) throw new SeriesError('Series not found', 404);
  const week = await resolveWeek(series, input.occurrenceAt);
  if (!week?.row) throw new SeriesError('That week is not cancelled.');
  const id = week.row.session_thread_id;
  if (week.row.status !== 'cancelled') {
    const ref = await sessionRef(input.orgId, id);
    if (!ref) throw new SeriesError('That week is not cancelled.');
    return ref;
  }
  try {
    await db.begin(async (tx) => {
      await tx`
        UPDATE series_sessions SET status = 'scheduled', updated_at = NOW()
        WHERE session_thread_id = ${id} AND org_id = ${input.orgId}
      `;
      await tx`
        UPDATE threads SET is_rsvp_enabled = true, updated_at = NOW()
        WHERE id = ${id} AND org_id = ${input.orgId}
      `;
    });
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      throw new SeriesError('Another week of the series meets at that time. Move one of them first.');
    }
    throw e;
  }
  const ref = await sessionRef(input.orgId, id);
  if (!ref) throw new SeriesError('Series not found', 404);
  return ref;
}

/**
 * Move one week to another time, keeping its slot and number ("moved" =
 * `starts_at <> slot_at`; moving back to the slot undoes it). `to` is an ISO
 * instant, or a local "YYYY-MM-DDTHH:MM" read in the series' own zone.
 *
 * One transaction rewrites the week's `series_sessions.starts_at`, its
 * `meeting_occurrence_notes` and `meeting_hosts` keys, and its thread's
 * `scheduled_at` (and `metadata.seriesSession.occurrenceAt`). RSVPs and
 * replies are on the week thread and follow it. Refused when the new time is
 * another slot of the series, another week's time, or already has notes or
 * hosts. Nobody is emailed. The caller authorises (organisers only).
 */
export async function moveSeriesSession(input: {
  orgId: string;
  threadId: string;
  occurrenceAt: string | Date;
  to: string | Date;
  actorUserId: string;
}): Promise<SeriesSessionRef> {
  const series = await loadSeries(input.orgId, { threadId: input.threadId });
  if (!series) throw new SeriesError('Series not found', 404);
  const zone = validTimeZone(clockOf(series).timeZone);
  const target =
    typeof input.to === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.to.trim())
      ? seriesLocalToInstant(input.to, zone)
      : new Date(input.to);
  if (!target || Number.isNaN(target.getTime())) throw new SeriesError('Pick the new date and time.');
  const to = target.toISOString();

  const rows = await loadSessionRows(input.orgId, series.id);
  const week = await resolveWeek(series, input.occurrenceAt, rows);
  if (!week) throw new SeriesError('That date is not a session of this series.');
  if (to === week.startsAt) {
    return (week.row && (await sessionRef(input.orgId, week.row.session_thread_id))) ||
      ensureSeriesSession(input.orgId, series.id, week.startsAt, input.actorUserId);
  }
  const t = target.getTime();
  const self = week.row?.session_thread_id ?? null;
  if (to !== week.slotAt && isSeriesOccurrence(clockOf(series), target)) {
    throw new SeriesError('Another session of the series is at that time.');
  }
  if (rows.some((r) => r.session_thread_id !== self && (msOf(r.starts_at) === t || msOf(r.slot_at) === t))) {
    throw new SeriesError('Another session of the series is at that time.');
  }
  const [busy] = await db<Array<{ n: number }>>`
    SELECT 1 AS n FROM meeting_occurrence_notes WHERE thread_id = ${series.id} AND occurrence_at = ${to}::timestamptz
    UNION ALL
    SELECT 1 FROM meeting_hosts WHERE thread_id = ${series.id} AND occurrence_at = ${to}::timestamptz
    LIMIT 1
  `;
  if (busy) throw new SeriesError('Something is already planned at that time.');

  const session = await ensureSeriesSession(input.orgId, series.id, week.startsAt, input.actorUserId);
  await db.begin(async (tx) => {
    await rekeyWeeks(tx as unknown as typeof db, input.orgId, series.id, [
      { from: session.startsAt, to, sessionThreadId: session.id },
    ]);
  });
  const ref = await sessionRef(input.orgId, session.id);
  if (!ref) throw new SeriesError('Series not found', 404);
  return ref;
}

/** One week changing its key: from one instant to another. */
interface WeekRekey {
  /** When it meets now (the notes / hosts key). */
  from: string;
  to: string;
  /** Its `series_sessions` row, if materialised. */
  sessionThreadId: string | null;
  /** New `slot_at` (a schedule change); undefined keeps it. */
  slotTo?: string | null;
}

/**
 * Re-key weeks inside the caller's transaction: `meeting_occurrence_notes`
 * and `meeting_hosts` (`occurrence_at`), the `series_sessions` row
 * (`starts_at`, and `slot_at` when given), and the week thread
 * (`scheduled_at`, `metadata.seriesSession.occurrenceAt`). Keys are parked a
 * year ahead first, so weeks can swap places without tripping a unique key
 * mid-way (lifted from `saveSeriesSchedule`, 2026-10-10).
 */
async function rekeyWeeks(tx: typeof db, orgId: string, seriesId: string, moves: WeekRekey[]): Promise<void> {
  // Far enough ahead that no real week sits there.
  const parked = (iso: string) => new Date(Date.parse(iso) + 1000 * 365 * DAY_MS).toISOString();
  for (const m of moves) {
    const p = parked(m.from);
    await tx`UPDATE meeting_occurrence_notes SET occurrence_at = ${p}::timestamptz WHERE thread_id = ${seriesId} AND occurrence_at = ${m.from}::timestamptz`;
    await tx`UPDATE meeting_hosts SET occurrence_at = ${p}::timestamptz WHERE thread_id = ${seriesId} AND occurrence_at = ${m.from}::timestamptz`;
    if (m.sessionThreadId) {
      await tx`
        UPDATE series_sessions SET
          starts_at = ${p}::timestamptz,
          slot_at = ${m.slotTo === undefined ? tx`slot_at` : tx`${p}::timestamptz`}
        WHERE session_thread_id = ${m.sessionThreadId} AND org_id = ${orgId}
      `;
    }
  }
  for (const m of moves) {
    const p = parked(m.from);
    const topics = await tx<Array<{ topic_thread_id: string | null }>>`
      UPDATE meeting_occurrence_notes SET occurrence_at = ${m.to}::timestamptz, updated_at = NOW()
      WHERE thread_id = ${seriesId} AND occurrence_at = ${p}::timestamptz
      RETURNING topic_thread_id
    `;
    await tx`
      UPDATE meeting_hosts SET occurrence_at = ${m.to}::timestamptz, updated_at = NOW()
      WHERE thread_id = ${seriesId} AND occurrence_at = ${p}::timestamptz
    `;
    if (m.sessionThreadId) {
      await tx`
        UPDATE series_sessions SET
          starts_at = ${m.to}::timestamptz,
          slot_at = ${m.slotTo === undefined ? tx`slot_at` : tx`${m.slotTo}::timestamptz`},
          updated_at = NOW()
        WHERE session_thread_id = ${m.sessionThreadId} AND org_id = ${orgId}
      `;
    }
    const ids = new Set(topics.map((t) => t.topic_thread_id).filter((id): id is string => Boolean(id)));
    if (m.sessionThreadId) ids.add(m.sessionThreadId);
    for (const id of ids) {
      await tx`
        UPDATE threads SET
          scheduled_at = ${m.to}::timestamptz,
          metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb), '{seriesSession}',
            COALESCE(metadata->'seriesSession', '{}'::jsonb) || ${db.json({ occurrenceAt: m.to } as never)}
          ),
          updated_at = NOW()
        WHERE id = ${id} AND org_id = ${orgId}
      `;
    }
  }
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

/** The `thread_rsvps.status` of a series subscription (migration 202). */
export const SUBSCRIBED_STATUS = 'subscribed';

/**
 * Subscribe to (or leave) a series: a `subscribed` row in `thread_rsvps` on
 * the series' own thread. Not capacity-checked: the attendee limit applies to
 * each week's topic, not to following the series. Leaving deletes only a
 * `subscribed` row.
 */
export async function setSeriesSubscription(input: {
  orgId: string;
  threadId: string;
  userId: string;
  subscribed: boolean;
}): Promise<boolean> {
  const series = await loadSeries(input.orgId, { threadId: input.threadId });
  if (!series) throw new SeriesError('Series not found', 404);
  if (!input.subscribed) {
    await db`
      DELETE FROM thread_rsvps
      WHERE thread_id = ${series.id} AND user_id = ${input.userId} AND status = ${SUBSCRIBED_STATUS}
    `;
    return false;
  }
  await db`
    INSERT INTO thread_rsvps (thread_id, user_id, status)
    VALUES (${series.id}, ${input.userId}, ${SUBSCRIBED_STATUS})
    ON CONFLICT (thread_id, user_id)
    DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
  `;
  return true;
}

export async function isSubscribedToSeries(threadId: string, userId: string): Promise<boolean> {
  const [row] = await db<Array<{ status: string }>>`
    SELECT status FROM thread_rsvps WHERE thread_id = ${threadId} AND user_id = ${userId}
  `;
  return row?.status === SUBSCRIBED_STATUS;
}

export interface SeriesSubscriber {
  userId: string;
  email: string;
  displayName: string;
}

export async function listSeriesSubscribers(orgId: string, threadId: string): Promise<SeriesSubscriber[]> {
  const rows = await db<Array<{ user_id: string; email: string; display_name: string | null }>>`
    SELECT r.user_id, u.email, u.display_name
    FROM thread_rsvps r
    JOIN threads t ON t.id = r.thread_id
    JOIN users u ON u.id = r.user_id
    WHERE r.thread_id = ${threadId} AND t.org_id = ${orgId}
      AND r.status = ${SUBSCRIBED_STATUS} AND u.email IS NOT NULL AND u.email <> ''
    ORDER BY r.created_at
  `;
  return rows.map((r) => ({ userId: r.user_id, email: r.email, displayName: r.display_name?.trim() || r.email.split('@')[0] }));
}

/** Remove a subscription by address (the unsubscribe link carries an email, not a user id). */
export async function unsubscribeSeriesByEmail(orgId: string, threadId: string, email: string): Promise<void> {
  await db`
    DELETE FROM thread_rsvps r
    USING threads t, users u
    WHERE r.thread_id = ${threadId} AND t.id = r.thread_id AND t.org_id = ${orgId}
      AND r.status = ${SUBSCRIBED_STATUS}
      AND u.id = r.user_id AND lower(u.email) = ${email.trim().toLowerCase()}
  `;
}

// ─── Joining by Talk ─────────────────────────────────────────────────────────

/**
 * The series' Talk room, made on first use (public, type 3, so guests can
 * join from the link; the actor becomes its moderator when they have a
 * Nextcloud account). Stored in `threads.nextcloud_talk_token`, which
 * `seriesJoinUrl` falls back to when no join link is pasted.
 */
export async function ensureSeriesTalkRoom(input: {
  orgId: string;
  threadId: string;
  actorUserId: string;
}): Promise<{ token: string; created: boolean }> {
  const series = await loadSeries(input.orgId, { threadId: input.threadId });
  if (!series) throw new SeriesError('Series not found', 404);
  if (series.nextcloud_talk_token) return { token: series.nextcloud_talk_token, created: false };
  const [actor] = await db<Array<{ nextcloud_user_id: string | null }>>`
    SELECT nextcloud_user_id FROM users WHERE id = ${input.actorUserId}
  `;
  const token = await createTalkRoom(series.title, 'public', { moderator: actor?.nextcloud_user_id ?? null, listable: 1 });
  if (!token) throw new SeriesError('The Talk room could not be created.');
  const [stored] = await db<Array<{ nextcloud_talk_token: string }>>`
    UPDATE threads SET nextcloud_talk_token = COALESCE(nextcloud_talk_token, ${token}), updated_at = NOW()
    WHERE id = ${series.id} AND org_id = ${input.orgId}
    RETURNING nextcloud_talk_token
  `;
  return { token: stored?.nextcloud_talk_token ?? token, created: true };
}

// ─── Schedule ────────────────────────────────────────────────────────────────

export interface SeriesScheduleInput {
  /** 0 = Sunday … 6 = Saturday, in `timeZone`. */
  weekday: number;
  /** "HH:MM", 24-hour, in `timeZone`. */
  time: string;
  timeZone: string;
  /** "YYYY-MM-DD": the first session is the first `weekday` on or after it. */
  firstDate: string;
  /** "YYYY-MM-DD" or null: no session after this local date. */
  lastDate?: string | null;
  durationMinutes?: number | null;
  /** Zones printed beside the series' own; null leaves `metadata.series.alsoZones` alone. */
  alsoZones?: string[] | null;
  /** Every n weeks (1–4); absent leaves it as it is. */
  intervalWeeks?: number | null;
}

export interface SeriesWeekMove {
  /** The week's current instant. */
  from: string;
  /** Where it lands, or null when it has nowhere to go (past the last date, or the slot is taken). */
  to: string | null;
  number: number;
  newNumber: number | null;
}

export interface SeriesScheduleResult {
  scheduledAt: string;
  recurrenceUntil: string | null;
  /** Coming weeks that carry a host, write-up or topic and whose date changes. */
  moves: SeriesWeekMove[];
  /** How many of `moves` stay behind (their notes keep the old date and stop showing). */
  detached: number;
  dryRun: boolean;
}

function parseLocalDate(value: string | null | undefined): { y: number; mo: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return { y, mo, d };
}

/**
 * Change when a series meets: weekday, time, zone, first and last date,
 * duration, and the zones its times are printed in.
 *
 * Weeks are keyed by their instant (`meeting_occurrence_notes`,
 * `meeting_hosts`, the topic's `scheduled_at`), so a new day or time would
 * leave every planned week behind. This moves the coming weeks that carry
 * anything (a host, a write-up, a topic with its RSVPs and replies) onto the
 * new dates in order: the first coming week to the first new date, and so
 * on. Past weeks keep their dates. A week whose new slot is already taken, or
 * that falls after the new last date, stays behind and is reported. Nobody is
 * emailed about a moved week.
 *
 * Since migration 203 a materialised week takes its new slot as `slot_at`
 * and `starts_at` (a one-off move is reset by a schedule change) and keeps
 * its `number`; `metadata.series.numberOffset` is set so that weeks without
 * a row keep theirs too. A week left behind keeps its row and shows to
 * organisers as off the schedule (`isOffSchedule`).
 *
 * `dryRun` returns the same report without writing.
 */
export async function saveSeriesSchedule(input: {
  orgId: string;
  threadId: string;
  schedule: SeriesScheduleInput;
  dryRun?: boolean;
}): Promise<SeriesScheduleResult> {
  const row = await loadSeries(input.orgId, { threadId: input.threadId });
  if (!row) throw new SeriesError('Series not found', 404);
  const s = input.schedule;

  const zone = validTimeZone(s.timeZone);
  if (!zone) throw new SeriesError('Pick a time zone from the list.');
  const weekday = Number(s.weekday);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new SeriesError('Pick a day of the week.');
  const tm = /^(\d{1,2}):(\d{2})$/.exec(String(s.time ?? '').trim());
  if (!tm || Number(tm[1]) > 23 || Number(tm[2]) > 59) throw new SeriesError('Write the time as HH:MM.');
  const first = parseLocalDate(s.firstDate);
  if (!first) throw new SeriesError('Pick the date of the first session.');
  const last = s.lastDate ? parseLocalDate(s.lastDate) : null;
  if (s.lastDate && !last) throw new SeriesError('The last date is not a date.');
  const duration =
    s.durationMinutes === undefined || s.durationMinutes === null ? null : Math.round(Number(s.durationMinutes));
  if (duration !== null && (!Number.isFinite(duration) || duration < 15 || duration > 600)) {
    throw new SeriesError('A session lasts between 15 minutes and 10 hours.');
  }
  const alsoZones =
    s.alsoZones === undefined || s.alsoZones === null
      ? null
      : Array.from(new Set(s.alsoZones.map((z) => validTimeZone(z)).filter((z): z is string => Boolean(z)))).slice(0, 6);

  // The first `weekday` on or after the first date, at the time, in the zone.
  const firstWeekday = new Date(Date.UTC(first.y, first.mo - 1, first.d)).getUTCDay();
  const shift = (weekday - firstWeekday + 7) % 7;
  const anchorMs = zonedInstant(first.y, first.mo, first.d + shift, Number(tm[1]), Number(tm[2]), 0, 0, zone);
  // `recurrence_until` is exclusive: the start of the day after the last date.
  const untilMs = last ? zonedInstant(last.y, last.mo, last.d + 1, 0, 0, 0, 0, zone) : null;
  if (untilMs !== null && untilMs <= anchorMs) throw new SeriesError('The last date is before the first session.');

  const pattern = row.recurrence_pattern ?? 'WEEKLY';
  const oldClock = clockOf(row);
  const newClock: SeriesClock = {
    scheduledAt: new Date(anchorMs),
    recurrencePattern: pattern,
    recurrenceUntil: untilMs !== null ? new Date(untilMs) : null,
    timeZone: zone,
    intervalWeeks: s.intervalWeeks === undefined || s.intervalWeeks === null ? oldClock.intervalWeeks : intervalWeeksOf(s.intervalWeeks),
  };

  // Coming weeks, same cut-off as getMeetingSeries: a week is current until it ends.
  const from = new Date(Date.now() - (row.duration_minutes ?? 60) * 60_000);
  const oldDates = seriesOccurrencesFrom(oldClock, from, 104);
  const newDates = seriesOccurrencesFrom(newClock, from, 104);
  const oldOffset = numberOffsetOf(row);
  const rows = await loadSessionRows(input.orgId, row.id);

  // Numbers stay (design §3): the new offset makes the i-th coming slot of
  // the new rule derive the number the i-th coming slot of the old rule had,
  // which is also the number a materialised week moved there keeps.
  const lastNumber = Math.max(
    0,
    ...rows.map((r) => r.number),
    ...seriesOccurrencesBefore(oldClock, from, 1).map((d) => derivedNumber(oldClock, oldOffset, d))
  );
  const firstComingNumber = oldDates.length > 0 ? derivedNumber(oldClock, oldOffset, oldDates[0]) : lastNumber + 1;
  const numberOffset = newDates.length > 0 ? firstComingNumber - seriesOccurrenceNumber(newClock, newDates[0]) : oldOffset;

  const keyed = await db<Array<{ occurrence_at: Date }>>`
    SELECT occurrence_at FROM meeting_occurrence_notes WHERE thread_id = ${row.id}
    UNION
    SELECT occurrence_at FROM meeting_hosts WHERE thread_id = ${row.id}
  `;
  const keyedAt = new Set(keyed.map((k) => msOf(k.occurrence_at)));
  const rowStarts = new Set(rows.map((r) => msOf(r.starts_at)));
  // Every instant something holds: notes, hosts, and rows (cancelled ones too).
  const occupied = new Set([...keyedAt, ...rowStarts]);
  const rowBySlot = new Map(rows.filter((r) => r.slot_at).map((r) => [msOf(r.slot_at), r]));

  // The i-th coming week of the old rule goes to the i-th date of the new
  // one: a materialised week (moved or not; a move is reset to the new slot),
  // or an empty slot that has notes or hosts. Weeks whose slot does not
  // change, past weeks and weeks already off the schedule stay as they are.
  type Move = SeriesWeekMove & { blocked: boolean; sessionThreadId: string | null };
  const moves: Move[] = [];
  oldDates.forEach((d, i) => {
    const ms = d.getTime();
    const r = rowBySlot.get(ms) ?? null;
    if (!r && !(keyedAt.has(ms) && !rowStarts.has(ms))) return;
    const to = newDates[i] ?? null;
    if (to && to.getTime() === ms) return;
    const number = r ? r.number : derivedNumber(oldClock, oldOffset, d);
    moves.push({
      from: r ? isoOf(r.starts_at) : d.toISOString(),
      to: to ? to.toISOString() : null,
      number,
      newNumber: to ? number : null,
      blocked: !to,
      sessionThreadId: r?.session_thread_id ?? null,
    });
  });
  // A target already holding a week that is not itself moving (by time or by
  // slot) blocks the move; a blocked week keeps its place, which can block
  // another. Settle that first.
  for (let changed = true; changed; ) {
    changed = false;
    const live = moves.filter((m) => !m.blocked);
    const leaving = new Set(live.map((m) => Date.parse(m.from)));
    const leavingRows = new Set(live.map((m) => m.sessionThreadId).filter(Boolean));
    for (const m of moves) {
      if (m.blocked || !m.to) continue;
      const t = Date.parse(m.to);
      const slotHolder = rowBySlot.get(t)?.session_thread_id ?? null;
      const slotTaken = Boolean(slotHolder) && slotHolder !== m.sessionThreadId && !leavingRows.has(slotHolder);
      if ((occupied.has(t) && !leaving.has(t)) || slotTaken) {
        m.blocked = true;
        changed = true;
      }
    }
  }
  const report = (dryRun: boolean): SeriesScheduleResult => ({
    scheduledAt: new Date(anchorMs).toISOString(),
    recurrenceUntil: untilMs !== null ? new Date(untilMs).toISOString() : null,
    moves: moves.map((m) => ({ from: m.from, to: m.blocked ? null : m.to, number: m.number, newNumber: m.blocked ? null : m.newNumber })),
    detached: moves.filter((m) => m.blocked).length,
    dryRun,
  });
  if (input.dryRun) return report(true);

  const moving = moves.filter((m) => !m.blocked && m.to);
  const seriesPatch: Record<string, unknown> = { numberOffset, interval: intervalWeeksOf(newClock.intervalWeeks) };
  if (alsoZones !== null) seriesPatch.alsoZones = alsoZones;

  await db.begin(async (tx) => {
    await tx`
      UPDATE threads SET
        scheduled_at = ${new Date(anchorMs).toISOString()}::timestamptz,
        recurrence_until = ${untilMs !== null ? new Date(untilMs).toISOString() : null}::timestamptz,
        recurrence_pattern = ${pattern},
        duration_minutes = COALESCE(${duration}::int, duration_minutes),
        metadata = jsonb_set(
          jsonb_set(COALESCE(metadata, '{}'::jsonb), '{timeZone}', to_jsonb(${zone}::text)),
          '{series}', COALESCE(metadata->'series', '{}'::jsonb) || ${db.json(seriesPatch as never)}
        ),
        updated_at = NOW()
      WHERE id = ${row.id} AND org_id = ${input.orgId}
    `;
    await rekeyWeeks(
      tx as unknown as typeof db,
      input.orgId,
      row.id,
      moving.map((m) => ({
        from: m.from,
        to: m.to!,
        sessionThreadId: m.sessionThreadId,
        slotTo: m.sessionThreadId ? m.to! : undefined,
      }))
    );
  });
  return report(false);
}

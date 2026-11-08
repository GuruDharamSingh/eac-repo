// ============================================================================
// @elkdonis/studio/forms: pure readers over a kind's answers (soft tissue).
//
// Shared by the rules (rules/*.ts), the kinds' More-row summaries and the
// When/Where sections, so a rule and the line that describes the same value
// can never read it two ways. No React, no data access: everything here runs
// in node for rules/check.ts.
//
// The answers are cms-ui content-fields' (scheduled_at as a wall clock in
// `time_zone`, meeting_url, is_rsvp_enabled, …) plus the forms' few design
// keys: where_mode, start_time (forms/adapters/gathering.ts) and the flat
// dotted `forms.*` keys (forms.repeat_count, forms.repeat_as_series,
// forms.loaded_start). Time zone maths is cms-ui's (zoned-time.ts) and the
// occurrence maths is utils' (recurrence.ts), the same two the server uses.
// ============================================================================

import { knownTimeZone, wallClockToInstant } from '@elkdonis/cms-ui/compose';
import { expandOccurrences } from '@elkdonis/utils';
import type { Answers, FormContext } from '../contract';

// ── plain values ─────────────────────────────────────────────────────────────

export function text(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

export function trimmed(v: unknown): string {
  return text(v).trim();
}

/** A number the person typed, or null for empty / unreadable. */
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function list(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '') : [];
}

/** http(s) only, as meeting-content.ts httpUrl() requires. Empty is not a URL. */
export function isHttpUrl(v: unknown): boolean {
  const s = trimmed(v);
  if (!s) return false;
  try {
    return ['http:', 'https:'].includes(new URL(s).protocol);
  } catch {
    return false;
  }
}

/** Plain text of a stored HTML body: for word counts and "from the opening" lines. */
export function plainText(html: unknown): string {
  return text(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|li|h\d|blockquote)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function clip(s: string, max = 60): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
}

// ── the gathering's clock ────────────────────────────────────────────────────

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const TIME_RE = /T(\d{2}):(\d{2})/;
const HHMM_RE = /^(\d{2}):(\d{2})$/;

/** "2026-11-19" from scheduled_at (date-only or wall clock), or "". */
export function datePart(v: unknown): string {
  const m = DATE_RE.exec(text(v));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

/** "18:30" from a wall clock, or "". */
export function timeOf(v: unknown): string {
  const m = TIME_RE.exec(text(v));
  return m ? `${m[1]}:${m[2]}` : '';
}

/** The start time shown in When: scheduled_at's own time, else a preset's start_time (the adapter joins them). */
export function startTime(a: Answers): string {
  const t = timeOf(a.scheduled_at);
  if (t) return t;
  const s = text(a.start_time);
  return HHMM_RE.test(s) ? s : '';
}

/** "YYYY-MM-DDTHH:mm" when both halves are known, "YYYY-MM-DD" with only the date, "" without one. */
export function joinStart(date: string, time: string): string {
  if (!date) return '';
  return time ? `${date}T${time}` : date;
}

/** The zone the form's times are read in: its own, else the host's. */
export function zoneOf(a: Answers, ctx: Pick<FormContext, 'timeZone'>): string {
  return knownTimeZone(text(a.time_zone)) ?? knownTimeZone(ctx.timeZone) ?? 'UTC';
}

/** The start as an instant, or null while the date or time is missing. */
export function startInstant(a: Answers, ctx: Pick<FormContext, 'timeZone'>): Date | null {
  const date = datePart(a.scheduled_at);
  const time = startTime(a);
  if (!date || !time) return null;
  return wallClockToInstant(`${date}T${time}`, zoneOf(a, ctx));
}

/** Today's date ("YYYY-MM-DD") on the wall in `zone`. */
export function wallDate(at: Date, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Whether the start has passed. With a time: the instant is before now. With
 * only a date: the day is before today, in the gathering's zone.
 */
export function startHasPassed(a: Answers, ctx: Pick<FormContext, 'timeZone' | 'now'>): boolean {
  const date = datePart(a.scheduled_at);
  if (!date) return false;
  const at = startInstant(a, ctx);
  if (at) return at.getTime() < ctx.now.getTime();
  return date < wallDate(ctx.now, zoneOf(a, ctx));
}

// ── repeat ───────────────────────────────────────────────────────────────────

export type RepeatPattern = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export function repeatPattern(a: Answers): RepeatPattern | null {
  const p = text(a.recurrence_pattern).toUpperCase();
  return p === 'DAILY' || p === 'WEEKLY' || p === 'MONTHLY' ? p : null;
}

export function isRepeating(a: Answers): boolean {
  return repeatPattern(a) !== null;
}

/** Pass 2 seam: Repeats on + "Present it as a series" makes a series (codeKind 'series'). Not drawn in pass 1. */
export function isSeries(a: Answers): boolean {
  return isRepeating(a) && a['forms.repeat_as_series'] === true;
}

/**
 * The instants of the first `max` occurrences, by utils' expandOccurrences (the
 * calendar's and the reminder engine's maths): weekly and daily in fixed steps,
 * monthly on the same weekday of the month.
 */
export function occurrences(a: Answers, ctx: Pick<FormContext, 'timeZone'>, max: number): Date[] {
  const date = datePart(a.scheduled_at);
  const start = startInstant(a, ctx) ?? (date ? wallClockToInstant(date, zoneOf(a, ctx)) : null);
  if (!start || max < 1) return [];
  const pattern = repeatPattern(a);
  if (!pattern) return [start];
  const far = new Date(start.getTime() + 400 * 24 * 36e5 * Math.max(1, Math.ceil(max / 12)));
  return expandOccurrences([{ scheduledAt: start, recurrencePattern: pattern }], start, far, max).map((o) => o.at);
}

/**
 * recurrence_until for "N sessions": the last session's date, at 23:59 on the
 * wall, so that session itself is inside the bound (attendee-reminders.ts:108
 * skips an occurrence after `until`; a bare date reads as its midnight).
 */
export function untilForCount(a: Answers, ctx: Pick<FormContext, 'timeZone'>, count: number): string {
  if (!Number.isInteger(count) || count < 1) return '';
  const all = occurrences(a, ctx, count);
  const last = all[count - 1];
  if (!last) return '';
  return `${wallDate(last, zoneOf(a, ctx))}T23:59`;
}

/** "Until a date" as stored: the chosen day at 23:59, so its own session counts. */
export function untilForDate(date: string): string {
  return date ? `${date}T23:59` : '';
}

/** forms.repeat_count, else the number of sessions recurrence_until allows (derived back on load). */
export function sessionCount(a: Answers, ctx: Pick<FormContext, 'timeZone'>): number | null {
  const n = num(a['forms.repeat_count']);
  if (n !== null && Number.isInteger(n) && n > 0) return n;
  const untilDate = datePart(a.recurrence_until);
  if (!untilDate || !isRepeating(a)) return null;
  const zone = zoneOf(a, ctx);
  const all = occurrences(a, ctx, 400);
  const inside = all.filter((at) => wallDate(at, zone) <= untilDate).length;
  return inside > 0 ? inside : null;
}

/** recurrence_until's instant (a bare date is its midnight, as convert.ts sends it). */
export function untilInstant(a: Answers, ctx: Pick<FormContext, 'timeZone'>): Date | null {
  const raw = text(a.recurrence_until).trim();
  if (!raw) return null;
  return wallClockToInstant(raw, zoneOf(a, ctx));
}

// ── words ────────────────────────────────────────────────────────────────────

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ORDINALS = ['first', 'second', 'third', 'fourth', 'last'];

function ymd(date: string): { y: number; m: number; d: number } | null {
  const m = DATE_RE.exec(date);
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
}

export function weekdayOf(date: string): string {
  const p = ymd(date);
  return p ? WEEKDAYS[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()]! : '';
}

/** "Thu 19 Nov 2026" (with the year) or "19 Nov" (without). */
export function dayLabel(date: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const p = ymd(date);
  if (!p) return '';
  const wd = opts.weekday ? `${weekdayOf(date).slice(0, 3)} ` : '';
  return `${wd}${p.d} ${MONTHS[p.m - 1]}${opts.year ? ` ${p.y}` : ''}`;
}

/** "18:30" + 120 → "20:30"; past midnight it says so. */
export function endTime(time: string, minutes: number | null): string {
  const m = HHMM_RE.exec(time);
  if (!m || minutes === null || !Number.isFinite(minutes)) return '';
  const total = Number(m[1]) * 60 + Number(m[2]) + Math.round(minutes);
  const days = Math.floor(total / 1440);
  const t = ((total % 1440) + 1440) % 1440;
  const hhmm = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  return days > 0 ? `${hhmm} the next day` : hhmm;
}

/** 60 → "1h", 90 → "1½h", 45 → "45 min", 150 → "2h 30 min". */
export function durationLabel(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return '';
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  if (minutes % 60 === 30 && minutes < 600) return `${Math.floor(minutes / 60)}½h`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60} min`;
}

/** "Eastern time (Toronto)". Falls back to the zone's id where Intl has no generic name. */
export function zoneLabel(zone: string): string {
  if (!zone || zone === 'UTC' || zone === 'Etc/UTC') return 'UTC';
  const city = (zone.split('/').pop() ?? zone).replace(/_/g, ' ');
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longGeneric' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value;
    if (name && !/^GMT/.test(name)) return `${name.replace(/ Time$/, ' time')} (${city})`;
  } catch {
    // older Intl: the id is still readable
  }
  return zone.replace(/_/g, ' ');
}

/** "Every week on Thursday, 8 sessions" | "Every day, until 21 Jan" | "Does not repeat". */
export function repeatSummary(a: Answers, ctx: Pick<FormContext, 'timeZone'>): string {
  const pattern = repeatPattern(a);
  if (!pattern) return 'Does not repeat';
  const date = datePart(a.scheduled_at);
  const day = date ? weekdayOf(date) : '';
  let head: string;
  if (pattern === 'DAILY') head = 'Every day';
  else if (pattern === 'WEEKLY') head = day ? `Every week on ${day}` : 'Every week';
  else {
    const p = ymd(date);
    head = p && day ? `Every month on the ${ORDINALS[Math.min(4, Math.ceil(p.d / 7) - 1)]} ${day}` : 'Every month';
  }
  const count = num(a['forms.repeat_count']);
  if (count !== null && count > 0) return `${head}, ${count} ${count === 1 ? 'session' : 'sessions'}`;
  const until = datePart(a.recurrence_until);
  if (until) return `${head}, until ${dayLabel(until)}`;
  return head;
}

// ============================================================================
// Series in place: pure readers for the session planner, its summaries and
// the series rules (soft tissue, pass 2). PLAN §12, README §4 "Sessions".
//
// A gathering becomes a series with Repeats on WEEKLY and
// forms.repeat_as_series (rules/answers.ts isSeries). The schedule is the
// gathering's own keys plus two design keys:
//
//   scheduled_at               the first session (its date and time, wall clock)
//   forms.repeat_every_weeks   1–4 (services' intervalWeeksOf, meeting-series.ts:95)
//   forms.repeat_count         N sessions HELD: skipped dates push the end out
//   recurrence_until           in count mode, the Nth held date at 23:59; in
//                              "until" mode the fixed last date
//   forms.sessions             the live list, one entry per date, with the typed
//                              title, note and skip kept by date
//
// The adapter (forms/adapters/series.ts) builds its input from seriesSessions(),
// never from raw forms.sessions, so a preset or a stale list can't send a date
// that is off the rule (ensureSeriesSession refuses one, meeting-series.ts:1297).
//
// Numbers follow the server (bone's ruling, option (a), a recorded deviation
// from the design's live renumbering): a week keeps its rule number when another
// is skipped, and a skipped week keeps its own, struck through (stable number,
// meeting-series.ts:296; cancelSeriesSession keeps the row, :1603-1622). So the
// list's "Session 4" is the site's "Session 4". sessionNumbering is the switch.
//
// Everything here is wall-date arithmetic on "YYYY-MM-DD": the zone does not
// move a date, only the instant, which the adapter works out from time_zone.
// ============================================================================

import type { Answers, FormContext } from '../contract';
import { datePart, dayLabel, isSeries, num, repeatPattern, weekdayOf } from './answers';

export interface SessionEntry {
  date: string;
  title?: string;
  note?: string;
  skipped?: boolean;
  reason?: string;
}

export interface SessionRow {
  date: string;
  /** The session's number on the site. Null only under 'held' numbering, for a skipped date. */
  number: number | null;
  title: string;
  note: string;
  skipped: boolean;
  reason: string;
}

/** 'rule': every date keeps the number the server gives it. 'held': skips renumber (the design's prototype). */
export const sessionNumbering: 'rule' | 'held' = 'rule';

/** How many sessions an open-ended series lists (it has no last date to count to). */
export const OPEN_PREVIEW = 8;

/** The most dates the planner walks or lists. */
export const MAX_SESSIONS = 200;

/** The choices for "Every": 1 to 4 weeks (meeting-series.ts:95). */
export const SERIES_EVERY_WEEKS = [1, 2, 3, 4] as const;

// ── reading the keys ────────────────────────────────────────────────────────

/** forms.repeat_every_weeks as the server reads it: 1–4, else 1 (intervalWeeksOf, meeting-series.ts:95-98). */
export function seriesEveryWeeks(a: Answers): number {
  const n = num(a['forms.repeat_every_weeks']);
  return n !== null && Number.isInteger(n) && n >= 1 && n <= 4 ? n : 1;
}

/** "Present it as a series" is offered only on a weekly repeat: a series is WEEKLY only (meeting-series.ts:1918, adapters/series.ts). */
export function canBeSeries(a: Answers): boolean {
  return repeatPattern(a) === 'WEEKLY';
}

/** The typed entries in forms.sessions, by date. Malformed rows are skipped. */
export function sessionEntries(a: Answers): SessionEntry[] {
  const raw = a['forms.sessions'];
  if (!Array.isArray(raw)) return [];
  const out: SessionEntry[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const e = x as Record<string, unknown>;
    const date = datePart(e.date);
    if (!date) continue;
    out.push({
      date,
      ...(typeof e.title === 'string' && e.title ? { title: e.title } : {}),
      ...(typeof e.note === 'string' && e.note ? { note: e.note } : {}),
      ...(e.skipped === true ? { skipped: true } : {}),
      ...(typeof e.reason === 'string' && e.reason ? { reason: e.reason } : {}),
    });
  }
  return out;
}

export type SeriesEnds = 'count' | 'until' | 'open';

/** How the run ends: N held sessions, a last date, or not at all. */
export function seriesEnds(a: Answers): SeriesEnds {
  const n = num(a['forms.repeat_count']);
  if (n !== null && Number.isInteger(n) && n > 0) return 'count';
  return datePart(a.recurrence_until) ? 'until' : 'open';
}

// ── the rule's dates ────────────────────────────────────────────────────────

function addDays(date: string, days: number): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** The k-th date of the rule (0 = the first session), every N weeks from the first date. */
export function seriesRuleDate(a: Answers, k: number): string {
  const first = datePart(a.scheduled_at);
  if (!first) return '';
  return addDays(first, k * 7 * seriesEveryWeeks(a));
}

// ── the live list ───────────────────────────────────────────────────────────

/**
 * The planner's rows: the rule's dates, each with what was typed for that date.
 *
 *   count  dates until N are held (skipped dates are walked past, so they push the end out)
 *   until  every date up to the last date (the range is fixed; skips lower the count)
 *   open   the first OPEN_PREVIEW held sessions
 *
 * `extra` are entries to fall back on for a date forms.sessions does not hold
 * (the planner's memory of a row that dropped off the end, and bulk skips).
 */
export function seriesSessions(a: Answers, _ctx?: Pick<FormContext, 'timeZone'>, extra: SessionEntry[] = []): SessionRow[] {
  const first = datePart(a.scheduled_at);
  if (!first) return [];
  const byDate = new Map<string, SessionEntry>();
  for (const e of extra) byDate.set(e.date, e);
  for (const e of sessionEntries(a)) byDate.set(e.date, e);

  const ends = seriesEnds(a);
  const target = ends === 'count' ? Math.min(MAX_SESSIONS, num(a['forms.repeat_count'])!) : ends === 'open' ? OPEN_PREVIEW : Infinity;
  const until = ends === 'until' ? datePart(a.recurrence_until) : '';

  const rows: SessionRow[] = [];
  let held = 0;
  for (let k = 0; k < MAX_SESSIONS * 2 && rows.length < MAX_SESSIONS; k++) {
    const date = seriesRuleDate(a, k);
    if (until && date > until) break;
    const e = byDate.get(date);
    const skipped = e?.skipped === true;
    if (!skipped) held++;
    rows.push({
      date,
      number: sessionNumbering === 'rule' ? k + 1 : skipped ? null : held,
      title: e?.title ?? '',
      note: e?.note ?? '',
      skipped,
      reason: e?.reason ?? '',
    });
    if (held >= target) break;
  }
  return rows;
}

/** forms.sessions as stored: the live list, keeping only what was typed. */
export function toEntries(rows: SessionRow[]): SessionEntry[] {
  return rows.map((r) => ({
    date: r.date,
    ...(r.title ? { title: r.title } : {}),
    ...(r.note ? { note: r.note } : {}),
    ...(r.skipped ? { skipped: true } : {}),
    ...(r.reason ? { reason: r.reason } : {}),
  }));
}

/** The forms.sessions value for these answers (the live list rebuilt from the schedule). */
export function rebuildSessions(a: Answers, extra: SessionEntry[] = []): SessionEntry[] {
  return toEntries(seriesSessions(a, undefined, extra));
}

/** recurrence_until for "N sessions" in a series: the Nth HELD date at 23:59 (skips push it out). */
export function seriesUntilForCount(a: Answers, count: number, extra: SessionEntry[] = []): string {
  if (!Number.isInteger(count) || count < 1) return '';
  const rows = seriesSessions({ ...a, 'forms.repeat_count': count }, undefined, extra);
  const last = rows[rows.length - 1];
  return last ? `${last.date}T23:59` : '';
}

/** Sessions that will be held (the planner's count). */
export function seriesHeldCount(a: Answers): number {
  return seriesSessions(a).filter((r) => !r.skipped).length;
}

/**
 * `fields` plus every schedule key a series patch must carry so the list and the
 * last date agree with it: forms.sessions rebuilt, and in count mode
 * recurrence_until moved to the Nth held date. `a` is the answers before the
 * patch. Unchanged for a gathering that is not (or stops being) a series.
 */
export function withSeriesSchedule(a: Answers, fields: Partial<Answers>, extra: SessionEntry[] = []): Partial<Answers> {
  let next: Answers = { ...a, ...fields };
  if (!isSeries(next)) return fields;
  const out: Partial<Answers> = { ...fields };
  if (seriesEnds(next) === 'count') {
    const until = seriesUntilForCount(next, num(next['forms.repeat_count'])!, extra);
    out.recurrence_until = until;
    next = { ...next, recurrence_until: until };
  }
  out['forms.sessions'] = rebuildSessions(next, extra);
  return out;
}

// ── words ───────────────────────────────────────────────────────────────────

/** "Session 8, no title yet" (README §4: untitled rows). */
export function untitledLabel(row: Pick<SessionRow, 'number'>): string {
  return row.number !== null ? `Session ${row.number}, no title yet` : 'No title yet';
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "8 sessions · 19 Nov to 21 Jan · 2 dates skipped" (the design's summary line). */
export function sessionsSummary(a: Answers): string {
  const rows = seriesSessions(a);
  if (!rows.length) return 'Pick the first date and the sessions appear here';
  const held = rows.filter((r) => !r.skipped);
  const skipped = rows.length - held.length;
  const span = held.length ? held : rows;
  const from = dayLabel(span[0]!.date);
  const to = dayLabel(span[span.length - 1]!.date);
  const skips = skipped ? ` · ${plural(skipped, 'date', 'dates')} skipped` : '';
  if (seriesEnds(a) === 'open') return `No last date · the first ${plural(held.length, 'session', 'sessions')} from ${from}${skips}`;
  const range = from === to ? from : `${from} to ${to}`;
  return `${plural(held.length, 'session', 'sessions')} · ${range}${skips}`;
}

/** "Every 2 weeks on Thursday, 8 sessions": the Repeats line for a series. */
export function seriesRepeatSummary(a: Answers): string {
  const date = datePart(a.scheduled_at);
  const day = date ? weekdayOf(date) : '';
  const n = seriesEveryWeeks(a);
  const every = n === 1 ? 'Every week' : `Every ${n} weeks`;
  const head = day ? `${every} on ${day}` : every;
  const ends = seriesEnds(a);
  if (ends === 'count') return `${head}, ${plural(seriesHeldCount(a), 'session', 'sessions')}`;
  if (ends === 'until') return `${head}, until ${dayLabel(datePart(a.recurrence_until))}`;
  return head;
}

/** "First: Monotype basics" for the series card; the first held session with a title. */
export function firstTitledSession(a: Answers): string {
  return seriesSessions(a).find((r) => !r.skipped && r.title.trim())?.title.trim() ?? '';
}

// ── the Series page row ─────────────────────────────────────────────────────

export interface SeriesPageChoice {
  /** metadata.series.listed (SaveSeriesSettingsInput, meeting-series.ts:1050). */
  listed: boolean;
  /** metadata.series.landing (:1052). */
  slides: boolean;
  /** site_config presented_series (saveSeriesPageSettings featuredId, series-page.ts:76). */
  featured: boolean;
}

/** forms.series_page with the design's defaults: listed, not in the slides, not featured. */
export function seriesPageOf(a: Answers): SeriesPageChoice {
  const v = a['forms.series_page'];
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  return {
    listed: o.listed !== false,
    slides: o.slides === true,
    featured: o.featured === true,
  };
}

/** "Listed on Series · colour picked for you". The colour is the page's own pick by position (series-page.ts:154). */
export function seriesPageSummary(a: Answers): string {
  const p = seriesPageOf(a);
  let where: string;
  if (p.featured) where = p.slides || p.listed ? 'Featured on Series' : 'Featured';
  else if (p.listed && p.slides) where = 'Listed on Series and in the slides';
  else if (p.listed) where = 'Listed on Series';
  else if (p.slides) where = 'In the landing slides only';
  else where = 'Not listed on Series';
  return `${where} · colour picked for you`;
}

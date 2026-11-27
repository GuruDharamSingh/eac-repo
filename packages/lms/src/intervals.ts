// ============================================================================
// INTERVALS: the clock rules of an ongoing session. PURE: no I/O, the clock and the time zone are passed in.
//
// An ongoing session repeats every N days (1 = daily, 7 = weekly) from a start date, optionally to an end date.
// An interval is named by its first calendar day in the WRITER'S OWN time zone ("YYYY-MM-DD"). It closes at the end of
// its last local day (11:59 pm local, which is the same as the next local midnight), so the same instant can be open for
// one person and closed for another, and every entry files under its writer's own day.
// ============================================================================

export const DEFAULT_TZ = 'America/Toronto';

export interface IntervalSpec {
  /** 1 = every day, 7 = every week, N = every N days. */
  everyDays: number;
  /** First day of the first interval, "YYYY-MM-DD". */
  start: string;
  /** Last day on which anything is open, "YYYY-MM-DD", or null for no end. */
  end?: string | null;
  /** Entries close when the interval ends (the default). When false, a past interval stays open for late entries. */
  closes: boolean;
}

/** A zone the runtime knows, else the site default. Never throws. */
export function validTz(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

/** The calendar day an instant falls on in a zone, "YYYY-MM-DD". */
export function localDateKey(now: Date, tz: string): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: validTz(tz), year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (t: string) => p.find((x) => x.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const DAY = 86_400_000;
export const dayNumber = (key: string): number => Math.floor(Date.parse(`${key.slice(0, 10)}T00:00:00Z`) / DAY);
export const addDaysKey = (key: string, n: number): string => new Date((dayNumber(key) + n) * DAY).toISOString().slice(0, 10);
export const isDateKey = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(Date.parse(`${s}T00:00:00Z`)).toISOString().startsWith(s);

/** Index of the interval a local date falls in (negative before the start). */
export function intervalIndex(spec: IntervalSpec, localDate: string): number {
  return Math.floor((dayNumber(localDate) - dayNumber(spec.start)) / spec.everyDays);
}
export const intervalKeyAt = (spec: IntervalSpec, index: number): string => addDaysKey(spec.start, index * spec.everyDays);

/** Is this a key an interval of this session can have (aligned to the start, not before it, not after the end)? */
export function isIntervalKey(spec: IntervalSpec, key: string): boolean {
  if (!isDateKey(key)) return false;
  const d = dayNumber(key) - dayNumber(spec.start);
  if (d < 0 || d % spec.everyDays !== 0) return false;
  return !(spec.end && key > spec.end);
}

export type CurrentInterval =
  | { state: 'before'; opensOn: string }
  | { state: 'running'; key: string; index: number }
  | { state: 'ended' };

/** Which interval is "now" for a writer in a zone. */
export function currentInterval(spec: IntervalSpec, now: Date, tz: string): CurrentInterval {
  const today = localDateKey(now, tz);
  if (today < spec.start) return { state: 'before', opensOn: spec.start };
  if (spec.end && today > spec.end) return { state: 'ended' };
  const index = intervalIndex(spec, today);
  return { state: 'running', key: intervalKeyAt(spec, index), index };
}

/**
 * future: not open yet; open: may be written (the current interval, or a past one when entries do not close);
 * closed: over, read only; invalid: not an interval of this session.
 */
export type IntervalState = 'future' | 'open' | 'closed' | 'invalid';

export function intervalState(spec: IntervalSpec, key: string, now: Date, tz: string): IntervalState {
  if (!isIntervalKey(spec, key)) return 'invalid';
  const today = localDateKey(now, tz);
  const k = intervalIndex(spec, key);
  if (today < spec.start) return 'future';
  // After the end every interval is past.
  const cur = spec.end && today > spec.end ? Number.POSITIVE_INFINITY : intervalIndex(spec, today);
  if (k > cur) return 'future';
  if (k === cur) return 'open';
  return spec.closes ? 'closed' : 'open';
}

/** The instant a local calendar day begins in a zone (its local midnight). */
export function localMidnight(dateKey: string, tz: string): Date {
  const zone = validTz(tz);
  const [y, m, d] = dateKey.split('-').map(Number);
  let guess = Date.UTC(y, m - 1, d);
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(guess));
    const g = (t: string) => Number(parts.find((x) => x.type === t)!.value);
    const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
    const wanted = Date.UTC(y, m - 1, d);
    guess += wanted - asUtc;
  }
  return new Date(guess);
}

/** When an interval closes for a writer in a zone: the start of the next interval, local midnight. */
export function intervalClosesAt(spec: IntervalSpec, key: string, tz: string): Date {
  return localMidnight(addDaysKey(key, spec.everyDays), tz);
}

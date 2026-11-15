/**
 * Wall clock ↔ instant in a named time zone, with Intl only (no library).
 *
 * Open hours are stored as wall-clock ranges in the offer's zone; a slot is
 * an instant. `zonedToInstant` turns a local date and minute-of-day into the
 * instant, re-checking the offset once so a DST change between the guess and
 * the answer is taken into account. A wall time that does not exist (the
 * spring-forward hour) maps forward by the gap; one that occurs twice maps to
 * the first.
 */

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function dtf(timeZone: string): Intl.DateTimeFormat {
  let f = dtfCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    dtfCache.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface ZonedParts {
  /** "YYYY-MM-DD" in the zone. */
  date: string;
  weekday: number;
  /** Minutes since local midnight. */
  minutes: number;
}

export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const p: Record<string, string> = {};
  for (const part of dtf(timeZone).formatToParts(instant)) p[part.type] = part.value;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    weekday: WEEKDAYS[p.weekday] ?? 0,
    minutes: Number(p.hour) * 60 + Number(p.minute),
  };
}

/** The zone's offset from UTC at `instant`, in minutes (Toronto in winter: -300). */
export function offsetMinutes(instant: Date, timeZone: string): number {
  const p: Record<string, string> = {};
  const whole = new Date(Math.floor(instant.getTime() / 1000) * 1000);
  for (const part of dtf(timeZone).formatToParts(whole)) p[part.type] = part.value;
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - whole.getTime()) / 60000);
}

/** The instant of local `date` ("YYYY-MM-DD") at `minutes` past midnight in `timeZone`. */
export function zonedToInstant(date: string, minutes: number, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const first = offsetMinutes(new Date(guess), timeZone);
  let t = guess - first * 60000;
  const second = offsetMinutes(new Date(t), timeZone);
  if (second !== first) {
    const retry = guess - second * 60000;
    // In a spring-forward gap neither offset gives back the asked wall time;
    // keep the first answer, which lands after the gap (02:30 → 03:30).
    if (zonedParts(new Date(retry), timeZone).minutes === minutes) t = retry;
  }
  return new Date(t);
}

/** "YYYY-MM-DD" plus `days`, calendar arithmetic only. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Weekday (0 = Sunday) of a calendar date. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "HH:MM" → minutes since midnight, or null. "24:00" is allowed as an end. */
export function parseClock(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 24 || (h === 24 && min !== 0)) return null;
  return h * 60 + min;
}

export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "Tuesday 18 November, 14:00" in `timeZone`, for mail and pages. */
export function formatWhen(iso: string, timeZone: string, locale = "en-CA"): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toUTCString();
  }
}

/** "EST", "CET" — the zone's short name at that instant. */
export function zoneAbbreviation(iso: string, timeZone: string): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
      .formatToParts(new Date(iso))
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

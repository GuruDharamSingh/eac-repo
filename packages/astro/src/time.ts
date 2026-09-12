/**
 * Local civil time at the birthplace → UTC.
 *
 * The prototype built the local time with `new Date(y, m, d, …)`, which reads
 * it in the SERVER's zone, then applied the offset with the wrong sign. That
 * happened to cancel out on a machine set to US Eastern and produced charts
 * 2× the offset wrong everywhere else (14:30 New York → 10:30 UTC instead of
 * 18:30). Everything here is zone-independent: only UTC epoch arithmetic plus
 * Intl, which carries the full historical tz database (DST rules as of the
 * birth date, not today's).
 */

export class ChartInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChartInputError";
  }
}

export interface UtcParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const DATE_RE = /^(-?\d{1,4})-(\d{1,2})-(\d{1,2})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const OFFSET_RE = /^(?:UTC|GMT)?([+-])(\d{1,2}):?(\d{2})?$/i;

/** Epoch ms for a UTC wall time. Date.UTC maps years 0–99 to 1900–1999, so set the year explicitly. */
function utcEpoch(p: UtcParts): number {
  const d = new Date(0);
  d.setUTCFullYear(p.year, p.month - 1, p.day);
  d.setUTCHours(p.hour, p.minute, p.second, 0);
  return d.getTime();
}

function partsOf(epochMs: number): UtcParts {
  const d = new Date(epochMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

/** Offset of `timeZone` from UTC at the given instant, in minutes (east positive). */
function zoneOffsetMinutes(timeZone: string, epochMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    era: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
  const get = (type: string) => dtf.formatToParts(new Date(epochMs)).find((p) => p.type === type)?.value ?? "0";
  const era = get("era");
  const year = Number(get("year"));
  const wall = utcEpoch({
    year: era === "BC" ? 1 - year : year,
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
  });
  return Math.round((wall - epochMs) / 60000);
}

/** Fixed offset in minutes for "UTC", "Z", "+05:30", "-0800", "GMT+1"; null for anything else. */
function fixedOffsetMinutes(timeZone: string): number | null {
  const tz = timeZone.trim();
  if (/^(UTC|GMT|Z|Etc\/UTC)$/i.test(tz)) return 0;
  const m = tz.match(OFFSET_RE);
  if (!m) return null;
  const minutes = Number(m[2]) * 60 + Number(m[3] ?? 0);
  if (minutes > 14 * 60) throw new ChartInputError(`UTC offset out of range: ${timeZone}`);
  return m[1] === "-" ? -minutes : minutes;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    if (fixedOffsetMinutes(timeZone) !== null) return true;
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function parseLocalDateTime(date: string, time: string): UtcParts {
  const dm = date.trim().match(DATE_RE);
  if (!dm) throw new ChartInputError(`Invalid date "${date}" — expected YYYY-MM-DD`);
  const tm = time.trim().match(TIME_RE);
  if (!tm) throw new ChartInputError(`Invalid time "${time}" — expected HH:MM or HH:MM:SS`);

  const parts: UtcParts = {
    year: Number(dm[1]),
    month: Number(dm[2]),
    day: Number(dm[3]),
    hour: Number(tm[1]),
    minute: Number(tm[2]),
    second: Number(tm[3] ?? 0),
  };
  if (parts.month < 1 || parts.month > 12) throw new ChartInputError(`Invalid month in "${date}"`);
  if (parts.hour > 23 || parts.minute > 59 || parts.second > 59) throw new ChartInputError(`Invalid time "${time}"`);
  // Round-trip catches 2023-02-30 and friends.
  const back = partsOf(utcEpoch(parts));
  if (back.year !== parts.year || back.month !== parts.month || back.day !== parts.day) {
    throw new ChartInputError(`"${date}" is not a real calendar date`);
  }
  return parts;
}

/**
 * Convert a local wall time in `timeZone` to UTC.
 *
 * The offsets in force a day either side of the wall time are the only
 * candidates (no zone changes offset twice in 48 hours). A candidate is valid
 * when converting with it lands on an instant where the zone really uses it.
 * The two DST edges resolve the way mainstream chart services do:
 *   - fall-back overlap (two valid candidates): the earlier occurrence;
 *   - spring-forward gap (none valid): shift forward, i.e. read the
 *     nonexistent 02:30 with the pre-transition offset → 03:30.
 */
export function localToUtc(date: string, time: string, timeZone: string): { utc: UtcParts; offsetMinutes: number } {
  const local = parseLocalDateTime(date, time);
  const wallAsUtc = utcEpoch(local);

  const fixed = fixedOffsetMinutes(timeZone);
  if (fixed !== null) {
    return { utc: partsOf(wallAsUtc - fixed * 60000), offsetMinutes: fixed };
  }

  if (!isValidTimeZone(timeZone)) throw new ChartInputError(`Unknown time zone "${timeZone}"`);

  const DAY = 86_400_000;
  const before = zoneOffsetMinutes(timeZone, wallAsUtc - DAY);
  const after = zoneOffsetMinutes(timeZone, wallAsUtc + DAY);
  const valid = [...new Set([before, after])].filter(
    (o) => zoneOffsetMinutes(timeZone, wallAsUtc - o * 60000) === o,
  );
  // Earliest instant = largest offset.
  const offset = valid.length > 0 ? Math.max(...valid) : before;
  return { utc: partsOf(wallAsUtc - offset * 60000), offsetMinutes: offset };
}

export function utcIso(p: UtcParts): string {
  return new Date(utcEpoch(p)).toISOString();
}

/** The current moment as UTC parts, for "sky now" charts. */
export function nowUtc(): UtcParts {
  return partsOf(Date.now());
}

export type StepUnit = "hour" | "day" | "week" | "month" | "year";

/**
 * Move an instant by `amount` units (negative to go back), in UTC.
 *
 * Month and year steps keep the day of the month, clamped to the target
 * month's length: 31 January steps to 28/29 February rather than overflowing
 * into March the way setUTCMonth alone does, and 29 February steps to 28
 * February in a common year.
 */
export function stepInstant(from: Date, unit: StepUnit, amount: number): Date {
  const d = new Date(from.getTime());
  switch (unit) {
    case "hour":
      d.setUTCHours(d.getUTCHours() + amount);
      break;
    case "day":
      d.setUTCDate(d.getUTCDate() + amount);
      break;
    case "week":
      d.setUTCDate(d.getUTCDate() + 7 * amount);
      break;
    case "month":
    case "year": {
      const day = d.getUTCDate();
      d.setUTCDate(1);
      if (unit === "month") d.setUTCMonth(d.getUTCMonth() + amount);
      else d.setUTCFullYear(d.getUTCFullYear() + amount);
      const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(day, lastDay));
      break;
    }
  }
  return d;
}

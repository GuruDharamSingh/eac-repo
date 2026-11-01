// ============================================================================
// A meeting series, as the composer holds it (2026-10-10).
//
// Pure functions over the compose answers of kind `series`
// (`content-fields.ts`): the schedule a host passes to services'
// `saveSeriesSchedule`, and the lines of the live card preview. No React, no
// DB, so a host's adapter and a node check can both import them.
//
// Answer keys: `scheduled_at` is the first session as a wall clock
// ("YYYY-MM-DDTHH:mm") in `time_zone`; its weekday is the series' weekday.
// `recurrence_until` is the last session's local date ("YYYY-MM-DD"),
// inclusive. The repeat is always weekly.
// ============================================================================

/** The zones a series prints its times in unless told otherwise (IFAC `series-time.ts` DEFAULT_ALSO_ZONES). */
export const DEFAULT_SERIES_DISPLAY_ZONES = ["America/Los_Angeles", "America/New_York", "Europe/Paris"];

/** Zones offered for a series' own zone order and its display zones; same list as the planner's settings. */
export const SERIES_ZONE_CHOICES: Array<{ value: string; label: string }> = [
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris" },
];

const ZONE_SHORT_NAME: Record<string, string> = {
  "America/Los_Angeles": "Pacific",
  "America/Vancouver": "Pacific",
  "America/Denver": "Mountain",
  "America/Edmonton": "Mountain",
  "America/Chicago": "Central",
  "America/Winnipeg": "Central",
  "America/New_York": "Eastern",
  "America/Toronto": "Eastern",
  "America/Halifax": "Atlantic",
  "Europe/London": "London",
  "Europe/Paris": "Paris",
  UTC: "UTC",
};

/** "Pacific", "Eastern", "Paris"; a city name for zones not in the list. */
export function seriesZoneName(zone: string): string {
  return ZONE_SHORT_NAME[zone] ?? zone.split("/").pop()?.replace(/_/g, " ") ?? zone;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function parseDate(value: string): { y: number; mo: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return { y, mo, d };
}

function dayIndex(p: { y: number; mo: number; d: number }): number {
  return Math.round(Date.UTC(p.y, p.mo - 1, p.d) / 86_400_000);
}

/** The schedule a host hands to `saveSeriesSchedule`, or the reason it cannot. */
export interface SeriesScheduleAnswers {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** "HH:MM", 24-hour. */
  time: string;
  timeZone: string;
  firstDate: string;
  lastDate: string | null;
  durationMinutes: number | null;
  alsoZones: string[];
}

/** Display zones in the order the choice list gives them, unknown ones after, no duplicates. */
export function orderedDisplayZones(value: unknown): string[] {
  const list = Array.isArray(value) ? value.map(String).filter(Boolean) : [];
  const order = SERIES_ZONE_CHOICES.map((z) => z.value);
  const known = order.filter((z) => list.includes(z));
  const rest = list.filter((z, i) => !order.includes(z) && list.indexOf(z) === i);
  return [...known, ...rest];
}

/**
 * The series schedule from compose answers. `errors` is keyed by answer name
 * so a form can show each beside its field; `schedule` is null when any is set.
 */
export function seriesScheduleFromAnswers(answers: Record<string, unknown>): {
  schedule: SeriesScheduleAnswers | null;
  errors: Record<string, string[]>;
} {
  const errors: Record<string, string[]> = {};
  const first = str(answers.scheduled_at);
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(first);
  const firstDate = m ? parseDate(m[1]) : null;
  if (!m || !firstDate) errors.scheduled_at = ["Pick the date and time of the first session"];
  const timeZone = str(answers.time_zone);
  if (!timeZone) errors.time_zone = ["Pick the time zone the series meets in"];
  const last = str(answers.recurrence_until);
  const lastDate = last ? parseDate(last) : null;
  if (last && !lastDate) errors.recurrence_until = ["The last session is not a date"];
  if (firstDate && lastDate && dayIndex(lastDate) < dayIndex(firstDate)) {
    errors.recurrence_until = ["The last session is before the first"];
  }
  const durationRaw = answers.duration_minutes;
  const duration =
    durationRaw === null || durationRaw === undefined || durationRaw === "" ? null : Math.round(Number(durationRaw));
  if (duration !== null && (!Number.isFinite(duration) || duration < 15 || duration > 600)) {
    errors.duration_minutes = ["A session lasts between 15 minutes and 10 hours"];
  }
  if (Object.keys(errors).length || !m || !firstDate) return { schedule: null, errors };
  return {
    schedule: {
      weekday: new Date(Date.UTC(firstDate.y, firstDate.mo - 1, firstDate.d)).getUTCDay(),
      time: `${m[2]}:${m[3]}`,
      timeZone,
      firstDate: m[1],
      lastDate: lastDate ? last.slice(0, 10) : null,
      durationMinutes: duration,
      alsoZones: orderedDisplayZones(answers.also_zones),
    },
    errors,
  };
}

/** "6:00 PM" from "18:00". */
function clock12(hhmm: string): string {
  const [h, mi] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mi).padStart(2, "0")} ${suffix}`;
}

function longDate(p: { y: number; mo: number; d: number }, withYear: boolean): string {
  return `${p.d} ${MONTHS[p.mo - 1]}${withYear ? ` ${p.y}` : ""}`;
}

/** What the card on the site says, line by line. Empty strings for what is not filled in yet. */
export interface SeriesCardLines {
  kicker: string;
  title: string;
  /** "Mondays, 6:00 PM Pacific" */
  when: string;
  /** "12 October to 2 November 2026 · online" */
  span: string;
  /** Number of sessions between the first and last dates; null when open-ended or unknown. */
  sessions: number | null;
}

export function seriesCardLines(answers: Record<string, unknown>, opts: { orgName?: string } = {}): SeriesCardLines {
  const first = str(answers.scheduled_at);
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(first);
  const firstDate = m ? parseDate(m[1]) : null;
  const zone = str(answers.time_zone);
  const lastDate = parseDate(str(answers.recurrence_until));

  let when = "";
  if (firstDate && m) {
    const weekday = WEEKDAYS[new Date(Date.UTC(firstDate.y, firstDate.mo - 1, firstDate.d)).getUTCDay()];
    when = `${weekday}s, ${clock12(m[2])}${zone ? ` ${seriesZoneName(zone)}` : ""}`;
  }

  const format = str(answers.format) || "online";
  const where = format === "in_person" ? "in person" : format === "hybrid" ? "online and in person" : "online";
  let span = "";
  let sessions: number | null = null;
  if (firstDate && lastDate && dayIndex(lastDate) >= dayIndex(firstDate)) {
    const sameYear = firstDate.y === lastDate.y;
    span = `${longDate(firstDate, !sameYear)} to ${longDate(lastDate, true)}`;
    sessions = Math.floor((dayIndex(lastDate) - dayIndex(firstDate)) / 7) + 1;
  } else if (firstDate) {
    span = `From ${longDate(firstDate, true)}`;
  }
  if (span) span = `${span} · ${where}`;

  return {
    kicker: ["Weekly series", opts.orgName].filter(Boolean).join(" · "),
    title: str(answers.title),
    when,
    span,
    sessions,
  };
}

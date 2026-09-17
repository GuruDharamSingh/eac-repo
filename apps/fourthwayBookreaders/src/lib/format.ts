import { siteConfig } from "@/config/site";

const TZ = siteConfig.timeZone;

/** "Thursday 24 September, 7:30 pm" in the circle's own zone. */
export function formatWhen(d: Date | null): string | null {
  if (!d) return null;
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  }).format(d);
}

export function formatDay(d: Date | null): string | null {
  if (!d) return null;
  return new Intl.DateTimeFormat("en-CA", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }).format(d);
}

export function formatDuration(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** WEEKLY → "every week", etc. */
export function formatRecurrence(pattern: string | null): string | null {
  switch (pattern) {
    case "DAILY": return "every day";
    case "WEEKLY": return "every week";
    case "MONTHLY": return "every month";
    case "CUSTOM": return "recurring";
    default: return null;
  }
}

/** Strip tags for an excerpt. Server-only use; the body is trusted HTML from our own editor. */
export function textOf(html: string | null, max = 220): string {
  if (!html) return "";
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * A `datetime-local` value is wall-clock time in the circle's zone, but the
 * containers run UTC — `new Date("2026-10-01T19:30")` there is 19:30 UTC, which
 * silently moves a 7:30 pm reading to 3:30 pm Toronto. Convert explicitly.
 */
export function zonedInputToDate(value: string): Date | null {
  if (!value) return null;
  const local = value.length === 10 ? `${value}T00:00` : value;
  const asIfUtc = new Date(`${local}:00Z`);
  if (Number.isNaN(asIfUtc.getTime())) return null;
  const shifted = new Date(asIfUtc.getTime() - zoneOffsetMs(asIfUtc));
  // Re-check at the resulting instant: near a DST switch the offset that
  // applies is the one at the real moment, not the provisional guess.
  return new Date(asIfUtc.getTime() - zoneOffsetMs(shifted));
}

function zoneOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second")) - at.getTime();
}

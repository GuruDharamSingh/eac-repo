/**
 * Display formatting.
 *
 * Everything is rendered in Toronto time regardless of where the visitor is:
 * this is a physical community at one address, so "4:00 AM" must mean 4am at
 * 348 Palmerston Blvd, not 4am in the reader's browser. A traveller checking
 * the schedule should see the time they need to show up, not a converted one.
 */

const TZ = "America/Toronto";

/**
 * Turn a `datetime-local` / `date` value into the correct instant.
 *
 * The form labels these fields "Toronto time", but `new Date("2026-08-15T04:55")`
 * parses in the *server's* timezone — and the container runs UTC. A 4:55 AM
 * sadhana was being stored as 04:55Z, i.e. 12:55 AM in Toronto. This converts
 * the wall-clock reading the author typed into the matching UTC instant,
 * accounting for DST on that particular date.
 */
export function torontoInputToDate(value: string): Date | null {
  if (!value) return null;

  // A bare date (recurrence end, RSVP deadline) means midnight that day.
  const local = value.length === 10 ? `${value}T00:00` : value;
  const asIfUtc = new Date(`${local}:00Z`);
  if (Number.isNaN(asIfUtc.getTime())) return null;

  const shifted = new Date(asIfUtc.getTime() - torontoOffsetMs(asIfUtc));
  // Re-check at the resulting instant: near a DST switch the offset that
  // applies is the one at the real moment, not the provisional guess.
  const settled = new Date(asIfUtc.getTime() - torontoOffsetMs(shifted));
  return settled;
}

/** How far ahead of UTC Toronto is at a given instant, in milliseconds. */
function torontoOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wallClock = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second")
  );
  return wallClock - at.getTime();
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: TZ,
  });
}

export function formatShortDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: TZ,
  });
}

export function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  });
}

export function formatDateTime(date: Date | string): string {
  return `${formatDate(date)} · ${formatTime(date)}`;
}

export function formatDuration(minutes: number | null): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h} hour${h > 1 ? "s" : ""}`;
  return `${m} min`;
}

const PATTERN_LABEL: Record<string, string> = {
  DAILY: "Every day",
  WEEKLY: "Every week",
  MONTHLY: "Every month",
  CUSTOM: "Recurring",
};

export function formatRecurrence(pattern: string | null): string | null {
  if (!pattern || pattern === "NONE") return null;
  return PATTERN_LABEL[pattern.toUpperCase()] ?? "Recurring";
}

/** Strip HTML for meta descriptions and card previews. */
export function toPlainText(html: string | null, limit = 200): string {
  if (!html) return "";
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

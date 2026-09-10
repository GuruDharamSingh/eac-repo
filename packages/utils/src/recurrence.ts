// ============================================================================
// Cycle math for recurring meetings.
//
// A recurring meeting occurs at scheduledAt + k * interval. Confirmations and
// RSVPs are valid for the *current* cycle only: they expire the moment the
// most recent occurrence ends (start + duration), so a daily meeting resets
// daily, weekly resets weekly, etc. CUSTOM patterns fall back to weekly.
//
// Lives in @elkdonis/utils rather than @elkdonis/services because these are
// pure functions with no database access, and client components (meeting
// cards, feed rows) need them — importing from services would drag the
// postgres client into the browser bundle.
//
// KEEP IN SYNC: a SQL twin of this math lives in
// apps/inner-gathering/src/lib/data.ts (CYCLE_CUTOFF_SQL / ATTENDEE_COUNT_SQL),
// which computes the same cutoff in-query so RSVP counts reset per cycle
// without a round trip. Change one, change the other.
// ============================================================================

export type RecurrencePattern = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM";

const DAY_MS = 24 * 60 * 60 * 1000;

export function recurrenceIntervalMs(pattern: string | null | undefined): number {
  switch ((pattern || "").toUpperCase()) {
    case "DAILY":
      return DAY_MS;
    case "MONTHLY":
      return 30 * DAY_MS;
    default: // WEEKLY, CUSTOM, unknown
      return 7 * DAY_MS;
  }
}

/**
 * End time of the most recent occurrence that has fully ended, or null if the
 * meeting is not recurring. May be before the first occurrence (k < 0) for a
 * meeting that hasn't happened yet — comparisons still work correctly since
 * anything after that moment counts for the upcoming occurrence.
 */
export function lastOccurrenceEnd(
  scheduledAt: Date,
  pattern: string | null | undefined,
  durationMinutes?: number | null
): Date | null {
  if (!pattern || pattern === "NONE") return null;
  const intervalMs = recurrenceIntervalMs(pattern);
  const durationMs = (durationMinutes || 60) * 60 * 1000;
  const k = Math.floor((Date.now() - durationMs - scheduledAt.getTime()) / intervalMs);
  return new Date(scheduledAt.getTime() + k * intervalMs + durationMs);
}

/**
 * The next upcoming occurrence (or the one happening right now). For
 * non-recurring meetings this is just scheduledAt.
 */
export function nextOccurrence(
  scheduledAt: Date,
  pattern: string | null | undefined,
  durationMinutes?: number | null
): Date {
  if (!pattern || pattern === "NONE") return scheduledAt;
  const intervalMs = recurrenceIntervalMs(pattern);
  const durationMs = (durationMinutes || 60) * 60 * 1000;
  // Smallest k whose occurrence hasn't ended yet
  const k = Math.max(
    0,
    Math.ceil((Date.now() - durationMs - scheduledAt.getTime()) / intervalMs)
  );
  return new Date(scheduledAt.getTime() + k * intervalMs);
}

/** True if a timestamp (confirmation, RSVP) still counts for the current cycle. */
export function isWithinCurrentCycle(
  timestamp: Date,
  scheduledAt: Date,
  pattern: string | null | undefined,
  durationMinutes?: number | null
): boolean {
  const cutoff = lastOccurrenceEnd(scheduledAt, pattern, durationMinutes);
  if (!cutoff) return true; // non-recurring: never expires
  return timestamp > cutoff;
}

// ============================================================================
// Calendar-grid expansion.
//
// The functions above answer "when is the next one?" — enough for a card, not
// enough for a month view, where ONE recurring thread is four or five cells.
//
// Expansion happens here rather than in SQL on purpose. A recursive CTE could
// generate the occurrences, but it would return rows that do not exist as
// records, which then cannot be clicked through to anything. Expanding from
// the real row keeps every cell pointing back at its own thread.
//
// `recurrenceIntervalMs` above is the single source for the interval, so a
// grid and a "next occurrence" badge on the same screen can never disagree —
// which they would the moment a second copy of the interval table appeared.
// ============================================================================

/** The minimum a thing needs for the grid to place it. */
export interface Occurring {
  scheduledAt: string | Date | null;
  recurrencePattern?: string | null;
}

export type Occurrence<T> = { item: T; at: Date };

/**
 * Every occurrence of every item that falls in [from, to).
 *
 * Non-recurring items contribute at most one. Recurring items are walked
 * forward from their start — jumping straight to the first occurrence at or
 * after `from` rather than stepping there one interval at a time, so an item
 * scheduled years ago costs the same as one scheduled last week.
 *
 * `maxPerItem` is a guard, not a feature: a corrupt `scheduled_at` far in the
 * past with a daily pattern would otherwise spin here.
 */
export function expandOccurrences<T extends Occurring>(
  items: T[],
  from: Date,
  to: Date,
  maxPerItem = 64
): Array<Occurrence<T>> {
  const out: Array<Occurrence<T>> = [];

  for (const item of items) {
    if (!item.scheduledAt) continue;
    const start = new Date(item.scheduledAt);
    if (Number.isNaN(start.getTime())) continue;

    const pattern = item.recurrencePattern;
    if (!pattern || pattern === "NONE") {
      if (start >= from && start < to) out.push({ item, at: start });
      continue;
    }

    const stepMs = recurrenceIntervalMs(pattern);
    let current = start;
    if (current < from) {
      const skipped = Math.floor((from.getTime() - current.getTime()) / stepMs);
      current = new Date(current.getTime() + skipped * stepMs);
    }
    for (let guard = 0; guard < maxPerItem && current < to; guard++) {
      if (current >= from) out.push({ item, at: current });
      current = new Date(current.getTime() + stepMs);
    }
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Local-time YYYY-MM-DD. The key a grid buckets on. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

/** Group expanded occurrences by the local day they fall on. */
export function occurrencesByDay<T extends Occurring>(
  items: T[],
  from: Date,
  to: Date
): Map<string, Array<Occurrence<T>>> {
  const map = new Map<string, Array<Occurrence<T>>>();
  for (const occurrence of expandOccurrences(items, from, to)) {
    const key = dayKey(occurrence.at);
    const list = map.get(key);
    if (list) list.push(occurrence);
    else map.set(key, [occurrence]);
  }
  return map;
}

/**
 * The cells of a month, with leading blanks so day 1 sits under its weekday.
 * `null` is a padding cell.
 */
export function monthGrid(month: Date): Array<Date | null> {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = new Array(first.getDay()).fill(null);
  for (let day = 1; day <= days; day++) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  return cells;
}

/** First instant of `date`'s month. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** First instant of the month `count` months from `date`'s. */
export function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

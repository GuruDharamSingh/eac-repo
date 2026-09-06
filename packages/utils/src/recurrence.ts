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

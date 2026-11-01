// ============================================================================
// Wall clock in a zone ⇄ instant.
//
// The composer's date fields hold wall-clock strings ("2026-10-12T18:00", or
// "2026-10-12" for a date) read in the form's `time_zone`. A host must turn
// them into instants before writing a `timestamptz`: a bare
// "2026-10-12T18:00" sent to Postgres is read in the session zone (UTC on this
// platform), which shifts the instant by the zone's offset.
//
// `wallClockToInstant` is the inverse of `toDatetimeLocal`
// (`surface/format.ts`), which is what fills the edit form, so an unchanged
// edit converts back to the stored instant. Same two-pass offset correction
// as the apps' `zonedInputToDate` (innergathering, amrit-canada, sunjay
// `lib/format.ts`) and services' `zonedInstant` (`meeting-series.ts`).
// ============================================================================

/** Local minus UTC, in ms, at instant `ms` in `zone`. */
function zoneOffsetMs(ms: number, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const hour = get("hour") === 24 ? 0 : get("hour");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** The zone if Intl knows it, else null. */
export function knownTimeZone(zone: string | null | undefined): string | null {
  if (!zone || typeof zone !== "string" || !zone.trim()) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone.trim() });
    return zone.trim();
  } catch {
    return null;
  }
}

/** The browser's (or server's) own zone, or UTC. */
export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * The instant at which the wall clock in `zone` reads `value`
 * ("YYYY-MM-DDTHH:mm", "YYYY-MM-DDTHH:mm:ss" or "YYYY-MM-DD", the last read
 * as midnight). A value that already names its offset ("…Z", "…+02:00") is
 * parsed as it stands. Null for an empty or unparseable value or an unknown
 * zone.
 */
export function wallClockToInstant(value: string | null | undefined, zone: string | null | undefined): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(raw) && raw.includes("T")) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(raw);
  if (!m) return null;
  const tz = knownTimeZone(zone);
  if (!tz) return null;
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0));
  if (Number.isNaN(guess)) return null;
  const first = guess - zoneOffsetMs(guess, tz);
  // Second pass: the offset at the guess and at the answer differ across a
  // daylight-saving change.
  return new Date(guess - zoneOffsetMs(first, tz));
}

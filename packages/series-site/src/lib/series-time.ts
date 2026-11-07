/**
 * Times for a series shown in several zones at once. A session time is
 * printed in the series' own zone and then the others the series lists
 * (`metadata.series.alsoZones`; Pacific, Eastern and Paris by default,
 * developer decision 2026-10-10). The planner's Series settings edit both.
 */

export const DEFAULT_SERIES_ZONE = "America/New_York";
export const DEFAULT_ALSO_ZONES = ["America/Los_Angeles", "America/New_York", "Europe/Paris"];

const ZONE_SHORT: Record<string, string> = {
  "America/New_York": "ET",
  "America/Toronto": "ET",
  "America/Chicago": "CT",
  "America/Denver": "MT",
  "America/Los_Angeles": "PT",
  "America/Vancouver": "PT",
  // City names rather than CET/CEST or GMT/BST: the abbreviation changes
  // with daylight saving and the label is static.
  "Europe/London": "London",
  "Europe/Paris": "Paris",
};

export function zoneLabel(zone: string): string {
  return ZONE_SHORT[zone] ?? zone.split("/").pop()?.replace(/_/g, " ") ?? zone;
}

export function timeIn(at: string | Date, zone: string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return d.toLocaleTimeString("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" }).replace(" ", " ").toLowerCase();
}

/** "7:00 pm ET · 6:00 pm CT · 4:00 pm PT" */
export function timeInZones(at: string | Date, zones: string[]): string {
  return zones.map((z) => `${timeIn(at, z)} ${zoneLabel(z)}`).join(" · ");
}

export function dateParts(at: string | Date, zone: string): { weekday: string; day: string; month: string; long: string } {
  const d = typeof at === "string" ? new Date(at) : at;
  return {
    weekday: d.toLocaleDateString("en-US", { timeZone: zone, weekday: "short" }),
    day: d.toLocaleDateString("en-US", { timeZone: zone, day: "numeric" }),
    month: d.toLocaleDateString("en-US", { timeZone: zone, month: "short" }),
    long: d.toLocaleDateString("en-US", { timeZone: zone, weekday: "long", month: "long", day: "numeric" }),
  };
}

/** "Thursdays" from the series' first date, in its zone. */
export function weekdayPlural(at: string | Date, zone: string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return `${d.toLocaleDateString("en-US", { timeZone: zone, weekday: "long" })}s`;
}

export function seriesZones(series: { timeZone: string | null; presentation: { alsoZones?: string[] | null } }): { zone: string; zones: string[] } {
  const zone = series.timeZone ?? DEFAULT_SERIES_ZONE;
  const also = (series.presentation.alsoZones ?? DEFAULT_ALSO_ZONES).filter((z) => z !== zone);
  return { zone, zones: [zone, ...also] };
}

// ─── Display zones with a next-day mark (2026-10-10, series page top) ───────

const ZONE_LONG: Record<string, string> = {
  "America/New_York": "Eastern",
  "America/Toronto": "Eastern",
  "America/Chicago": "Central",
  "America/Denver": "Mountain",
  "America/Los_Angeles": "Pacific",
  "America/Vancouver": "Pacific",
  "Europe/London": "London",
  "Europe/Paris": "Paris",
};

export function zoneLongLabel(zone: string): string {
  return ZONE_LONG[zone] ?? zoneLabel(zone);
}

/**
 * The zones a public page prints, in the series' own order: its
 * `alsoZones` list (Pacific, Eastern, Paris by default), with the series'
 * zone put first only when the list leaves it out.
 */
export function displayZones(series: { timeZone: string | null; presentation: { alsoZones?: string[] | null } }): string[] {
  const zone = series.timeZone ?? DEFAULT_SERIES_ZONE;
  const list = series.presentation.alsoZones?.length ? series.presentation.alsoZones : DEFAULT_ALSO_ZONES;
  return list.includes(zone) ? [...list] : [zone, ...list];
}

/** "6 pm" on the hour, "6:30 pm" otherwise. */
function shortTime(at: Date, zone: string): string {
  const t = at.toLocaleTimeString("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" }).toLowerCase();
  return t.replace(":00", "");
}

function ymd(at: Date, zone: string): string {
  return at.toLocaleDateString("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
}

/**
 * One entry per zone: "6 pm Pacific", "3 am Paris" with `dayMark` "Tue"
 * when that zone's date differs from the date in the series' own zone
 * (`baseZone`), so a reader in Paris sees the session falls on their
 * Tuesday.
 */
export function timesWithDayMark(at: string | Date, zones: string[], baseZone: string): Array<{ zone: string; text: string; dayMark: string | null }> {
  const d = typeof at === "string" ? new Date(at) : at;
  const baseDay = ymd(d, baseZone);
  return zones.map((z) => ({
    zone: z,
    text: `${shortTime(d, z)} ${zoneLongLabel(z)}`,
    dayMark: ymd(d, z) === baseDay ? null : d.toLocaleDateString("en-US", { timeZone: z, weekday: "short" }),
  }));
}

/** "Monday 12 October" in the series' zone. */
export function dayMonthLong(at: string | Date, zone: string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  const weekday = d.toLocaleDateString("en-US", { timeZone: zone, weekday: "long" });
  const day = d.toLocaleDateString("en-US", { timeZone: zone, day: "numeric" });
  const month = d.toLocaleDateString("en-US", { timeZone: zone, month: "long" });
  return `${weekday} ${day} ${month}`;
}

// ─── The rhythm in words (2026-11-02, monthly series) ───────────────────────

const ORDINALS = ["First", "Second", "Third", "Fourth", "Fifth"];

type RhythmSeries = { recurrencePattern: string | null; schedule?: { intervalWeeks?: number | null } | null };

/** "Weekly", "Every 2 weeks", "Monthly", "Daily", or "Series" with no recurrence. */
export function rhythmLabel(series: RhythmSeries): string {
  const every = series.schedule?.intervalWeeks ?? 1;
  if (series.recurrencePattern === "WEEKLY") return every > 1 ? `Every ${every} weeks` : "Weekly";
  if (series.recurrencePattern === "MONTHLY") return "Monthly";
  if (series.recurrencePattern === "DAILY") return "Daily";
  return "Series";
}

/** "Thursdays", "Every 2 weeks, Thursdays", or "First Saturday of the month". */
export function scheduleLine(series: RhythmSeries, at: string | Date, zone: string): string {
  const every = series.schedule?.intervalWeeks ?? 1;
  if (series.recurrencePattern === "MONTHLY") {
    const d = typeof at === "string" ? new Date(at) : at;
    const day = Number(d.toLocaleDateString("en-US", { timeZone: zone, day: "numeric" }));
    const weekday = d.toLocaleDateString("en-US", { timeZone: zone, weekday: "long" });
    return `${ORDINALS[Math.ceil(day / 7) - 1] ?? "First"} ${weekday} of the month`;
  }
  return every > 1 ? `Every ${every} weeks, ${weekdayPlural(at, zone)}` : weekdayPlural(at, zone);
}

/** "This week" within seven days, else "Next session": a monthly series' next session can be weeks off. */
export function comingLabel(week: { isNext?: boolean; at: string }): string {
  return week.isNext && Date.parse(week.at) - Date.now() < 7 * 86_400_000 ? "This week" : "Next session";
}

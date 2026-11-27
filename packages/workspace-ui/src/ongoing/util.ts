// Small date helpers for the ongoing session. Keys are ISO dates ("2026-01-22"), read as UTC days.
import type { Ongoing } from "../types";

const asDate = (key: string) => new Date(`${key.slice(0, 10)}T00:00:00Z`);

export function addDays(key: string, n: number): string {
  const d = asDate(key);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const fmt = (key: string, o: Intl.DateTimeFormatOptions) => {
  const d = asDate(key);
  return Number.isNaN(d.getTime()) ? key : d.toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });
};

/** "Thu 22 Jan", or "Week of 19 Jan" for a weekly interval. */
export function fmtKey(key: string, every: Ongoing["every"]): string {
  return every === "week" ? `Week of ${fmt(key, { day: "numeric", month: "short" })}` : fmt(key, { weekday: "short", day: "numeric", month: "short" });
}

/** "Thursday 22 January". */
export function longDate(iso: string): string {
  return fmt(iso, { weekday: "long", day: "numeric", month: "long" });
}

/** "Fri 23 Jan": the day an interval starts. */
export function dayLabel(key: string): string {
  return fmt(key, { weekday: "short", day: "numeric", month: "short" });
}

/** "7:12 pm". */
export function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(" AM", " am").replace(" PM", " pm");
}

export function nextKey(key: string, every: Ongoing["every"], everyDays?: number): string {
  return addDays(key, everyDays ?? (every === "week" ? 7 : 1));
}

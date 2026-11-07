/**
 * Calendar arithmetic for the schedule planner — pure, no database import,
 * so the planner's client components and the server actions share it.
 *
 * Days are handled as Paris wall-clock date strings (YYYY-MM-DD) and stepped
 * with UTC date maths, which has no DST; a day only becomes an instant at the
 * end, through `parisInputToDate`, which applies the offset in force on that
 * particular date. That keeps "every Saturday at 10:00" at 10:00 in Paris on
 * both sides of the March and October clock changes.
 */
import { parisInputToDate } from "@/lib/format";
import { siteConfig } from "@/config/site";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Most departures one repeat submission may create. */
export const MAX_SCHEDULE_BATCH = 120;
/** Longest date range a repeat submission may span, in days. */
export const MAX_SCHEDULE_SPAN_DAYS = 366;

/** Mon = 1 … Sun = 7 (ISO), for the weekday pickers. */
export const WEEKDAYS = [
  { n: 1, short: "Mon" },
  { n: 2, short: "Tue" },
  { n: 3, short: "Wed" },
  { n: 4, short: "Thu" },
  { n: 5, short: "Fri" },
  { n: 6, short: "Sat" },
  { n: 7, short: "Sun" },
] as const;

export function isDay(s: unknown): s is string {
  if (typeof s !== "string" || !DAY_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function isTime(s: unknown): s is string {
  return typeof s === "string" && TIME_RE.test(s);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** ISO weekday of a date string: Mon = 1 … Sun = 7. */
export function isoWeekday(day: string): number {
  const w = new Date(`${day}T00:00:00Z`).getUTCDay();
  return w === 0 ? 7 : w;
}

export function mondayOf(day: string): string {
  return addDays(day, 1 - isoWeekday(day));
}

/** Whole days from `a` to `b` (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Today's date on the Paris wall clock. */
export function parisToday(now: Date = new Date()): string {
  return parisDayOf(now);
}

/** The Paris calendar day an instant falls on. */
export function parisDayOf(at: Date | string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: siteConfig.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
}

/** HH:MM on the Paris wall clock. */
export function parisTimeOf(at: Date | string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: siteConfig.timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(at));
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h === "24" ? "00" : h}:${m}`;
}

/** The instant a Paris wall-clock day + time names. */
export function parisInstant(day: string, time = "00:00"): Date | null {
  return parisInputToDate(`${day}T${time}`);
}

/** Week bounds as instants: Monday 00:00 Paris to the next Monday 00:00 Paris. */
export function weekRange(monday: string): { from: Date; to: Date } {
  return { from: parisInstant(monday)!, to: parisInstant(addDays(monday, 7))! };
}

/** Normalise a `?week=` param to that week's Monday; anything unreadable means this week. */
export function resolveWeek(param: string | undefined, now: Date = new Date()): string {
  return mondayOf(isDay(param) ? param : parisToday(now));
}

/** "Mon 3 Nov" etc. for a date string, formatted at noon UTC so no zone can tip it a day. */
export function formatDay(day: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}

/** "3 – 9 Nov 2026", "27 Oct – 2 Nov 2026", "29 Dec 2026 – 4 Jan 2027". */
export function formatWeekLabel(monday: string): string {
  const sunday = addDays(monday, 6);
  const sameYear = monday.slice(0, 4) === sunday.slice(0, 4);
  const sameMonth = sameYear && monday.slice(5, 7) === sunday.slice(5, 7);
  const start = formatDay(monday, sameMonth ? { day: "numeric" } : sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
  return `${start} – ${formatDay(sunday, { day: "numeric", month: "short", year: "numeric" })}`;
}

// ── repeat scheduling ─────────────────────────────────────────────────────

export interface RepeatPlanInput {
  /** ISO weekdays, Mon = 1 … Sun = 7. */
  weekdays: number[];
  /** HH:MM, Paris wall clock. */
  times: string[];
  /** Inclusive Paris date strings. */
  from: string;
  to: string;
}

export type PlannedStatus = "new" | "exists" | "past" | "over_cap";

export interface PlannedDeparture {
  day: string;
  time: string;
  /** ISO instant. */
  startsAt: string;
  status: PlannedStatus;
}

export interface RepeatPlan {
  items: PlannedDeparture[];
  /** How many would be created by this submission (≤ MAX_SCHEDULE_BATCH). */
  creatable: number;
  /** New slots beyond the cap; schedule them with a second submission. */
  overCap: number;
  existing: number;
  past: number;
}

/** Check a repeat request; returns an error sentence or null. */
export function checkRepeatInput(input: RepeatPlanInput): string | null {
  if (!isDay(input.from) || !isDay(input.to)) return "Pick a start and an end date.";
  if (input.to < input.from) return "The end date is before the start date.";
  if (daysBetween(input.from, input.to) > MAX_SCHEDULE_SPAN_DAYS) return "Schedule at most a year at a time.";
  const weekdays = input.weekdays.filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
  if (weekdays.length === 0) return "Pick at least one weekday.";
  if (input.times.length === 0) return "Add at least one start time.";
  if (!input.times.every(isTime)) return "A start time could not be read (use HH:MM).";
  return null;
}

/**
 * Every slot a repeat request names, in order, each marked: `new` (will be
 * created), `exists` (a scheduled departure of this tour already starts at
 * that instant), `past`, or `over_cap` (new, but beyond this submission's
 * limit). `existing` holds the start instants (ms) of the tour's scheduled
 * departures.
 */
export function planRepeat(
  input: RepeatPlanInput,
  existing: ReadonlySet<number>,
  now: Date = new Date(),
  cap: number = MAX_SCHEDULE_BATCH
): RepeatPlan {
  const weekdays = new Set(input.weekdays);
  const times = [...new Set(input.times.filter(isTime))].sort();
  const items: PlannedDeparture[] = [];
  let creatable = 0;
  let overCap = 0;
  let exists = 0;
  let past = 0;
  const span = Math.min(daysBetween(input.from, input.to), MAX_SCHEDULE_SPAN_DAYS);
  for (let i = 0; i <= span; i++) {
    const day = addDays(input.from, i);
    if (!weekdays.has(isoWeekday(day))) continue;
    for (const time of times) {
      const at = parisInstant(day, time);
      if (!at) continue;
      let status: PlannedStatus;
      if (at.getTime() <= now.getTime()) {
        status = "past";
        past += 1;
      } else if (existing.has(at.getTime())) {
        status = "exists";
        exists += 1;
      } else if (creatable < cap) {
        status = "new";
        creatable += 1;
      } else {
        status = "over_cap";
        overCap += 1;
      }
      items.push({ day, time, startsAt: at.toISOString(), status });
    }
  }
  return { items, creatable, overCap, existing: exists, past };
}

// ── month strip ───────────────────────────────────────────────────────────

/**
 * The month a week "belongs" to (the month of its Thursday, as ISO weeks
 * do) and the Monday-to-Sunday grid that shows it.
 */
export function monthGrid(monday: string): { month: string; label: string; days: string[]; prevWeek: string; nextWeek: string } {
  const thursday = addDays(monday, 3);
  const month = thursday.slice(0, 7);
  const first = `${month}-01`;
  const start = mondayOf(first);
  const nextFirst = addDays(first, 32).slice(0, 7) + "-01";
  const lastDay = addDays(nextFirst, -1);
  const end = addDays(mondayOf(lastDay), 6);
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  // The week holding the 8th always has its Thursday inside that month.
  const prevFirst = addDays(first, -1).slice(0, 7) + "-01";
  return {
    month,
    label: formatDay(first, { month: "long", year: "numeric" }),
    days,
    prevWeek: mondayOf(addDays(prevFirst, 7)),
    nextWeek: mondayOf(addDays(nextFirst, 7)),
  };
}

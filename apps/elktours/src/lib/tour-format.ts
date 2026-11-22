/**
 * Pure formatting for tours — no database import, so client components can
 * use it. lib/tours.ts re-exports these for server code.
 */
import { siteConfig } from "@/config/site";

export function formatPrice(major: number | null, currency: string = siteConfig.currency): string {
  if (major == null || !(major > 0)) return "Price on request";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: major % 1 === 0 ? 0 : 2 }).format(major);
}

export function formatDuration(minutes: number | null): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m}`;
}

// Dates are written from numeric parts, not Intl's weekday/month patterns: the server's ICU (Node, Alpine) and the
// browser's (Chrome) punctuate those differently ("Fri 27 Nov" vs "Fri, 27 Nov"), and a client component that
// formats a date then fails hydration (React #418) and is redrawn on the client (claude, 2026-11-17).
const WD_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WD_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Wall-clock parts of an instant in a time zone (Paris by default). `weekday`: 0 = Sunday. */
export interface WallClock { year: number; month: number; day: number; hour: number; minute: number; weekday: number }

export function wallClock(at: string | Date, timeZone: string = siteConfig.timeZone): WallClock {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23",
  }).formatToParts(new Date(at));
  const n = (t: string) => Number(parts.find((x) => x.type === t)?.value ?? 0);
  const year = n("year"), month = n("month"), day = n("day");
  return { year, month, day, hour: n("hour") % 24, minute: n("minute"), weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

/** Wall-clock parts of a "YYYY-MM-DD" day key (no time). */
export function wallDay(key: string): WallClock {
  const [year = 1970, month = 1, day = 1] = key.split("-").map(Number);
  return { year, month, day, hour: 0, minute: 0, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

/** "Fri 27 Nov" · long: "Friday 27 November" · year: "Fri 27 Nov 2026". */
export function formatWallDate(c: WallClock, opts: { long?: boolean; year?: boolean } = {}): string {
  const wd = (opts.long ? WD_LONG : WD_SHORT)[c.weekday];
  const mon = (opts.long ? MON_LONG : MON_SHORT)[c.month - 1];
  return `${wd} ${c.day} ${mon}${opts.year ? ` ${c.year}` : ""}`;
}

/** "09:30". */
export function formatWallTime(c: WallClock): string {
  return `${pad2(c.hour)}:${pad2(c.minute)}`;
}

/** "Fri 27 Nov, 10:00" (Paris), the same on the server and in the browser. */
export function formatDeparture(iso: string, opts: { withYear?: boolean } = {}): string {
  const c = wallClock(iso);
  return `${formatWallDate(c, { year: opts.withYear })}, ${formatWallTime(c)}`;
}

/** A `datetime-local` value (Paris wall clock) for an instant. */
export function toParisInput(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: siteConfig.timeZone,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}

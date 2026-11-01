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

export function formatDeparture(iso: string, opts: { withYear?: boolean } = {}): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(opts.withYear ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
    timeZone: siteConfig.timeZone,
  }).format(new Date(iso));
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

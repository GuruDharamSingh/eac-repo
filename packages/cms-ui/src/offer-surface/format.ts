import type { Money, SurfaceOffer } from "./types";

// Formatting for the offer surfaces. A fixed locale (en-US) so the server
// and the browser draw the same string for the same instant; the page's own
// pieces render on the server, the layers only in the browser.

/** "$80", "$80.50", "€12", "CA$20" - whole amounts drop the cents. */
export function fmtMoney(m: Money | null | undefined): string {
  if (!m) return "";
  const major = m.amountMinor / 100;
  const whole = m.amountMinor % 100 === 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: m.currency,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${major.toFixed(whole ? 0 : 2)} ${m.currency}`;
  }
}

export function money(amountMinor: number, currency: string): Money {
  return { amountMinor, currency };
}

function fmt(iso: string, opts: Intl.DateTimeFormatOptions, timeZone?: string | null): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: timeZone || undefined }).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-US", opts).format(d);
  }
}

/** { day: "14", weekday: "SAT", month: "DEC", time: "8:00 PM" } for the date block. */
export function dateBlock(iso: string, timeZone?: string | null) {
  return {
    day: fmt(iso, { day: "numeric" }, timeZone),
    weekday: fmt(iso, { weekday: "short" }, timeZone).toUpperCase(),
    month: fmt(iso, { month: "short" }, timeZone).toUpperCase(),
    time: fmt(iso, { hour: "numeric", minute: "2-digit" }, timeZone).toUpperCase(),
  };
}

/** "Sat 14 Dec · 8:00 pm" */
export function shortWhen(iso: string, timeZone?: string | null): string {
  const d = fmt(iso, { weekday: "short", day: "numeric", month: "short" }, timeZone);
  const t = fmt(iso, { hour: "numeric", minute: "2-digit" }, timeZone).toLowerCase();
  // "Sat, Dec 14" -> "Sat 14 Dec"
  const m = /^(\w+),? (\w+) (\d+)$/.exec(d);
  const day = m ? `${m[1]} ${m[3]} ${m[2]}` : d;
  return `${day} · ${t}`;
}

/** "SAT 14 DEC · 8 PM" for the mono meta lines. */
export function monoWhen(iso: string, timeZone?: string | null): string {
  const b = dateBlock(iso, timeZone);
  return `${b.weekday} ${b.day} ${b.month} · ${b.time.replace(":00", "")}`;
}

export function whenOf(offer: SurfaceOffer): string | null {
  return offer.when?.start ? shortWhen(offer.when.start, offer.when.timeZone) : null;
}

/** Plain text looks like text; anything with a tag is treated as sanitised HTML. */
export function looksLikeHtml(s: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(s);
}

/** One VEVENT as a data URL, for "Add to calendar". Null without a start. */
export function offerIcsUrl(input: { uid: string; title: string; startIso: string; minutes?: number | null; location?: string | null }): string | null {
  const start = new Date(input.startIso);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + (input.minutes && input.minutes > 0 ? input.minutes : 60) * 60_000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Elkdonis Arts Collective//Offer surface//EN",
    "BEGIN:VEVENT",
    `UID:${esc(input.uid)}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(input.title)}`,
  ];
  if (input.location) lines.push(`LOCATION:${esc(input.location)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

// ── ended events (2026-11-27: past events show as past, no RSVP) ────────────

/** An event with no end and no length is taken to run three hours. */
export const DEFAULT_EVENT_MS = 3 * 60 * 60 * 1000;

/** True when an instant that starts something (a session) is far enough behind `now` that it is over. */
export function startEnded(startIso: string, now: number = Date.now(), minutes?: number | null): boolean {
  const t = new Date(startIso).getTime();
  if (Number.isNaN(t)) return false;
  return t + (minutes && minutes > 0 ? minutes * 60_000 : DEFAULT_EVENT_MS) < now;
}

/**
 * True when an EVENT is over: its end (`when.end`, else start + `durationMinutes`, else start + 3 hours) is
 * before `now`. Other kinds never end. Reads the clock when `now` is left out, so a component must not call
 * it during render without `useNowMs` (ended.ts), or the server and browser can disagree.
 */
export function hasEnded(offer: SurfaceOffer | null | undefined, now: number = Date.now()): boolean {
  if (!offer || offer.kind !== "event" || !offer.when?.start) return false;
  const end = offer.when.end ? new Date(offer.when.end).getTime() : NaN;
  if (!Number.isNaN(end)) return end < now;
  return startEnded(offer.when.start, now, offer.durationMinutes);
}

/** "Sat 14 Dec" */
export function shortDate(iso: string, timeZone?: string | null): string {
  return shortWhen(iso, timeZone).split(" · ")[0] ?? "";
}

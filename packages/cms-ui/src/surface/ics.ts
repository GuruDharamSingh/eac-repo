import type { SurfaceThread } from "./types";
import { toPlainText } from "./format";

// ============================================================================
// "Add to my calendar" without a server.
//
// The org's Nextcloud calendar (services/org-calendar.ts) is a projection for
// members who subscribe; this is for everyone else — a guest who wants the
// 4am sadhana on their phone. One VEVENT, RFC 5545, handed over as a data URL
// the browser saves. The UID is the thread id, the same as the CalDAV mirror
// uses, so importing both does not duplicate the entry.
// ============================================================================

const RRULE: Record<string, string> = {
  DAILY: "FREQ=DAILY",
  WEEKLY: "FREQ=WEEKLY",
  MONTHLY: "FREQ=MONTHLY",
};

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Fold at 75 octets per RFC 5545 §3.1. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

export function buildIcs(thread: SurfaceThread, origin?: string): string | null {
  const startIso = thread.nextOccurrenceAt ?? thread.scheduledAt;
  if (!startIso) return null;
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + (thread.durationMinutes ?? 60) * 60_000);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Elkdonis Arts Collective//Surface//EN",
    "BEGIN:VEVENT",
    `UID:${thread.id}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeText(thread.title)}`,
  ];
  const description = toPlainText(thread.excerpt ?? thread.bodyHtml, 800);
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  if (thread.location) lines.push(`LOCATION:${escapeText(thread.location)}`);
  const url = thread.meetingUrl ?? (thread.href && origin ? `${origin}${thread.href}` : null);
  if (url) lines.push(`URL:${url}`);
  const rule = thread.recurrencePattern ? RRULE[thread.recurrencePattern] : undefined;
  if (rule) {
    const until = thread.recurrenceUntil ? new Date(thread.recurrenceUntil) : null;
    lines.push(`RRULE:${rule}${until && !Number.isNaN(until.getTime()) ? `;UNTIL=${stamp(until)}` : ""}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.map(fold).join("\r\n");
}

export function icsDataUrl(ics: string): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

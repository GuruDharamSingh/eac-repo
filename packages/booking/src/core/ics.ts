/** One booking as an iCalendar event (RFC 5545), for both sides. */

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function bookingIcs(b: {
  id: string;
  title: string;
  scheduledAt: string | null;
  durationMinutes: number | null;
  hostName?: string | null;
  bookerName?: string | null;
  url?: string | null;
}): string | null {
  if (!b.scheduledAt) return null;
  const start = new Date(b.scheduledAt);
  const end = new Date(start.getTime() + (b.durationMinutes ?? 60) * 60000);
  const who = [b.hostName, b.bookerName].filter(Boolean).join(" and ");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Elkdonis Arts Collective//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:booking-${b.id}@arts-collective.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeText(b.title)}`,
    ...(who ? [`DESCRIPTION:${escapeText(who)}`] : []),
    ...(b.url ? [`URL:${b.url}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

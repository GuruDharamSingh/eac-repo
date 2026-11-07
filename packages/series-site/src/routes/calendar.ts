import { NextRequest, NextResponse } from "next/server";
import { getSeriesBySlug } from "../lib/series";
import type { SeriesSite } from "../config";

/** A monthly series keeps its place in the month: `;BYDAY=1SA` for the first Saturday. */
function monthlyByDay(series: { recurrencePattern: string | null; scheduledAt: string | null; timeZone: string | null }): string {
  if (series.recurrencePattern !== "MONTHLY" || !series.scheduledAt) return "";
  const at = new Date(series.scheduledAt);
  const zone = series.timeZone ?? "UTC";
  const day = Number(at.toLocaleDateString("en-US", { timeZone: zone, day: "numeric" }));
  const weekday = at.toLocaleDateString("en-US", { timeZone: zone, weekday: "short" }).slice(0, 2).toUpperCase();
  return `;BYDAY=${Math.min(4, Math.ceil(day / 7))}${weekday}`;
}

export function calendarRoutes(site: SeriesSite) {

/**
 * One week of a series as a calendar file (`?at=<ISO>`), or the whole
 * recurring series without `at`. A single week is a plain UTC instant. The
 * whole series is written in the series' own zone (`DTSTART;TZID=…`) when it
 * has one, so a calendar app repeats it at the same local time across
 * daylight-saving changes, as the series itself does (2026-10-10); a UTC
 * DTSTART with a weekly RRULE drifts by an hour after the change.
 */

function ics(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
/** "20261012T180000": the wall clock in `zone`, for DTSTART;TZID=. */
function icsLocal(date: Date, zone: string): string {
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date)) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  return `${p.year}${p.month}${p.day}T${p.hour === "24" ? "00" : p.hour}${p.minute}${p.second}`;
}
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const series = await getSeriesBySlug(site, slug, { count: 12 });
  if (!series || !series.scheduledAt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const at = request.nextUrl.searchParams.get("at");
  const session = at ? series.sessions.find((s) => s.at === new Date(at).toISOString()) : null;
  const start = session ? new Date(session.at) : new Date(series.scheduledAt);
  const end = new Date(start.getTime() + (series.durationMinutes ?? 60) * 60_000);
  const url = `https://${site.domain}/series/${series.slug}`;
  const title = session?.title ? `${series.title} · ${session.title}` : series.title;
  const description = [session?.summary ?? series.excerpt ?? "", "", url].join("\n").trim();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//Elkdonis Arts Collective//${site.shortName}//EN`,
    "BEGIN:VEVENT",
    `UID:${series.id}${session ? `-${ics(start)}` : ""}@${site.domain}`,
    `DTSTAMP:${ics(new Date())}`,
    ...(!session && series.timeZone
      ? [`DTSTART;TZID=${series.timeZone}:${icsLocal(start, series.timeZone)}`, `DTEND;TZID=${series.timeZone}:${icsLocal(end, series.timeZone)}`]
      : [`DTSTART:${ics(start)}`, `DTEND:${ics(end)}`]),
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(description)}`,
    `URL:${url}`,
    // Public and unauthenticated: never the join link, meeting ID or
    // passcode. Online, the location is the series page, where a signed-in
    // member finds the link; in person, the venue.
    `LOCATION:${esc(series.format === "in_person" && series.location ? series.location : url)}`,
    ...(!session && series.recurrencePattern && series.recurrencePattern !== "CUSTOM"
      ? [
          `RRULE:FREQ=${series.recurrencePattern}${monthlyByDay(series)}${
            series.recurrencePattern === "WEEKLY" && (series.schedule?.intervalWeeks ?? 1) > 1 ? `;INTERVAL=${series.schedule!.intervalWeeks}` : ""
          }${series.recurrenceUntil ? `;UNTIL=${ics(new Date(series.recurrenceUntil))}` : ""}`,
        ]
      : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${series.slug}${session ? `-session-${session.number}` : ""}.ics"`,
    },
  });
}

  return { GET };
}

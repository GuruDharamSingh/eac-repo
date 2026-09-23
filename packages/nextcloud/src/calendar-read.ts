import axios from 'axios';
import type { NextcloudClient } from './client';

// ============================================================================
// Reading a calendar BACK from Nextcloud.
//
// The package could write events (calendar.ts) but never read them: its
// `getCalendarEvents` was a stub returning []. That is why nothing a person
// added in Nextcloud ever reached a hub. This is the real read.
//
// Two REPORTs per call, deliberately:
//
//   1. an EXPANDED calendar-query — Nextcloud (sabre/dav) returns every
//      occurrence inside the window as its own VEVENT with a UTC DTSTART. The
//      server does the recurrence and timezone arithmetic, so this file never
//      has to interpret a TZID or a VTIMEZONE block.
//   2. the same query UNexpanded — the stored object as the person wrote it,
//      for what the expansion throws away: the RRULE itself and LAST-MODIFIED,
//      which is what lets a sync decide which side changed last.
//
// Both are keyed by UID and merged into one CalendarObject per event.
// ============================================================================

export interface CalendarInstance {
  start: Date;
  end: Date;
}

export interface CalendarObject {
  uid: string;
  /** The object's own URL — delete or overwrite THIS, not a guessed name. */
  href: string;
  etag: string | null;
  summary: string;
  description: string | null;
  location: string | null;
  url: string | null;
  /** The raw RRULE value, e.g. "FREQ=WEEKLY;UNTIL=20261231T000000Z". */
  rrule: string | null;
  status: string | null;
  /** When it was last changed in Nextcloud, if the client recorded it. */
  lastModified: Date | null;
  /** A date-only (all-day) event. */
  allDay: boolean;
  /** Occurrences inside the window, in UTC, earliest first. */
  instances: CalendarInstance[];
}

function calendarUrl(client: NextcloudClient, calendarName: string): string {
  return (
    `${client.config.baseUrl}/remote.php/dav/calendars/` +
    `${encodeURIComponent(client.config.username)}/${encodeURIComponent(calendarName)}/`
  );
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function reportBody(from: Date, to: Date, expand: boolean): string {
  const data = expand
    ? `<c:calendar-data><c:expand start="${stamp(from)}" end="${stamp(to)}"/></c:calendar-data>`
    : `<c:calendar-data/>`;
  return `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><d:getetag/>${data}</d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${stamp(from)}" end="${stamp(to)}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;
}

async function report(
  client: NextcloudClient,
  calendarName: string,
  from: Date,
  to: Date,
  expand: boolean
): Promise<Array<{ href: string; etag: string | null; ics: string }>> {
  const res = await axios.request<string>({
    method: 'REPORT',
    url: calendarUrl(client, calendarName),
    data: reportBody(from, to, expand),
    auth: { username: client.config.username, password: client.config.password },
    headers: { 'Content-Type': 'application/xml; charset=utf-8', Depth: '1' },
    responseType: 'text',
    transformResponse: (x) => x,
    timeout: 20_000,
  });
  const xml = String(res.data ?? '');
  const out: Array<{ href: string; etag: string | null; ics: string }> = [];
  // Namespace prefixes differ between servers (d:, D:, cal:, C:) — match any.
  const responses = xml.match(/<(?:[A-Za-z]+:)?response\b[\s\S]*?<\/(?:[A-Za-z]+:)?response>/g) ?? [];
  for (const r of responses) {
    const href = r.match(/<(?:[A-Za-z]+:)?href>([\s\S]*?)<\/(?:[A-Za-z]+:)?href>/)?.[1]?.trim();
    const data = r.match(/<(?:[A-Za-z]+:)?calendar-data[^>]*>([\s\S]*?)<\/(?:[A-Za-z]+:)?calendar-data>/)?.[1];
    if (!href || !data) continue;
    const etag = r.match(/<(?:[A-Za-z]+:)?getetag>([\s\S]*?)<\/(?:[A-Za-z]+:)?getetag>/)?.[1]?.trim() ?? null;
    out.push({ href: xmlUnescape(href), etag: etag ? xmlUnescape(etag) : null, ics: xmlUnescape(data) });
  }
  return out;
}

function xmlUnescape(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#13;/g, '\r')
    .replace(/&#10;/g, '\n')
    .replace(/&amp;/g, '&');
}

// ── ICS parsing (just enough of RFC 5545) ───────────────────────────────────

interface IcsProp {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** Unfold continuation lines (a leading space or tab continues the line above). */
function unfold(ics: string): string[] {
  return ics.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
}

function parseLine(line: string): IcsProp | null {
  const colon = line.indexOf(':');
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = head.split(';');
  const params: Record<string, string> = {};
  for (const p of paramParts) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value };
}

function unescapeText(v: string): string {
  return v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

/** VEVENT blocks as property lists. VTIMEZONE and VALARM content is skipped. */
function vevents(ics: string): IcsProp[][] {
  const events: IcsProp[][] = [];
  let current: IcsProp[] | null = null;
  let nested = 0; // inside a VALARM within the event
  for (const line of unfold(ics)) {
    if (line === 'BEGIN:VEVENT') {
      current = [];
      nested = 0;
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    if (line.startsWith('BEGIN:')) nested++;
    else if (line.startsWith('END:')) nested = Math.max(0, nested - 1);
    else if (nested === 0) {
      const p = parseLine(line);
      if (p) current.push(p);
    }
  }
  return events;
}

/**
 * A UTC or date-only value. Expanded instances are always UTC ("…Z"), which
 * is why this file needs no timezone table; a floating or TZID time is only
 * ever read from a master, where it is not used for scheduling.
 */
function parseUtc(value: string): Date | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = '00', mi = '00', s = '00'] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
}

function prop(props: IcsProp[], name: string): IcsProp | undefined {
  return props.find((p) => p.name === name);
}

/**
 * Every event in `calendarName` with an occurrence between `from` and `to`.
 *
 * Throws on a transport failure — a sync must be able to tell "the calendar
 * is empty" from "Nextcloud did not answer", or it will read an outage as
 * "everything was deleted".
 */
export async function listCalendarObjects(
  client: NextcloudClient,
  calendarName: string,
  from: Date,
  to: Date
): Promise<CalendarObject[]> {
  const [expanded, masters] = await Promise.all([
    report(client, calendarName, from, to, true),
    report(client, calendarName, from, to, false),
  ]);

  const byUid = new Map<string, CalendarObject>();

  for (const m of masters) {
    for (const ev of vevents(m.ics)) {
      // An overridden single occurrence (RECURRENCE-ID) belongs to its series.
      if (prop(ev, 'RECURRENCE-ID')) continue;
      const uid = prop(ev, 'UID')?.value;
      if (!uid || byUid.has(uid)) continue;
      const dtstart = prop(ev, 'DTSTART');
      byUid.set(uid, {
        uid,
        href: m.href,
        etag: m.etag,
        summary: unescapeText(prop(ev, 'SUMMARY')?.value ?? '(untitled)'),
        description: prop(ev, 'DESCRIPTION') ? unescapeText(prop(ev, 'DESCRIPTION')!.value) : null,
        location: prop(ev, 'LOCATION') ? unescapeText(prop(ev, 'LOCATION')!.value) : null,
        url: prop(ev, 'URL')?.value ?? null,
        rrule: prop(ev, 'RRULE')?.value ?? null,
        status: prop(ev, 'STATUS')?.value ?? null,
        lastModified: parseUtc(prop(ev, 'LAST-MODIFIED')?.value ?? prop(ev, 'DTSTAMP')?.value ?? ''),
        allDay: dtstart?.params.VALUE === 'DATE' || /^\d{8}$/.test(dtstart?.value ?? ''),
        instances: [],
      });
    }
  }

  for (const e of expanded) {
    for (const ev of vevents(e.ics)) {
      const uid = prop(ev, 'UID')?.value;
      const obj = uid ? byUid.get(uid) : undefined;
      if (!obj) continue;
      const start = parseUtc(prop(ev, 'DTSTART')?.value ?? '');
      if (!start) continue;
      const endRaw = prop(ev, 'DTEND')?.value;
      const end = (endRaw && parseUtc(endRaw)) || new Date(start.getTime() + (obj.allDay ? 24 : 1) * 3_600_000);
      obj.instances.push({ start, end });
    }
  }

  for (const obj of byUid.values()) obj.instances.sort((a, b) => a.start.getTime() - b.start.getTime());
  return [...byUid.values()];
}

/** Delete one object by its own href (as returned by listCalendarObjects). */
export async function deleteCalendarObject(client: NextcloudClient, href: string): Promise<void> {
  const base = client.config.baseUrl.replace(/\/$/, '');
  const url = /^https?:\/\//.test(href) ? href : `${base}${href.startsWith('/') ? '' : '/'}${href}`;
  try {
    await axios.delete(url, {
      auth: { username: client.config.username, password: client.config.password },
      timeout: 15_000,
    });
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return; // already gone
    throw err;
  }
}

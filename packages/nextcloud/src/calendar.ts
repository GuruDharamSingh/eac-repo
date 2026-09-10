/**
 * Nextcloud Calendar API (CalDAV)
 *
 * Bidirectional calendar synchronization using CalDAV protocol
 * Syncs EAC meetings to Nextcloud Calendar for mobile/external access
 *
 * Note: This uses a simplified approach with WebDAV/OCS instead of full CalDAV
 * for easier integration. For full CalDAV support, consider tsdav library.
 */

import { NextcloudClient } from './client';
import axios from 'axios';

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: Date;
  end?: Date;
  location?: string;
  attendees?: string[];
  recurrence?: string; // iCalendar RRULE format
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
  organizer?: {
    name: string;
    email: string;
  };
  reminders?: number[]; // Minutes before event
  url?: string; // Meeting URL (e.g., Talk room)
}

export interface CalendarEventResponse extends CalendarEvent {
  id: string;
  etag?: string;
  url?: string;
}

/**
 * Escape a text value for iCalendar (RFC 5545 §3.3.11).
 *
 * Backslash, semicolon, comma and newline are delimiters in the format. An
 * unescaped comma in a title used to split SUMMARY into two values and produce
 * an ICS Nextcloud silently refused to parse.
 */
function escapeICalText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Fold a content line to 75 octets (RFC 5545 §3.1).
 *
 * Long descriptions are common and a single over-length line invalidates the
 * whole VCALENDAR, so this is not optional politeness.
 */
function foldLine(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    // Never split a multi-byte character: walk back to a lead byte.
    let end = Math.min(start + limit, bytes.length);
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    out.push(bytes.subarray(start, end).toString('utf8'));
    start = end;
    limit = 74; // continuation lines carry a leading space
  }
  return out.join('\r\n ');
}

/**
 * Convert CalendarEvent to iCalendar format (RFC 5545)
 */
function eventToICalendar(event: CalendarEvent): string {
  const now = new Date();
  const uid = event.id || `${Date.now()}-${Math.random().toString(36).substring(7)}@eac`;
  const dtstamp = formatDate(now);
  const dtstart = formatDate(event.start);
  const dtend = formatDate(event.end || new Date(event.start.getTime() + 3600000)); // Default 1 hour

  let ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Elkdonis Arts Collective//EAC Meetings//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeICalText(event.summary)}`,
  ];

  if (event.description) {
    ical.push(`DESCRIPTION:${escapeICalText(event.description)}`);
  }

  if (event.location) {
    ical.push(`LOCATION:${escapeICalText(event.location)}`);
  }

  if (event.status) {
    ical.push(`STATUS:${event.status}`);
  }

  if (event.url) {
    ical.push(`URL:${event.url}`);
  }

  if (event.organizer) {
    ical.push(`ORGANIZER;CN=${event.organizer.name}:mailto:${event.organizer.email}`);
  }

  if (event.attendees && event.attendees.length > 0) {
    event.attendees.forEach((attendee) => {
      ical.push(`ATTENDEE:mailto:${attendee}`);
    });
  }

  if (event.recurrence) {
    ical.push(`RRULE:${event.recurrence}`);
  }

  if (event.reminders && event.reminders.length > 0) {
    event.reminders.forEach((minutes) => {
      ical.push('BEGIN:VALARM');
      ical.push('ACTION:DISPLAY');
      ical.push(`TRIGGER:-PT${minutes}M`);
      ical.push('END:VALARM');
    });
  }

  ical.push('END:VEVENT');
  ical.push('END:VCALENDAR');

  return ical.map(foldLine).join('\r\n');
}

/**
 * Format date for iCalendar (YYYYMMDDTHHMMSSZ)
 */
function formatDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Parse iCalendar data to CalendarEvent
 */
function parseICalendar(icalData: string): CalendarEvent {
  const lines = icalData.split(/\r?\n/);
  const event: Partial<CalendarEvent> = {};

  for (const line of lines) {
    const [key, ...valueParts] = line.split(':');
    const value = valueParts.join(':');

    if (key.startsWith('UID')) {
      event.id = value;
    } else if (key.startsWith('SUMMARY')) {
      event.summary = value;
    } else if (key.startsWith('DESCRIPTION')) {
      event.description = value.replace(/\\n/g, '\n');
    } else if (key.startsWith('LOCATION')) {
      event.location = value;
    } else if (key.startsWith('DTSTART')) {
      event.start = parseICalDate(value);
    } else if (key.startsWith('DTEND')) {
      event.end = parseICalDate(value);
    } else if (key.startsWith('STATUS')) {
      event.status = value as 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
    } else if (key.startsWith('URL')) {
      event.url = value;
    } else if (key.startsWith('RRULE')) {
      event.recurrence = value;
    }
  }

  return event as CalendarEvent;
}

/**
 * Parse iCalendar date string
 */
function parseICalDate(dateStr: string): Date {
  // Remove timezone suffix if present
  const cleanDate = dateStr.replace(/Z$/, '');

  // Parse YYYYMMDDTHHMMSS format
  const year = parseInt(cleanDate.substring(0, 4));
  const month = parseInt(cleanDate.substring(4, 6)) - 1;
  const day = parseInt(cleanDate.substring(6, 8));
  const hour = parseInt(cleanDate.substring(9, 11)) || 0;
  const minute = parseInt(cleanDate.substring(11, 13)) || 0;
  const second = parseInt(cleanDate.substring(13, 15)) || 0;

  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

/**
 * Get calendar URL for a user
 */
function getCalendarUrl(
  client: NextcloudClient,
  calendarName: string = 'eac-meetings'
): string {
  // Encode both segments: a calendar uri is org-derived and a username is
  // env-derived, and neither is guaranteed to be URL-safe.
  const url =
    `${client.config.baseUrl}/remote.php/dav/calendars/` +
    `${encodeURIComponent(client.config.username)}/${encodeURIComponent(calendarName)}`;
  console.log(`[Calendar] Generated URL: ${url}`);
  return url;
}

/**
 * Check if a calendar exists
 */
async function calendarExists(
  client: NextcloudClient,
  calendarName: string = 'eac-meetings'
): Promise<boolean> {
  const calendarUrl = getCalendarUrl(client, calendarName);
  console.log(`[Calendar] Checking if calendar exists: ${calendarName}`);
  console.log(`[Calendar] Using credentials for user: ${client.config.username}`);

  try {
    const response = await axios.request({
      method: 'PROPFIND',
      url: calendarUrl,
      auth: {
        username: client.config.username,
        password: client.config.password,
      },
      headers: {
        'Depth': '0',
      },
    });
    console.log(`[Calendar] PROPFIND response status: ${response.status}`);
    return true;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.log(`[Calendar] PROPFIND error status: ${error.response?.status}`);
      if (error.response?.status === 404) {
        console.log(`[Calendar] Calendar does not exist: ${calendarName}`);
        return false;
      }
    }
    console.error(`[Calendar] PROPFIND error:`, error);
    // Other errors should be thrown
    throw error;
  }
}

/** Escape a value for interpolation into a DAV request body. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Create a calendar in Nextcloud using CalDAV MKCALENDAR
 */
async function createCalendar(
  client: NextcloudClient,
  calendarName: string = 'eac-meetings',
  displayName: string = 'EAC Meetings',
  description: string = 'Meetings and gatherings from Elkdonis Arts Collective'
): Promise<void> {
  const calendarUrl = getCalendarUrl(client, calendarName);
  console.log(`[Calendar] Creating calendar: ${calendarName} at ${calendarUrl}`);

  const mkcalendarBody = `<?xml version="1.0" encoding="utf-8" ?>
<C:mkcalendar xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <D:displayname>${escapeXml(displayName)}</D:displayname>
      <C:calendar-description>${escapeXml(description)}</C:calendar-description>
      <C:supported-calendar-component-set>
        <C:comp name="VEVENT"/>
      </C:supported-calendar-component-set>
    </D:prop>
  </D:set>
</C:mkcalendar>`;

  try {
    const response = await axios.request({
      method: 'MKCALENDAR',
      url: calendarUrl,
      auth: {
        username: client.config.username,
        password: client.config.password,
      },
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
      },
      data: mkcalendarBody,
    });
    console.log(`[Calendar] MKCALENDAR response status: ${response.status}`);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      console.log(`[Calendar] MKCALENDAR error status: ${status}`);
      // 405 Method Not Allowed or 409 Conflict might mean calendar already exists
      if (status === 405 || status === 409) {
        console.log(`[Calendar] Calendar may already exist (status ${status}), ignoring`);
        return;
      }
      console.error(`[Calendar] MKCALENDAR error response:`, error.response?.data);
    }
    throw error;
  }
}

/**
 * Ensure calendar exists, create if it doesn't
 */
export async function ensureCalendarExists(
  client: NextcloudClient,
  calendarName: string = 'eac-meetings',
  displayName?: string,
  description?: string
): Promise<void> {
  console.log(`[Calendar] ensureCalendarExists called for: ${calendarName}`);
  console.log(`[Calendar] Base URL: ${client.config.baseUrl}`);
  console.log(`[Calendar] Username: ${client.config.username}`);

  const exists = await calendarExists(client, calendarName);
  console.log(`[Calendar] Calendar exists: ${exists}`);

  if (!exists) {
    console.log(`[Calendar] Creating calendar: ${calendarName}`);
    // Previously called without these, so every per-org calendar provisioned
    // showed up in Nextcloud titled "EAC Meetings" no matter its uri.
    await createCalendar(
      client,
      calendarName,
      displayName ?? calendarName,
      description ?? `Events published by ${displayName ?? calendarName}.`
    );
    console.log(`[Calendar] Calendar created successfully`);
  }
}

/**
 * Create a calendar event in Nextcloud using WebDAV
 */
export async function createCalendarEvent(
  client: NextcloudClient,
  event: CalendarEvent,
  calendarName?: string
): Promise<CalendarEventResponse> {
  const icalData = eventToICalendar(event);
  const uid = event.id || `${Date.now()}-${Math.random().toString(36).substring(7)}@eac`;
  const calendar = calendarName || 'eac-meetings';
  const calendarUrl = getCalendarUrl(client, calendar);
  const eventUrl = `${calendarUrl}/${uid}.ics`;

  console.log(`[Calendar] Creating event: ${event.summary}`);
  console.log(`[Calendar] Event URL: ${eventUrl}`);

  try {
    // Create event using WebDAV PUT
    const response = await axios.put(eventUrl, icalData, {
      auth: {
        username: client.config.username,
        password: client.config.password,
      },
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
      },
    });
    console.log(`[Calendar] Event created, status: ${response.status}`);

    return {
      ...event,
      id: uid,
      url: eventUrl,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[Calendar] Event creation failed, status: ${error.response?.status}`);
      console.error(`[Calendar] Error response:`, error.response?.data);
    }
    throw error;
  }
}

/**
 * Update an existing calendar event
 */
export async function updateCalendarEvent(
  client: NextcloudClient,
  eventId: string,
  updates: Partial<CalendarEvent>,
  calendarName?: string
): Promise<CalendarEventResponse> {
  const calendar = calendarName || 'eac-meetings';
  const calendarUrl = getCalendarUrl(client, calendar);
  const eventUrl = `${calendarUrl}/${eventId}.ics`;

  // Fetch existing event
  const response = await axios.get(eventUrl, {
    auth: {
      username: client.config.username,
      password: client.config.password,
    },
  });

  // Parse existing event and merge updates
  const existingEvent = parseICalendar(response.data);
  const updatedEvent = { ...existingEvent, ...updates, id: eventId };

  // Update event
  const icalData = eventToICalendar(updatedEvent);

  await axios.put(eventUrl, icalData, {
    auth: {
      username: client.config.username,
      password: client.config.password,
    },
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
    },
  });

  return {
    ...updatedEvent,
    id: eventId,
    url: eventUrl,
  };
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(
  client: NextcloudClient,
  eventId: string,
  calendarName?: string
): Promise<void> {
  const calendar = calendarName || 'eac-meetings';
  const calendarUrl = getCalendarUrl(client, calendar);
  const eventUrl = `${calendarUrl}/${eventId}.ics`;

  await axios.delete(eventUrl, {
    auth: {
      username: client.config.username,
      password: client.config.password,
    },
  });
}

/**
 * Get a specific calendar event by ID
 */
export async function getCalendarEvent(
  client: NextcloudClient,
  eventId: string,
  calendarName?: string
): Promise<CalendarEventResponse | null> {
  const calendar = calendarName || 'eac-meetings';
  const calendarUrl = getCalendarUrl(client, calendar);
  const eventUrl = `${calendarUrl}/${eventId}.ics`;

  try {
    const response = await axios.get(eventUrl, {
      auth: {
        username: client.config.username,
        password: client.config.password,
      },
    });

    const event = parseICalendar(response.data);

    return {
      ...event,
      id: eventId,
      url: eventUrl,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Get calendar events within a date range (simplified version)
 * For production, use CalDAV REPORT query
 */
export async function getCalendarEvents(
  client: NextcloudClient,
  startDate: Date,
  endDate: Date,
  calendarName?: string
): Promise<CalendarEventResponse[]> {
  // This is a simplified implementation
  // For full CalDAV query support, use tsdav library
  // For now, we'll return empty array as events are managed via sync
  console.warn('getCalendarEvents: CalDAV REPORT queries not fully implemented');
  return [];
}

/**
 * Sync a meeting to Nextcloud Calendar
 * Helper function for meeting integration
 */
export async function syncMeetingToCalendar(
  client: NextcloudClient,
  meeting: {
    id: string;
    title: string;
    description?: string;
    start_time: Date;
    end_time?: Date;
    location?: string;
    meeting_url?: string;
    duration_minutes?: number;
  }
): Promise<string> {
  // Ensure the calendar exists before creating the event
  await ensureCalendarExists(client);

  const event: CalendarEvent = {
    id: `meeting-${meeting.id}`,
    summary: meeting.title,
    description: meeting.description,
    start: meeting.start_time,
    end: meeting.end_time || new Date(
      meeting.start_time.getTime() + (meeting.duration_minutes || 60) * 60000
    ),
    location: meeting.location,
    url: meeting.meeting_url,
    status: 'CONFIRMED',
  };

  const response = await createCalendarEvent(client, event);
  return response.id;
}

/**
 * Update a synced meeting in calendar
 */
export async function updateMeetingInCalendar(
  client: NextcloudClient,
  eventId: string,
  meeting: {
    title?: string;
    description?: string;
    start_time?: Date;
    end_time?: Date;
    location?: string;
    meeting_url?: string;
  }
): Promise<void> {
  const updates: Partial<CalendarEvent> = {
    summary: meeting.title,
    description: meeting.description,
    start: meeting.start_time,
    end: meeting.end_time,
    location: meeting.location,
    url: meeting.meeting_url,
  };

  // Remove undefined fields
  Object.keys(updates).forEach((key) => {
    if (updates[key as keyof CalendarEvent] === undefined) {
      delete updates[key as keyof CalendarEvent];
    }
  });

  await updateCalendarEvent(client, eventId, updates);
}

// ─── Calendar sharing ────────────────────────────────────────────────────────
//
// This did not exist. The OCS `files_sharing` API in shares.ts cannot do it —
// a CalDAV collection is not a file — so calendars were provisioned and then
// visible to nobody but the service account.
//
// Live-tested against Nextcloud 33 / calendar 6.5.3 on 2026-09-07, verifying
// every result in `oc_dav_shares` rather than trusting the status code:
//
//   principal:principals/users/<uid>     → 200, persisted
//   principal:principals/groups/<gid>    → 200, persisted
//   principal:principals/circles/<id>    → 200, PERSISTED NOTHING
//
// A Circle cannot receive a calendar share, and the silent success is the trap:
// every variant returns 200. Callers must therefore fan out per user principal
// and treat their own database as the membership authority — see
// packages/services/src/org-calendar.ts.

/** Principal href for a Nextcloud user. */
function userPrincipal(uid: string): string {
  return `principal:principals/users/${uid}`;
}

/**
 * Share a calendar with one Nextcloud user.
 *
 * `readWrite` sends the documented element, BUT on this instance it makes no
 * difference: tested 2026-09-07, every variant — `<o:read/>`, `<o:read-write/>`,
 * and omitting the element entirely — lands as `access = 3` (read-write) in
 * `oc_dav_shares`. Read-only shares exist there (access 2) but are not
 * reachable through this endpoint, so callers must NOT rely on a share being
 * read-only. The parameter is kept because it is the correct wire form and a
 * future Nextcloud may honour it.
 *
 * The consequence for a projected calendar: a member CAN edit the mirror, and
 * their edit will be overwritten the next time the source thread is pushed.
 * Say so in the UI rather than pretending the calendar is locked.
 */
export async function shareCalendarWithUser(
  client: NextcloudClient,
  calendarName: string,
  uid: string,
  readWrite = false
): Promise<void> {
  const body = `<?xml version="1.0" encoding="utf-8" ?>
<o:share xmlns:D="DAV:" xmlns:o="http://owncloud.org/ns">
  <o:set>
    <D:href>${escapeXml(userPrincipal(uid))}</D:href>
    <o:${readWrite ? 'read-write' : 'read'}/>
  </o:set>
</o:share>`;

  await axios.request({
    method: 'POST',
    url: getCalendarUrl(client, calendarName),
    auth: { username: client.config.username, password: client.config.password },
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    data: body,
  });
}

/** Remove one user's share of a calendar. */
export async function unshareCalendarWithUser(
  client: NextcloudClient,
  calendarName: string,
  uid: string
): Promise<void> {
  const body = `<?xml version="1.0" encoding="utf-8" ?>
<o:share xmlns:D="DAV:" xmlns:o="http://owncloud.org/ns">
  <o:remove>
    <D:href>${escapeXml(userPrincipal(uid))}</D:href>
  </o:remove>
</o:share>`;

  await axios.request({
    method: 'POST',
    url: getCalendarUrl(client, calendarName),
    auth: { username: client.config.username, password: client.config.password },
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    data: body,
  });
}

/**
 * The uids a calendar is currently shared with.
 *
 * Needed to reconcile rather than blindly re-share: without a read there is no
 * way to revoke access for someone who left the org.
 */
export async function listCalendarShares(
  client: NextcloudClient,
  calendarName: string
): Promise<string[]> {
  const body = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:oc="http://owncloud.org/ns">
  <D:prop><oc:invite/></D:prop>
</D:propfind>`;

  try {
    const response = await axios.request<string>({
      method: 'PROPFIND',
      url: getCalendarUrl(client, calendarName),
      auth: { username: client.config.username, password: client.config.password },
      headers: { Depth: '0', 'Content-Type': 'application/xml; charset=utf-8' },
      data: body,
      responseType: 'text',
    });

    const uids = new Set<string>();
    // Hrefs come back as `principal:principals/users/<uid>`; anything else
    // (groups, and the calendar owner's own href) is not ours to reconcile.
    const re = /principal:principals\/users\/([^<\s]+)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(response.data ?? '')) !== null) {
      uids.add(decodeURIComponent(match[1]));
    }
    return [...uids];
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return [];
    throw error;
  }
}

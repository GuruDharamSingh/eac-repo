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
    `SUMMARY:${event.summary}`,
  ];

  if (event.description) {
    ical.push(`DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`);
  }

  if (event.location) {
    ical.push(`LOCATION:${event.location}`);
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

  return ical.join('\r\n');
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
  const url = `${client.config.baseUrl}/remote.php/dav/calendars/${client.config.username}/${calendarName}`;
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
      <D:displayname>${displayName}</D:displayname>
      <C:calendar-description>${description}</C:calendar-description>
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
  calendarName: string = 'eac-meetings'
): Promise<void> {
  console.log(`[Calendar] ensureCalendarExists called for: ${calendarName}`);
  console.log(`[Calendar] Base URL: ${client.config.baseUrl}`);
  console.log(`[Calendar] Username: ${client.config.username}`);

  const exists = await calendarExists(client, calendarName);
  console.log(`[Calendar] Calendar exists: ${exists}`);

  if (!exists) {
    console.log(`[Calendar] Creating calendar: ${calendarName}`);
    await createCalendar(client, calendarName);
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

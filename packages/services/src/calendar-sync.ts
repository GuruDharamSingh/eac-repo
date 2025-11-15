/**
 * Calendar Sync Service
 *
 * Bidirectional synchronization between EAC meetings and Nextcloud Calendar
 * - Push: EAC meeting → Nextcloud Calendar
 * - Pull: Nextcloud Calendar → EAC meeting (via webhooks)
 */

import { db } from '@elkdonis/db';
import {
  createNextcloudClient,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvent,
  syncMeetingToCalendar as syncToCalendar,
  updateMeetingInCalendar,
  type NextcloudClient,
} from '@elkdonis/nextcloud';
import { nanoid } from 'nanoid';

export interface MeetingForSync {
  id: string;
  title: string;
  description?: string;
  scheduled_at: Date;
  duration_minutes?: number;
  location?: string;
  meeting_url?: string;
  nextcloud_calendar_event_id?: string;
  nextcloud_calendar_synced?: boolean;
}

/**
 * Sync a meeting to Nextcloud Calendar
 * Creates or updates the calendar event
 */
export async function syncMeetingToNextcloud(
  meetingId: string,
  userClient: NextcloudClient
): Promise<string> {
  // Fetch meeting from database
  const [meeting] = await db`
    SELECT
      id, title, description, scheduled_at,
      duration_minutes, location, meeting_url,
      nextcloud_calendar_event_id, nextcloud_calendar_synced
    FROM meetings
    WHERE id = ${meetingId}
  ` as MeetingForSync[];

  if (!meeting) {
    throw new Error(`Meeting not found: ${meetingId}`);
  }

  let eventId: string;

  // Prepare meeting data with start_time expected by Nextcloud calendar function
  const meetingForCalendar = {
    id: meeting.id,
    title: meeting.title,
    description: meeting.description,
    start_time: meeting.scheduled_at,
    end_time: meeting.duration_minutes
      ? new Date(meeting.scheduled_at.getTime() + meeting.duration_minutes * 60000)
      : undefined,
    duration_minutes: meeting.duration_minutes,
    location: meeting.location,
    meeting_url: meeting.meeting_url,
  };

  if (meeting.nextcloud_calendar_event_id && meeting.nextcloud_calendar_synced) {
    // Update existing event
    try {
      await updateMeetingInCalendar(userClient, meeting.nextcloud_calendar_event_id, meetingForCalendar);
      eventId = meeting.nextcloud_calendar_event_id;
    } catch (error) {
      console.error('Failed to update calendar event, recreating:', error);
      // If update fails, try creating new event
      eventId = await syncToCalendar(userClient, meetingForCalendar);
    }
  } else {
    // Create new event
    eventId = await syncToCalendar(userClient, meetingForCalendar);
  }

  // Update meeting record
  await db`
    UPDATE meetings
    SET
      nextcloud_calendar_event_id = ${eventId},
      nextcloud_calendar_synced = true,
      nextcloud_last_sync = NOW(),
      updated_at = NOW()
    WHERE id = ${meetingId}
  `;

  return eventId;
}

/**
 * Delete calendar event when meeting is deleted
 */
export async function deleteMeetingFromCalendar(
  meetingId: string,
  userClient: NextcloudClient
): Promise<void> {
  // Fetch meeting to get event ID
  const [meeting] = await db`
    SELECT nextcloud_calendar_event_id
    FROM meetings
    WHERE id = ${meetingId}
  `;

  if (!meeting?.nextcloud_calendar_event_id) {
    // No calendar event to delete
    return;
  }

  try {
    await deleteCalendarEvent(userClient, meeting.nextcloud_calendar_event_id);
  } catch (error) {
    console.error('Failed to delete calendar event:', error);
    // Continue anyway - meeting is being deleted
  }
}

/**
 * Sync calendar event changes from Nextcloud back to EAC
 * Called by webhook when calendar event is updated
 */
export async function syncCalendarEventToMeeting(
  eventId: string,
  userClient: NextcloudClient
): Promise<void> {
  // Fetch event from Nextcloud
  const event = await getCalendarEvent(userClient, eventId);

  if (!event) {
    // Event was deleted in Nextcloud
    // Find corresponding meeting and mark as cancelled
    await db`
      UPDATE meetings
      SET
        status = 'cancelled',
        nextcloud_calendar_synced = false,
        updated_at = NOW()
      WHERE nextcloud_calendar_event_id = ${eventId}
    `;
    return;
  }

  // Find corresponding meeting
  const [meeting] = await db`
    SELECT id, title, scheduled_at, duration_minutes, location, meeting_url
    FROM meetings
    WHERE nextcloud_calendar_event_id = ${eventId}
  `;

  if (!meeting) {
    // No corresponding meeting - event was created externally in Nextcloud
    // Could optionally create a new meeting here
    console.warn(`No meeting found for calendar event: ${eventId}`);
    return;
  }

  // Calculate duration from calendar event if end time is provided
  let durationMinutes = meeting.duration_minutes;
  if (event.start && event.end) {
    durationMinutes = Math.round((event.end.getTime() - event.start.getTime()) / 60000);
  }

  // Check if event has actually changed
  const hasChanges =
    meeting.title !== event.summary ||
    meeting.scheduled_at?.getTime() !== event.start?.getTime() ||
    meeting.duration_minutes !== durationMinutes ||
    meeting.location !== event.location ||
    meeting.meeting_url !== event.url;

  if (!hasChanges) {
    // No changes, just update sync timestamp
    await db`
      UPDATE meetings
      SET nextcloud_last_sync = NOW()
      WHERE id = ${meeting.id}
    `;
    return;
  }

  // Update meeting with calendar changes
  await db`
    UPDATE meetings
    SET
      title = ${event.summary},
      description = ${event.description || meeting.description},
      scheduled_at = ${event.start},
      duration_minutes = ${durationMinutes},
      location = ${event.location || meeting.location},
      meeting_url = ${event.url || meeting.meeting_url},
      nextcloud_last_sync = NOW(),
      updated_at = NOW()
    WHERE id = ${meeting.id}
  `;

  // Log the sync event
  await db`
    INSERT INTO events (id, action, user_id, resource_type, resource_id, metadata)
    VALUES (
      ${nanoid()},
      'calendar_sync_from_nextcloud',
      NULL,
      'meeting',
      ${meeting.id},
      ${JSON.stringify({
        event_id: eventId,
        changes: ['title', 'start_time', 'end_time', 'location', 'url'],
      })}::jsonb
    )
  `;
}

/**
 * Handle Nextcloud calendar webhook event
 * Processes calendar change notifications
 */
export async function handleCalendarWebhook(
  eventData: {
    event_type: string; // 'calendar.event.created', 'calendar.event.updated', 'calendar.event.deleted'
    event_id: string;
    calendar_id?: string;
    user_id?: string;
  },
  userClient: NextcloudClient
): Promise<void> {
  const { event_type, event_id } = eventData;

  // Store webhook event for processing
  await db`
    INSERT INTO nextcloud_events (id, event_type, nextcloud_id, resource_type, data)
    VALUES (
      ${nanoid()},
      ${event_type},
      ${event_id},
      'calendar_event',
      ${JSON.stringify(eventData)}::jsonb
    )
  `;

  // Process the event
  switch (event_type) {
    case 'calendar.event.created':
    case 'calendar.event.updated':
      await syncCalendarEventToMeeting(event_id, userClient);
      break;

    case 'calendar.event.deleted':
      // Mark corresponding meeting as cancelled
      await db`
        UPDATE meetings
        SET
          status = 'cancelled',
          nextcloud_calendar_synced = false,
          updated_at = NOW()
        WHERE nextcloud_calendar_event_id = ${event_id}
      `;
      break;

    default:
      console.warn(`Unknown calendar event type: ${event_type}`);
  }

  // Mark event as processed
  await db`
    UPDATE nextcloud_events
    SET processed = true, processed_at = NOW()
    WHERE nextcloud_id = ${event_id}
      AND event_type = ${event_type}
  `;
}

/**
 * Bulk sync all unsynced meetings for an organization
 * Useful for initial sync or recovery
 */
export async function syncAllMeetingsForOrg(
  orgId: string,
  userClient: NextcloudClient
): Promise<{ synced: number; failed: string[] }> {
  // Get all unsynced or out-of-sync meetings
  const meetings = await db`
    SELECT id
    FROM meetings
    WHERE org_id = ${orgId}
      AND status IN ('scheduled', 'published')
      AND (
        nextcloud_calendar_synced = false
        OR nextcloud_last_sync IS NULL
        OR nextcloud_last_sync < updated_at
      )
  `;

  let synced = 0;
  const failed: string[] = [];

  for (const meeting of meetings) {
    try {
      await syncMeetingToNextcloud(meeting.id, userClient);
      synced++;
    } catch (error) {
      console.error(`Failed to sync meeting ${meeting.id}:`, error);
      failed.push(meeting.id);
    }
  }

  return { synced, failed };
}

/**
 * Get sync status for a meeting
 */
export async function getMeetingSyncStatus(
  meetingId: string
): Promise<{
  synced: boolean;
  lastSync?: Date;
  eventId?: string;
  needsSync: boolean;
}> {
  const [meeting] = await db`
    SELECT
      nextcloud_calendar_synced,
      nextcloud_last_sync,
      nextcloud_calendar_event_id,
      updated_at
    FROM meetings
    WHERE id = ${meetingId}
  `;

  if (!meeting) {
    throw new Error(`Meeting not found: ${meetingId}`);
  }

  const needsSync =
    !meeting.nextcloud_calendar_synced ||
    !meeting.nextcloud_last_sync ||
    meeting.nextcloud_last_sync < meeting.updated_at;

  return {
    synced: meeting.nextcloud_calendar_synced || false,
    lastSync: meeting.nextcloud_last_sync,
    eventId: meeting.nextcloud_calendar_event_id,
    needsSync,
  };
}

/**
 * Nextcloud Synchronization Service
 *
 * Handles webhook events from Nextcloud and syncs data to PostgreSQL
 * Keeps database up-to-date with Nextcloud state changes
 */

import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';

export interface NextcloudEvent {
  type: string; // 'calendar.created', 'calendar.updated', 'talk.recording_ready', etc.
  nextcloudId: string; // ID in Nextcloud
  resourceType?: string; // 'meeting', 'post', etc.
  resourceId?: string; // Our database ID
  data: Record<string, any>; // Event payload
}

/**
 * Store Nextcloud webhook event for processing
 */
export async function storeNextcloudEvent(event: NextcloudEvent): Promise<string> {
  const eventId = nanoid();

  await db`
    INSERT INTO nextcloud_events (
      id, event_type, nextcloud_id, resource_type, resource_id, data, processed, created_at
    ) VALUES (
      ${eventId}, ${event.type}, ${event.nextcloudId},
      ${event.resourceType || null}, ${event.resourceId || null},
      ${JSON.stringify(event.data)}, false, NOW()
    )
  `;

  return eventId;
}

/**
 * Process a Nextcloud event and sync to database
 */
export async function processNextcloudEvent(eventId: string): Promise<void> {
  const [event] = await db`
    SELECT * FROM nextcloud_events
    WHERE id = ${eventId} AND processed = false
  `;

  if (!event) {
    throw new Error(`Event ${eventId} not found or already processed`);
  }

  try {
    // Route to appropriate handler based on event type
    switch (event.event_type) {
      case 'calendar.created':
        await handleCalendarEventCreated(event);
        break;
      case 'calendar.updated':
        await handleCalendarEventUpdated(event);
        break;
      case 'calendar.deleted':
        await handleCalendarEventDeleted(event);
        break;
      case 'talk.recording_ready':
        await handleTalkRecordingReady(event);
        break;
      default:
        console.warn(`Unknown event type: ${event.event_type}`);
    }

    // Mark event as processed
    await db`
      UPDATE nextcloud_events
      SET processed = true, processed_at = NOW()
      WHERE id = ${eventId}
    `;
  } catch (error) {
    console.error(`Failed to process event ${eventId}:`, error);
    throw error;
  }
}

/**
 * Process all unprocessed events
 */
export async function processUnprocessedEvents(): Promise<number> {
  const events = await db`
    SELECT id FROM nextcloud_events
    WHERE processed = false
    ORDER BY created_at ASC
    LIMIT 100
  `;

  let processed = 0;
  for (const event of events) {
    try {
      await processNextcloudEvent(event.id);
      processed++;
    } catch (error) {
      console.error(`Failed to process event ${event.id}:`, error);
      // Continue with next event
    }
  }

  return processed;
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle calendar event created
 * Sync Nextcloud calendar event to meeting
 */
async function handleCalendarEventCreated(event: any): Promise<void> {
  const { nextcloud_id, resource_id, data } = event;

  if (event.resource_type === 'meeting' && resource_id) {
    await db`
      UPDATE threads
      SET
        nextcloud_calendar_event_id = ${nextcloud_id},
        nextcloud_calendar_synced = true,
        updated_at = NOW()
      WHERE kind = 'meeting' AND id = ${resource_id}
    `;

    console.log(`Linked meeting ${resource_id} to calendar event ${nextcloud_id}`);
  }
}

/**
 * Handle calendar event updated
 * Sync changes from Nextcloud back to meeting
 */
async function handleCalendarEventUpdated(event: any): Promise<void> {
  const { nextcloud_id, data } = event;

  const [meeting] = await db`
    SELECT id FROM threads
    WHERE kind = 'meeting' AND nextcloud_calendar_event_id = ${nextcloud_id}
  `;

  if (meeting && data) {
    // Update meeting with calendar data
    const updates: any = {};

    if (data.title) updates.title = data.title;
    if (data.description) updates.body = data.description;
    if (data.start) updates.scheduled_at = new Date(data.start);
    if (data.location) updates.location = data.location;

    if (Object.keys(updates).length > 0) {
      await db`
        UPDATE threads
        SET ${db(updates, 'title', 'body', 'scheduled_at', 'location')},
            updated_at = NOW()
        WHERE id = ${meeting.id}
      `;

      console.log(`Updated meeting ${meeting.id} from calendar event ${nextcloud_id}`);
    }
  }
}

/**
 * Handle calendar event deleted
 * Mark meeting calendar sync as broken
 */
async function handleCalendarEventDeleted(event: any): Promise<void> {
  const { nextcloud_id } = event;

  await db`
    UPDATE threads
    SET
      nextcloud_calendar_synced = false,
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{calendar_deleted}',
        'true'::jsonb
      ),
      updated_at = NOW()
    WHERE nextcloud_calendar_event_id = ${nextcloud_id}
      AND kind = 'meeting'
  `;

  console.log(`Marked calendar sync broken for event ${nextcloud_id}`);
}

/**
 * Handle Talk recording ready event
 * Link recording file to meeting
 */
async function handleTalkRecordingReady(event: any): Promise<void> {
  const { nextcloud_id, data } = event;

  if (!data.recording_file_id) {
    console.warn('Recording ready event missing file ID');
    return;
  }

  // Find meeting with this Talk token
  const [meeting] = await db`
    SELECT id FROM threads
    WHERE kind = 'meeting' AND nextcloud_talk_token = ${nextcloud_id}
  `;

  if (meeting) {
    await db`
      UPDATE threads
      SET
        nextcloud_recording_id = ${data.recording_file_id},
        video_url = ${data.recording_url || null},
        updated_at = NOW()
      WHERE id = ${meeting.id}
    `;

    console.log(`Linked recording ${data.recording_file_id} to meeting ${meeting.id}`);
  }
}

/**
 * Get event processing stats
 */
export async function getEventStats(): Promise<{
  total: number;
  processed: number;
  pending: number;
  byType: Record<string, number>;
}> {
  const [totalResult] = await db`
    SELECT COUNT(*) as count FROM nextcloud_events
  `;

  const [processedResult] = await db`
    SELECT COUNT(*) as count FROM nextcloud_events WHERE processed = true
  `;

  const [pendingResult] = await db`
    SELECT COUNT(*) as count FROM nextcloud_events WHERE processed = false
  `;

  const byTypeResults = await db`
    SELECT event_type, COUNT(*) as count
    FROM nextcloud_events
    GROUP BY event_type
  `;

  const byType: Record<string, number> = {};
  byTypeResults.forEach((row: any) => {
    byType[row.event_type] = parseInt(row.count);
  });

  return {
    total: parseInt(totalResult.count),
    processed: parseInt(processedResult.count),
    pending: parseInt(pendingResult.count),
    byType,
  };
}

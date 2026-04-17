import { db } from '@elkdonis/db';
import type { Meeting, MeetingVisibility } from '@elkdonis/types';
import { slugify } from '@elkdonis/utils';

interface CreateMeetingData {
  title: string;
  slug?: string;
  orgId: string;
  guideId?: string;
  description?: string;
  scheduledAt?: string;
  durationMinutes?: number;
  location?: string;
  isOnline?: boolean;
  meetingUrl?: string;
  visibility?: MeetingVisibility;
  notes?: string;
  maxAttendees?: number;
  isRSVPEnabled?: boolean;
  showInLiveFeed?: boolean;
}

/**
 * Create a new meeting (thread with kind='meeting')
 */
export async function createMeeting(data: CreateMeetingData): Promise<Meeting> {
  const slug = data.slug || slugify(data.title);

  const [meeting] = await db`
    INSERT INTO threads (
      kind,
      title,
      slug,
      org_id,
      author_id,
      body,
      scheduled_at,
      duration_minutes,
      location,
      is_online,
      meeting_url,
      visibility,
      attendee_limit,
      is_rsvp_enabled,
      show_in_live_feed,
      status,
      published_at
    ) VALUES (
      'meeting',
      ${data.title},
      ${slug},
      ${data.orgId},
      ${data.guideId || null},
      ${data.description || null},
      ${data.scheduledAt || null},
      ${data.durationMinutes || 60},
      ${data.location || null},
      ${data.isOnline || false},
      ${data.meetingUrl || null},
      ${data.visibility || 'org'},
      ${data.maxAttendees || null},
      ${data.isRSVPEnabled || false},
      ${data.showInLiveFeed || false},
      'published',
      NOW()
    )
    RETURNING *, body AS description, author_id AS guide_id
  `;

  return mapMeetingFromDb(meeting);
}

/**
 * Get meetings by organization
 */
export async function getMeetingsByOrg(
  orgId: string,
  limit = 50
): Promise<Meeting[]> {
  const meetings = await db`
    SELECT t.*, t.body AS description, t.author_id AS guide_id,
           u.display_name as guide_name
    FROM threads t
    LEFT JOIN users u ON t.author_id = u.id
    WHERE t.kind = 'meeting'
      AND t.org_id = ${orgId}
      AND t.status = 'published'
    ORDER BY t.scheduled_at DESC NULLS LAST, t.created_at DESC
    LIMIT ${limit}
  `;

  return meetings.map(mapMeetingFromDb);
}

/**
 * Get upcoming meetings
 */
export async function getUpcomingMeetings(
  orgId?: string,
  limit = 20
): Promise<Meeting[]> {
  const query = orgId
    ? db`
        SELECT t.*, t.body AS description, t.author_id AS guide_id,
               u.display_name as guide_name
        FROM threads t
        LEFT JOIN users u ON t.author_id = u.id
        WHERE t.kind = 'meeting'
          AND t.org_id = ${orgId}
          AND t.status = 'published'
          AND t.scheduled_at > NOW()
        ORDER BY t.scheduled_at ASC
        LIMIT ${limit}
      `
    : db`
        SELECT t.*, t.body AS description, t.author_id AS guide_id,
               u.display_name as guide_name
        FROM threads t
        LEFT JOIN users u ON t.author_id = u.id
        WHERE t.kind = 'meeting'
          AND t.status = 'published'
          AND t.scheduled_at > NOW()
        ORDER BY t.scheduled_at ASC
        LIMIT ${limit}
      `;

  const meetings = await query;
  return meetings.map(mapMeetingFromDb);
}

/**
 * Update a meeting
 */
export async function updateMeeting(
  id: string,
  data: Partial<CreateMeetingData>
): Promise<Meeting> {
  const updates: any = {};

  if (data.title !== undefined) updates.title = data.title;
  if (data.slug !== undefined) updates.slug = data.slug;
  if (data.description !== undefined) updates.body = data.description;
  if (data.scheduledAt !== undefined) updates.scheduled_at = data.scheduledAt;
  if (data.durationMinutes !== undefined) updates.duration_minutes = data.durationMinutes;
  if (data.location !== undefined) updates.location = data.location;
  if (data.isOnline !== undefined) updates.is_online = data.isOnline;
  if (data.meetingUrl !== undefined) updates.meeting_url = data.meetingUrl;
  if (data.visibility !== undefined) updates.visibility = data.visibility;

  const [meeting] = await db`
    UPDATE threads
    SET ${db(updates)}, updated_at = NOW()
    WHERE kind = 'meeting' AND id = ${id}
    RETURNING *, body AS description, author_id AS guide_id
  `;

  return mapMeetingFromDb(meeting);
}

/**
 * Delete a meeting (soft delete)
 */
export async function deleteMeeting(id: string): Promise<void> {
  await db`
    UPDATE threads
    SET status = 'archived', updated_at = NOW()
    WHERE kind = 'meeting' AND id = ${id}
  `;
}

/**
 * Map database row to Meeting type
 */
function mapMeetingFromDb(row: any): Meeting {
  return {
    id: row.id,
    title: row.title,
    description: row.description || row.body || undefined,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : new Date(),
    durationMinutes: row.duration_minutes || undefined,
    orgId: row.org_id,
    createdBy: row.guide_id || row.author_id,
    guideId: row.guide_id || row.author_id,
    videoLink: row.video_link || row.meeting_url || undefined,
    isRSVPEnabled: row.is_rsvp_enabled ?? false,
    isOnline: row.is_online ?? false,
    location: row.location || undefined,
    timeZone: row.time_zone || undefined,
    recurrencePattern: row.recurrence_pattern || 'NONE',
    recurrenceCustomRule: row.recurrence_custom_rule || undefined,
    reminderMinutesBefore: row.reminder_minutes_before || undefined,
    coHostIds: Array.isArray(row.co_host_ids) ? row.co_host_ids : [],
    rsvpDeadline: row.rsvp_deadline || undefined,
    visibility: row.visibility || 'ORGANIZATION',
    autoRecord: row.auto_record ?? false,
    tags: Array.isArray(row.tags) ? row.tags : [],
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    followUpWorkflow: row.follow_up_workflow ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    organization: undefined,
    creator: row.guide_name
      ? {
          id: row.guide_id || row.author_id,
          displayName: row.guide_name,
        } as any
      : undefined,
    attendees: undefined,
  };
}

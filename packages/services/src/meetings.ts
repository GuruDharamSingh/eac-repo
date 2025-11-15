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
}

/**
 * Create a new meeting
 */
export async function createMeeting(data: CreateMeetingData): Promise<Meeting> {
  const slug = data.slug || slugify(data.title);

  const [meeting] = await db`
    INSERT INTO meetings (
      title,
      slug,
      org_id,
      guide_id,
      description,
      scheduled_at,
      duration_minutes,
      location,
      is_online,
      meeting_url,
      visibility,
      notes,
      max_attendees,
      is_rsvp_enabled,
      status
    ) VALUES (
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
      ${data.notes || null},
      ${data.maxAttendees || null},
      ${data.isRSVPEnabled || false},
      'published'
    )
    RETURNING *
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
    SELECT m.*, u.display_name as guide_name
    FROM meetings m
    LEFT JOIN users u ON m.guide_id = u.id
    WHERE m.org_id = ${orgId}
      AND m.status = 'published'
    ORDER BY m.scheduled_at DESC NULLS LAST, m.created_at DESC
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
        SELECT m.*, u.display_name as guide_name
        FROM meetings m
        LEFT JOIN users u ON m.guide_id = u.id
        WHERE m.org_id = ${orgId}
          AND m.status = 'published'
          AND m.scheduled_at > NOW()
        ORDER BY m.scheduled_at ASC
        LIMIT ${limit}
      `
    : db`
        SELECT m.*, u.display_name as guide_name
        FROM meetings m
        LEFT JOIN users u ON m.guide_id = u.id
        WHERE m.status = 'published'
          AND m.scheduled_at > NOW()
        ORDER BY m.scheduled_at ASC
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
  // Build dynamic update query
  const updates: any = {};

  if (data.title !== undefined) updates.title = data.title;
  if (data.slug !== undefined) updates.slug = data.slug;
  if (data.description !== undefined) updates.description = data.description;
  if (data.scheduledAt !== undefined) updates.scheduled_at = data.scheduledAt;
  if (data.durationMinutes !== undefined) updates.duration_minutes = data.durationMinutes;
  if (data.location !== undefined) updates.location = data.location;
  if (data.isOnline !== undefined) updates.is_online = data.isOnline;
  if (data.meetingUrl !== undefined) updates.meeting_url = data.meetingUrl;
  if (data.visibility !== undefined) updates.visibility = data.visibility;
  if (data.notes !== undefined) updates.notes = data.notes;

  const [meeting] = await db`
    UPDATE meetings
    SET ${db(updates)}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  return mapMeetingFromDb(meeting);
}

/**
 * Delete a meeting (soft delete)
 */
export async function deleteMeeting(id: string): Promise<void> {
  await db`
    UPDATE meetings
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = ${id}
  `;
}

/**
 * Map database row to Meeting type
 */
function mapMeetingFromDb(row: any): Meeting {
  return {
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : new Date(),
    durationMinutes: row.duration_minutes || undefined,
    orgId: row.org_id,
    createdBy: row.guide_id,
    guideId: row.guide_id,
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
          id: row.guide_id,
          displayName: row.guide_name,
        } as any
      : undefined,
    attendees: undefined,
  };
}

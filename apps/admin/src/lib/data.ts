import { db } from "@elkdonis/db";
import type {
  Meeting,
  MeetingType,
  MeetingStatus,
  MeetingVisibility,
  MeetingAttendee,
  AttendanceStatus,
  Organization,
  User,
} from "@elkdonis/types";

export interface CreateMeetingParams {
  orgId: string;
  guideId: string;
  title: string;
  slug: string;
  meetingType: MeetingType;
  description?: string;
  scheduledAt?: Date;
  durationMinutes?: number;
  location?: string;
  isOnline?: boolean;
  meetingUrl?: string;
  visibility?: MeetingVisibility;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export async function createMeeting(params: CreateMeetingParams): Promise<Meeting> {
  const [meeting] = await db`
    INSERT INTO threads (
      id, org_id, author_id, kind, title, slug,
      body, scheduled_at, duration_minutes, location,
      is_online, meeting_url, visibility, status, published_at
    ) VALUES (
      ${generateId()}, ${params.orgId}, ${params.guideId}, 'meeting', ${params.title},
      ${params.slug}, ${params.description || null},
      ${params.scheduledAt || null}, ${params.durationMinutes || null},
      ${params.location || null}, ${params.isOnline ?? true},
      ${params.meetingUrl || null}, ${params.visibility || 'org'}, 'draft', NOW()
    )
    RETURNING *, body AS description, author_id AS guide_id
  `;

  return mapMeeting(meeting);
}

export async function getOrganizations(): Promise<Organization[]> {
  const organizations = await db`
    SELECT id, name, slug, type, description, settings, created_at, updated_at
    FROM organizations
    ORDER BY name
  `;

  return organizations.map((org: any) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    type: org.type,
    description: org.description || undefined,
    settings: org.settings,
    createdAt: org.created_at,
    updatedAt: org.updated_at,
  }));
}

export async function getMeetings(): Promise<Meeting[]> {
  const meetings = await db`
    SELECT
      t.*, t.body AS description, t.author_id AS guide_id,
      o.name as org_name,
      u.display_name as guide_name
    FROM threads t
    LEFT JOIN organizations o ON t.org_id = o.id
    LEFT JOIN users u ON t.author_id = u.id
    WHERE t.kind = 'meeting'
    ORDER BY t.scheduled_at DESC NULLS LAST, t.created_at DESC
  `;

  return meetings.map(mapMeeting);
}

export async function getMeetingsByGuide(guideId: string): Promise<Meeting[]> {
  const meetings = await db`
    SELECT
      t.*, t.body AS description, t.author_id AS guide_id,
      o.name as org_name
    FROM threads t
    LEFT JOIN organizations o ON t.org_id = o.id
    WHERE t.kind = 'meeting' AND t.author_id = ${guideId}
    ORDER BY t.scheduled_at DESC NULLS LAST, t.created_at DESC
  `;

  return meetings.map(mapMeeting);
}

export async function getMeetingsByOrg(orgId: string): Promise<Meeting[]> {
  const meetings = await db`
    SELECT
      t.*, t.body AS description, t.author_id AS guide_id,
      u.display_name as guide_name
    FROM threads t
    LEFT JOIN users u ON t.author_id = u.id
    WHERE t.kind = 'meeting' AND t.org_id = ${orgId}
    ORDER BY t.scheduled_at DESC NULLS LAST, t.created_at DESC
  `;

  return meetings.map(mapMeeting);
}

export async function getMeetingsByUser(userId: string): Promise<Meeting[]> {
  // Meetings authored by this user. Cast author_id (UUID) to text so a
  // non-UUID placeholder id resolves to an empty set instead of a parse error.
  const meetings = await db`
    SELECT
      t.*, t.body AS description, t.author_id AS guide_id,
      o.name as org_name,
      u.display_name as guide_name
    FROM threads t
    LEFT JOIN organizations o ON t.org_id = o.id
    LEFT JOIN users u ON t.author_id = u.id
    WHERE t.kind = 'meeting' AND t.author_id::text = ${userId}
    ORDER BY t.scheduled_at DESC NULLS LAST, t.created_at DESC
  `;

  return meetings.map(mapMeeting);
}

export async function getRSVPsByUser(userId: string): Promise<MeetingAttendee[]> {
  // thread_rsvps stores status as yes/no/maybe; map onto the legacy
  // AttendanceStatus shape the dashboard expects. Cast user_id (UUID) to text
  // so a non-UUID placeholder id resolves to an empty set, not a parse error.
  const rows = await db`
    SELECT thread_id, user_id, status, registered_at
    FROM thread_rsvps
    WHERE user_id::text = ${userId}
    ORDER BY registered_at DESC
  `;

  const statusMap: Record<string, AttendanceStatus> = {
    yes: "attended",
    maybe: "registered",
    no: "absent",
  };

  return rows.map((row: any) => ({
    meetingId: row.thread_id,
    userId: row.user_id,
    attendanceStatus: statusMap[row.status] ?? "registered",
    registeredAt: row.registered_at,
  }));
}

export async function getUserById(userId: string): Promise<User | null> {
  const [user] = await db`
    SELECT id, email, display_name, avatar_url, bio, is_admin,
           nextcloud_user_id, created_at, updated_at
    FROM users
    WHERE id = ${userId}
  `;

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name || undefined,
    avatarUrl: user.avatar_url || undefined,
    bio: user.bio || undefined,
    isAdmin: user.is_admin,
    nextcloudUserId: user.nextcloud_user_id || undefined,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

export async function getMeetingById(meetingId: string): Promise<Meeting | null> {
  const [meeting] = await db`
    SELECT 
      t.*, t.body AS description, t.author_id AS guide_id,
      o.name as org_name,
      u.display_name as creator_name
    FROM threads t
    LEFT JOIN organizations o ON t.org_id = o.id
    LEFT JOIN users u ON t.author_id = u.id
    WHERE t.kind = 'meeting' AND t.id = ${meetingId}
  `;

  if (!meeting) return null;

  return mapMeeting(meeting);
}

// Helper functions
function mapMeeting(row: any): Meeting {
  return {
    id: row.id,
    orgId: row.org_id,
    createdBy: row.guide_id,
    guideId: row.guide_id,
    title: row.title,
    slug: row.slug,
    description: row.description || undefined,
    notes: row.notes || undefined,
    startTime: row.scheduled_at || undefined,
    endTime:
      row.scheduled_at && row.duration_minutes
        ? new Date(new Date(row.scheduled_at).getTime() + row.duration_minutes * 60000)
        : undefined,
    timeZone: row.time_zone || undefined,
    durationMinutes: row.duration_minutes || undefined,
    scheduledAt: row.scheduled_at || undefined,
    location: row.location || undefined,
    isOnline: row.is_online ?? true,
    meetingUrl: row.meeting_url || undefined,
    videoUrl: row.video_url || undefined,
    videoLink: row.video_link || undefined,
    recurrencePattern: row.recurrence_pattern || undefined,
    recurrenceCustomRule: row.recurrence_custom_rule || undefined,
    isRSVPEnabled: row.is_rsvp_enabled ?? false,
    rsvpDeadline: row.rsvp_deadline || undefined,
    attendeeLimit: row.attendee_limit || undefined,
    coHostIds: Array.isArray(row.co_host_ids) ? row.co_host_ids : [],
    reminderMinutesBefore: row.reminder_minutes_before || undefined,
    autoRecord: row.auto_record ?? false,
    followUpWorkflow: row.follow_up_workflow ?? false,
    tags: Array.isArray(row.tags) ? row.tags : [],
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    status: row.status,
    visibility: row.visibility,
    nextcloudFileId: row.nextcloud_file_id || undefined,
    nextcloudLastSync: row.nextcloud_last_sync || undefined,
    documentUrl: row.document_url || undefined,
    nextcloudDocumentId: row.nextcloud_file_id || undefined,
    metadata: row.metadata || undefined,
    createdAt: row.created_at,
    publishedAt: row.published_at || undefined,
    updatedAt: row.updated_at,
    viewCount: row.view_count ?? 0,
    replyCount: row.reply_count ?? 0,
    guide: row.guide_name ? { displayName: row.guide_name } : undefined,
    creator: row.guide_name ? { displayName: row.guide_name } : undefined,
  } as Meeting;
}

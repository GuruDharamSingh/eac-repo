whaimport { db } from "@elkdonis/db";
import type {
  Meeting,
  MeetingType,
  MeetingStatus,
  MeetingVisibility,
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

export async function createMeeting(params: CreateMeetingParams): Promise<Meeting> {
  const [meeting] = await db`
    INSERT INTO meetings (
      id, org_id, guide_id, title, slug, meeting_type,
      description, scheduled_at, duration_minutes, location,
      is_online, meeting_url, visibility, status
    ) VALUES (
      ${generateId()}, ${params.orgId}, ${params.guideId}, ${params.title},
      ${params.slug}, ${params.meetingType}, ${params.description || null},
      ${params.scheduledAt || null}, ${params.durationMinutes || null},
      ${params.location || null}, ${params.isOnline ?? true},
      ${params.meetingUrl || null}, ${params.visibility || 'org'}, 'draft'
    )
    RETURNING *
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
      m.*,
      o.name as org_name,
      u.display_name as guide_name
    FROM meetings m
    LEFT JOIN organizations o ON m.org_id = o.id
    LEFT JOIN users u ON m.guide_id = u.id
    ORDER BY m.scheduled_at DESC NULLS LAST, m.created_at DESC
  `;

  return meetings.map(mapMeeting);
}

export async function getMeetingsByGuide(guideId: string): Promise<Meeting[]> {
  const meetings = await db`
    SELECT
      m.*,
      o.name as org_name
    FROM meetings m
    LEFT JOIN organizations o ON m.org_id = o.id
    WHERE m.guide_id = ${guideId}
    ORDER BY m.scheduled_at DESC NULLS LAST, m.created_at DESC
  `;

  return meetings.map(mapMeeting);
}

export async function getMeetingsByOrg(orgId: string): Promise<Meeting[]> {
  const meetings = await db`
    SELECT
      m.*,
      u.display_name as guide_name
    FROM meetings m
    LEFT JOIN users u ON m.guide_id = u.id
    WHERE m.org_id = ${orgId}
    ORDER BY m.scheduled_at DESC NULLS LAST, m.created_at DESC
  `;

  return meetings.map(mapMeeting);
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
      m.*,
      o.name as org_name,
      u.name as creator_name
    FROM meetings m
    LEFT JOIN organizations o ON m.org_id = o.id
    LEFT JOIN users u ON m.created_by = u.id
    WHERE m.id = ${meetingId}
  `;

  if (!meeting) return null;

  return {
    id: meeting.id,
    title: meeting.title,
    description: meeting.description || undefined,
    startTime: meeting.start_time,
    endTime: meeting.end_time || undefined,
    orgId: meeting.org_id,
    createdBy: meeting.created_by,
    visibility: meeting.visibility,
    meetingType: meeting.meeting_type,
    location: meeting.location || undefined,
    createdAt: meeting.created_at,
    updatedAt: meeting.updated_at,
    organization: meeting.org_name ? { name: meeting.org_name } : undefined,
    creator: meeting.creator_name ? { name: meeting.creator_name } : undefined,
  };
}

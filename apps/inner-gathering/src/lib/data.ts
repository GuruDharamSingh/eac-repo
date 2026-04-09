import { db } from "@elkdonis/db";
import type { Meeting, MeetingVisibility, MeetingRecurrence, Post, EventPage, EventPageLayout, EventPageColors, EventPageTableData } from "@elkdonis/types";
import { getQuestionPollsByOrg } from "@elkdonis/services";
import type { QuestionPoll } from "@elkdonis/services";

// Organization ID for InnerGathering
const ORG_ID = 'inner_group';

// Get all meetings, posts, and polls for the feed (filtered by inner_group org)
export async function getFeed() {
  const [meetings, posts, questionPolls] = await Promise.all([
    getMeetings(),
    getPosts(),
    getQuestionPollsByOrg(ORG_ID).catch(() => [] as QuestionPoll[]),
  ]);

  // Combine and sort by created date
  const feedItems = [
    ...meetings.map((m) => ({
      type: "meeting" as const,
      data: m,
      createdAt: m.createdAt,
    })),
    ...posts.map((p) => ({ type: "post" as const, data: p, createdAt: p.createdAt })),
    ...questionPolls.map((p) => ({
      type: "poll" as const,
      data: p,
      createdAt: p.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return feedItems;
}

// Get meetings by date range for inner_group
export async function getMeetingsByDateRange(
  startDate: Date,
  endDate: Date
): Promise<Meeting[]> {
  const meetings = await db`
    SELECT
      m.*,
      m.nextcloud_talk_token,
      u.display_name as guide_name,
      u.avatar_url as guide_avatar,
      (SELECT COUNT(*) FROM meeting_attendees WHERE meeting_id = m.id) as attendee_count,
      EXISTS(SELECT 1 FROM event_pages ep WHERE ep.meeting_id = m.id AND ep.is_published = true) as has_event_page,
      cover_media.id as cover_media_id,
      cover_media.org_id as cover_media_org_id,
      cover_media.uploaded_by as cover_media_uploaded_by,
      cover_media.attached_to_type as cover_media_attached_to_type,
      cover_media.attached_to_id as cover_media_attached_to_id,
      cover_media.nextcloud_file_id as cover_media_nextcloud_file_id,
      cover_media.nextcloud_path as cover_media_nextcloud_path,
      cover_media.url as cover_media_url,
      cover_media.type as cover_media_type,
      cover_media.filename as cover_media_filename,
      cover_media.size_bytes as cover_media_size_bytes,
      cover_media.mime_type as cover_media_mime_type,
      cover_media.caption as cover_media_caption,
      cover_media.alt_text as cover_media_alt_text,
      cover_media.created_at as cover_media_created_at,
      media_list.media_items
    FROM meetings m
    LEFT JOIN users u ON m.guide_id = u.id
    LEFT JOIN LATERAL (
      SELECT
        id,
        org_id,
        uploaded_by,
        attached_to_type,
        attached_to_id,
        nextcloud_file_id,
        nextcloud_path,
        url,
        type,
        filename,
        size_bytes,
        mime_type,
        caption,
        alt_text,
        created_at
      FROM media
      WHERE attached_to_type = 'meeting'
        AND attached_to_id = m.id
        AND type = 'image'
      ORDER BY created_at DESC
      LIMIT 1
    ) cover_media ON TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id', id,
            'orgId', org_id,
            'uploadedBy', uploaded_by,
            'attachedToType', attached_to_type,
            'attachedToId', attached_to_id,
            'nextcloudFileId', nextcloud_file_id,
            'nextcloudPath', nextcloud_path,
            'url', url,
            'type', type,
            'filename', filename,
            'sizeBytes', size_bytes,
            'mimeType', mime_type,
            'caption', caption,
            'altText', alt_text,
            'createdAt', created_at
          ) ORDER BY created_at DESC
        ),
        '[]'::json
      ) AS media_items
      FROM media
      WHERE attached_to_type = 'meeting'
        AND attached_to_id = m.id
    ) media_list ON TRUE
    WHERE m.org_id = ${ORG_ID}
      AND m.status = 'published'
      AND m.scheduled_at >= ${startDate}
      AND m.scheduled_at <= ${endDate}
    ORDER BY m.scheduled_at ASC
  `;

  return meetings.map(mapMeeting);
}

// Get all meetings for inner_group
export async function getMeetings(): Promise<Meeting[]> {
  const meetings = await db`
    SELECT
      m.*,
      m.nextcloud_talk_token,
      u.display_name as guide_name,
      u.avatar_url as guide_avatar,
      (SELECT COUNT(*) FROM meeting_attendees WHERE meeting_id = m.id) as attendee_count,
      EXISTS(SELECT 1 FROM event_pages ep WHERE ep.meeting_id = m.id AND ep.is_published = true) as has_event_page,
      cover_media.id as cover_media_id,
      cover_media.org_id as cover_media_org_id,
      cover_media.uploaded_by as cover_media_uploaded_by,
      cover_media.attached_to_type as cover_media_attached_to_type,
      cover_media.attached_to_id as cover_media_attached_to_id,
      cover_media.nextcloud_file_id as cover_media_nextcloud_file_id,
      cover_media.nextcloud_path as cover_media_nextcloud_path,
      cover_media.url as cover_media_url,
      cover_media.type as cover_media_type,
      cover_media.filename as cover_media_filename,
      cover_media.size_bytes as cover_media_size_bytes,
      cover_media.mime_type as cover_media_mime_type,
      cover_media.caption as cover_media_caption,
      cover_media.alt_text as cover_media_alt_text,
      cover_media.created_at as cover_media_created_at,
      media_list.media_items
    FROM meetings m
    LEFT JOIN users u ON m.guide_id = u.id
    LEFT JOIN LATERAL (
      SELECT
        id,
        org_id,
        uploaded_by,
        attached_to_type,
        attached_to_id,
        nextcloud_file_id,
        nextcloud_path,
        url,
        type,
        filename,
        size_bytes,
        mime_type,
        caption,
        alt_text,
        created_at
      FROM media
      WHERE attached_to_type = 'meeting'
        AND attached_to_id = m.id
        AND type = 'image'
      ORDER BY created_at DESC
      LIMIT 1
    ) cover_media ON TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id', id,
            'orgId', org_id,
            'uploadedBy', uploaded_by,
            'attachedToType', attached_to_type,
            'attachedToId', attached_to_id,
            'nextcloudFileId', nextcloud_file_id,
            'nextcloudPath', nextcloud_path,
            'url', url,
            'type', type,
            'filename', filename,
            'sizeBytes', size_bytes,
            'mimeType', mime_type,
            'caption', caption,
            'altText', alt_text,
            'createdAt', created_at
          ) ORDER BY created_at DESC
        ),
        '[]'::json
      ) AS media_items
      FROM media
      WHERE attached_to_type = 'meeting'
        AND attached_to_id = m.id
    ) media_list ON TRUE
    WHERE m.org_id = ${ORG_ID} AND m.status = 'published'
    ORDER BY m.created_at DESC
    LIMIT 50
  `;

  return meetings.map(mapMeeting);
}

// Get recurring meetings for inner_group (upcoming, with a recurrence pattern)
export async function getRecurringMeetings(): Promise<Meeting[]> {
  const meetings = await db`
    SELECT
      m.*,
      m.nextcloud_talk_token,
      u.display_name as guide_name,
      u.avatar_url as guide_avatar,
      (SELECT COUNT(*) FROM meeting_attendees WHERE meeting_id = m.id) as attendee_count,
      EXISTS(SELECT 1 FROM event_pages ep WHERE ep.meeting_id = m.id AND ep.is_published = true) as has_event_page,
      cover_media.id as cover_media_id,
      cover_media.org_id as cover_media_org_id,
      cover_media.uploaded_by as cover_media_uploaded_by,
      cover_media.attached_to_type as cover_media_attached_to_type,
      cover_media.attached_to_id as cover_media_attached_to_id,
      cover_media.nextcloud_file_id as cover_media_nextcloud_file_id,
      cover_media.nextcloud_path as cover_media_nextcloud_path,
      cover_media.url as cover_media_url,
      cover_media.type as cover_media_type,
      cover_media.filename as cover_media_filename,
      cover_media.size_bytes as cover_media_size_bytes,
      cover_media.mime_type as cover_media_mime_type,
      cover_media.caption as cover_media_caption,
      cover_media.alt_text as cover_media_alt_text,
      cover_media.created_at as cover_media_created_at,
      media_list.media_items
    FROM meetings m
    LEFT JOIN users u ON m.guide_id = u.id
    LEFT JOIN LATERAL (
      SELECT
        id, org_id, uploaded_by, attached_to_type, attached_to_id,
        nextcloud_file_id, nextcloud_path, url, type, filename,
        size_bytes, mime_type, caption, alt_text, created_at
      FROM media
      WHERE attached_to_type = 'meeting'
        AND attached_to_id = m.id
        AND type = 'image'
      ORDER BY created_at DESC
      LIMIT 1
    ) cover_media ON TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id', id, 'orgId', org_id, 'uploadedBy', uploaded_by,
            'attachedToType', attached_to_type, 'attachedToId', attached_to_id,
            'nextcloudFileId', nextcloud_file_id, 'nextcloudPath', nextcloud_path,
            'url', url, 'type', type, 'filename', filename,
            'sizeBytes', size_bytes, 'mimeType', mime_type,
            'caption', caption, 'altText', alt_text, 'createdAt', created_at
          ) ORDER BY created_at DESC
        ),
        '[]'::json
      ) AS media_items
      FROM media
      WHERE attached_to_type = 'meeting'
        AND attached_to_id = m.id
    ) media_list ON TRUE
    WHERE m.org_id = ${ORG_ID}
      AND m.status = 'published'
      AND m.recurrence_pattern IS NOT NULL
      AND m.recurrence_pattern != 'NONE'
    ORDER BY m.scheduled_at ASC
    LIMIT 20
  `;

  return meetings.map(mapMeeting);
}

// Get all posts for inner_group
export async function getPosts(): Promise<Post[]> {
  const posts = await db`
    SELECT
      p.*,
      u.display_name as author_name,
      cover_media.id as cover_media_id,
      cover_media.org_id as cover_media_org_id,
      cover_media.uploaded_by as cover_media_uploaded_by,
      cover_media.attached_to_type as cover_media_attached_to_type,
      cover_media.attached_to_id as cover_media_attached_to_id,
      cover_media.nextcloud_file_id as cover_media_nextcloud_file_id,
      cover_media.nextcloud_path as cover_media_nextcloud_path,
      cover_media.url as cover_media_url,
      cover_media.type as cover_media_type,
      cover_media.filename as cover_media_filename,
      cover_media.size_bytes as cover_media_size_bytes,
      cover_media.mime_type as cover_media_mime_type,
      cover_media.caption as cover_media_caption,
      cover_media.alt_text as cover_media_alt_text,
      cover_media.created_at as cover_media_created_at,
      media_list.media_items
    FROM posts p
    LEFT JOIN users u ON p.author_id = u.id
    LEFT JOIN LATERAL (
      SELECT
        id, org_id, uploaded_by, attached_to_type, attached_to_id,
        nextcloud_file_id, nextcloud_path, url, type, filename,
        size_bytes, mime_type, caption, alt_text, created_at
      FROM media
      WHERE attached_to_type = 'post'
        AND attached_to_id = p.id
        AND type = 'image'
      ORDER BY created_at DESC
      LIMIT 1
    ) cover_media ON TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id', id, 'orgId', org_id, 'uploadedBy', uploaded_by,
            'attachedToType', attached_to_type, 'attachedToId', attached_to_id,
            'nextcloudFileId', nextcloud_file_id, 'nextcloudPath', nextcloud_path,
            'url', url, 'type', type, 'filename', filename,
            'sizeBytes', size_bytes, 'mimeType', mime_type,
            'caption', caption, 'altText', alt_text, 'createdAt', created_at
          ) ORDER BY created_at DESC
        ),
        '[]'::json
      ) AS media_items
      FROM media
      WHERE attached_to_type = 'post' AND attached_to_id = p.id
    ) media_list ON TRUE
    WHERE p.org_id = ${ORG_ID} AND p.status = 'published'
    ORDER BY p.created_at DESC
    LIMIT 50
  `;

  return posts.map(mapPost);
}

// Create a new meeting (only title and time required)
export async function createMeeting(params: {
  userId: string;
  title: string;
  scheduledAt: Date;
  durationMinutes?: number;
  location?: string;
  description?: string;
  visibility?: MeetingVisibility;
  isOnline?: boolean;
  meetingUrl?: string;
  nextcloudDocumentId?: string;
  documentUrl?: string;
  isRSVPEnabled?: boolean;
  rsvpDeadline?: Date;
  minAttendees?: number;
  notifyOnMinAttendees?: boolean;
  recurrencePattern?: MeetingRecurrence;
  recurrenceCustomRule?: string;
  recurrenceUntil?: Date;
  showInLiveFeed?: boolean;
  media?: Array<{
    fileId: string;
    path: string;
    url: string;
    filename: string;
    mimeType: string;
    size: number;
    type: "image" | "video" | "audio" | "document";
  }>;
}): Promise<Meeting> {
  const slug = slugify(params.title);

  const meetingId = generateId();

  const scheduledAt = params.scheduledAt;

  const [meeting] = await db`
    INSERT INTO meetings (
      id, org_id, guide_id, title, slug,
      description, scheduled_at, duration_minutes, location,
      is_online, meeting_url, visibility, status,
      nextcloud_file_id, video_url, is_rsvp_enabled, rsvp_deadline,
      min_attendees, notify_on_min_attendees,
      recurrence_pattern, recurrence_custom_rule, recurrence_until,
      show_in_live_feed
    ) VALUES (
      ${meetingId}, ${ORG_ID}, ${params.userId}, ${params.title},
      ${slug}, ${params.description || null},
      ${scheduledAt}, ${params.durationMinutes || null}, ${params.location || null},
      ${params.isOnline ?? false}, ${params.meetingUrl || null},
      ${params.visibility || 'PUBLIC'}, 'published',
      ${params.nextcloudDocumentId || null}, ${params.documentUrl || null},
      ${params.isRSVPEnabled ?? false}, ${params.rsvpDeadline || null},
      ${params.minAttendees || null}, ${params.notifyOnMinAttendees ?? false},
      ${params.recurrencePattern && params.recurrencePattern !== 'NONE' ? params.recurrencePattern : null}, ${params.recurrenceCustomRule || null},
      ${params.recurrenceUntil || null},
      ${params.showInLiveFeed ?? false}
    )
    RETURNING *
  `;

  // Persist uploaded media, if any
  if (params.media?.length) {
    for (const media of params.media) {
      await db`
        INSERT INTO media (
          id, org_id, uploaded_by, attached_to_type, attached_to_id,
          nextcloud_file_id, nextcloud_path, url, type,
          filename, size_bytes, mime_type
        ) VALUES (
          ${generateId()}, ${ORG_ID}, ${params.userId}, 'meeting', ${meetingId},
          ${media.fileId}, ${media.path}, ${media.url}, ${media.type},
          ${media.filename}, ${media.size}, ${media.mimeType}
        )
      `;
    }
  }

  return mapMeeting(meeting);
}

// Create a new post
export async function createPost(params: {
  userId: string;
  title: string;
  body: string;
  excerpt?: string;
  visibility?: string;
  nextcloudTalkToken?: string;
  documentUrl?: string;
  orgId?: string;
  media?: Array<{
    fileId: string;
    path: string;
    url: string;
    filename: string;
    mimeType: string;
    size: number;
    type: "image" | "video" | "audio" | "document";
  }>;
}): Promise<Post> {
  const slug = slugify(params.title);
  const postId = generateId();
  const effectiveOrgId = params.orgId || ORG_ID;

  const [post] = await db`
    INSERT INTO posts (
      id, org_id, author_id, title, slug, body, excerpt,
      visibility, status, nextcloud_talk_token, document_url
    ) VALUES (
      ${postId}, ${effectiveOrgId}, ${params.userId}, ${params.title},
      ${slug}, ${params.body}, ${params.excerpt || null},
      ${params.visibility || 'PUBLIC'}, 'published',
      ${params.nextcloudTalkToken || null}, ${params.documentUrl || null}
    )
    RETURNING *
  `;

  // Persist uploaded media, if any
  if (params.media?.length) {
    for (const media of params.media) {
      await db`
        INSERT INTO media (
          id, org_id, uploaded_by, attached_to_type, attached_to_id,
          nextcloud_file_id, nextcloud_path, url, type,
          filename, size_bytes, mime_type
        ) VALUES (
          ${generateId()}, ${effectiveOrgId}, ${params.userId}, 'post', ${postId},
          ${media.fileId}, ${media.path}, ${media.url}, ${media.type},
          ${media.filename}, ${media.size}, ${media.mimeType}
        )
      `;
    }
  }

  return mapPost(post);
}

// Get a single meeting by ID
export async function getMeetingById(id: string): Promise<Meeting | null> {
  const meetings = await db`
    SELECT
      m.*,
      m.nextcloud_talk_token,
      u.display_name as guide_name,
      u.avatar_url as guide_avatar,
      (SELECT COUNT(*) FROM meeting_attendees WHERE meeting_id = m.id) as attendee_count,
      EXISTS(SELECT 1 FROM event_pages ep WHERE ep.meeting_id = m.id AND ep.is_published = true) as has_event_page,
      cover_media.id as cover_media_id,
      cover_media.org_id as cover_media_org_id,
      cover_media.uploaded_by as cover_media_uploaded_by,
      cover_media.attached_to_type as cover_media_attached_to_type,
      cover_media.attached_to_id as cover_media_attached_to_id,
      cover_media.nextcloud_file_id as cover_media_nextcloud_file_id,
      cover_media.nextcloud_path as cover_media_nextcloud_path,
      cover_media.url as cover_media_url,
      cover_media.type as cover_media_type,
      cover_media.filename as cover_media_filename,
      cover_media.size_bytes as cover_media_size_bytes,
      cover_media.mime_type as cover_media_mime_type,
      cover_media.caption as cover_media_caption,
      cover_media.alt_text as cover_media_alt_text,
      cover_media.created_at as cover_media_created_at,
      media_list.media_items
    FROM meetings m
    LEFT JOIN users u ON m.guide_id = u.id
    LEFT JOIN LATERAL (
      SELECT
        id, org_id, uploaded_by, attached_to_type, attached_to_id,
        nextcloud_file_id, nextcloud_path, url, type, filename,
        size_bytes, mime_type, caption, alt_text, created_at
      FROM media
      WHERE attached_to_type = 'meeting'
        AND attached_to_id = m.id
        AND type = 'image'
      ORDER BY created_at DESC
      LIMIT 1
    ) cover_media ON TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id', id, 'orgId', org_id, 'uploadedBy', uploaded_by,
            'attachedToType', attached_to_type, 'attachedToId', attached_to_id,
            'nextcloudFileId', nextcloud_file_id, 'nextcloudPath', nextcloud_path,
            'url', url, 'type', type, 'filename', filename,
            'sizeBytes', size_bytes, 'mimeType', mime_type,
            'caption', caption, 'altText', alt_text, 'createdAt', created_at
          ) ORDER BY created_at DESC
        ),
        '[]'::json
      ) AS media_items
      FROM media
      WHERE attached_to_type = 'meeting'
        AND attached_to_id = m.id
    ) media_list ON TRUE
    WHERE m.id = ${id} AND m.org_id = ${ORG_ID}
    LIMIT 1
  `;

  if (meetings.length === 0) return null;
  return mapMeeting(meetings[0]);
}

// Get event page by meeting ID
export async function getEventPage(meetingId: string): Promise<EventPage | null> {
  const rows = await db`
    SELECT * FROM event_pages
    WHERE meeting_id = ${meetingId} AND org_id = ${ORG_ID}
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  return mapEventPage(rows[0]);
}

// Create event page for a meeting
export async function createEventPage(
  meetingId: string,
  publish = true,
  tableData?: { columns: string[]; rows: string[][] }
): Promise<EventPage> {
  const id = generateId();
  const hasTable = tableData && tableData.columns.length > 0;
  const [row] = await db`
    INSERT INTO event_pages (id, meeting_id, org_id, is_published${hasTable ? db`, table_data` : db``})
    VALUES (${id}, ${meetingId}, ${ORG_ID}, ${publish}${hasTable ? db`, ${JSON.stringify(tableData)}` : db``})
    RETURNING *
  `;
  return mapEventPage(row);
}

// Update event page
export async function updateEventPage(
  meetingId: string,
  updates: {
    content?: Record<string, unknown>;
    colors?: EventPageColors;
    tableData?: EventPageTableData;
    layout?: EventPageLayout;
    drawing?: Record<string, unknown> | null;
    isPublished?: boolean;
  }
): Promise<EventPage | null> {
  const setClauses: string[] = [];
  const values: Record<string, unknown> = {};

  if (updates.content !== undefined) values.content = JSON.stringify(updates.content);
  if (updates.colors !== undefined) values.colors = JSON.stringify(updates.colors);
  if (updates.tableData !== undefined) values.table_data = JSON.stringify(updates.tableData);
  if (updates.layout !== undefined) values.layout = updates.layout;
  if (updates.drawing !== undefined) values.drawing = updates.drawing ? JSON.stringify(updates.drawing) : null;
  if (updates.isPublished !== undefined) values.is_published = updates.isPublished;

  if (Object.keys(values).length === 0) return getEventPage(meetingId);

  const rows = await db`
    UPDATE event_pages SET
      ${db(values, ...Object.keys(values))}
    WHERE meeting_id = ${meetingId} AND org_id = ${ORG_ID}
    RETURNING *
  `;

  if (rows.length === 0) return null;
  return mapEventPage(rows[0]);
}

function mapEventPage(row: any): EventPage {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    orgId: row.org_id,
    content: typeof row.content === 'string' ? JSON.parse(row.content) : (row.content || {}),
    colors: typeof row.colors === 'string' ? JSON.parse(row.colors) : (row.colors || {}),
    tableData: (() => {
      const raw = typeof row.table_data === 'string' ? JSON.parse(row.table_data) : (row.table_data || {});
      return {
        columns: Array.isArray(raw.columns) ? raw.columns : [],
        rows: Array.isArray(raw.rows) ? raw.rows : [],
      };
    })(),
    layout: row.layout || 'default',
    drawing: row.drawing
      ? (typeof row.drawing === 'string' ? JSON.parse(row.drawing) : row.drawing)
      : null,
    isPublished: row.is_published ?? false,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
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
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : new Date(),
    timeZone: row.time_zone || undefined,
    durationMinutes: row.duration_minutes || undefined,
    location: row.location || undefined,
    isOnline: row.is_online ?? true,
    meetingUrl: row.meeting_url || undefined,
    videoUrl: row.video_url || undefined,
    videoLink: row.video_link || undefined,
    recurrencePattern: row.recurrence_pattern || undefined,
    recurrenceCustomRule: row.recurrence_custom_rule || undefined,
    recurrenceUntil: row.recurrence_until ? new Date(row.recurrence_until) : undefined,
    hasEventPage: row.has_event_page ?? false,
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
    nextcloudTalkToken: row.nextcloud_talk_token || undefined,
    documentUrl: row.video_url || undefined,
    nextcloudDocumentId: row.nextcloud_file_id || undefined,
    metadata: row.metadata || undefined,
    createdAt: row.created_at,
    publishedAt: row.published_at || undefined,
    updatedAt: row.updated_at,
    viewCount: row.view_count ?? 0,
    replyCount: row.reply_count ?? 0,
    attendeeCount: parseInt(row.attendee_count) || 0,
    guide: row.guide_name ? { displayName: row.guide_name, avatarUrl: row.guide_avatar || undefined } : undefined,
    creator: row.guide_name ? { displayName: row.guide_name, avatarUrl: row.guide_avatar || undefined } : undefined,
    coverImage: row.cover_media_id
      ? {
          id: row.cover_media_id,
          orgId: row.cover_media_org_id,
          uploadedBy: row.cover_media_uploaded_by,
          attachedToType: row.cover_media_attached_to_type || undefined,
          attachedToId: row.cover_media_attached_to_id || undefined,
          nextcloudFileId: row.cover_media_nextcloud_file_id,
          nextcloudPath: row.cover_media_nextcloud_path,
          url: row.cover_media_url,
          type: row.cover_media_type || undefined,
          filename: row.cover_media_filename || undefined,
          sizeBytes: row.cover_media_size_bytes || undefined,
          mimeType: row.cover_media_mime_type || undefined,
          caption: row.cover_media_caption || undefined,
          altText: row.cover_media_alt_text || undefined,
          createdAt: row.cover_media_created_at ? new Date(row.cover_media_created_at) : row.created_at,
        }
      : undefined,
    media: (Array.isArray(row.media_items) ? row.media_items : row.media_items ? JSON.parse(row.media_items) : []).map(
      (item: any) => ({
          id: item.id,
          orgId: item.orgId,
          uploadedBy: item.uploadedBy,
          attachedToType: item.attachedToType || undefined,
          attachedToId: item.attachedToId || undefined,
          nextcloudFileId: item.nextcloudFileId,
          nextcloudPath: item.nextcloudPath,
          url: item.url,
          type: item.type || undefined,
          filename: item.filename || undefined,
          sizeBytes: item.sizeBytes || undefined,
          mimeType: item.mimeType || undefined,
          caption: item.caption || undefined,
          altText: item.altText || undefined,
          createdAt: item.createdAt ? new Date(item.createdAt) : row.created_at,
        })
    ),
  } as unknown as Meeting;
}

function mapPost(row: any): Post {
  return {
    id: row.id,
    orgId: row.org_id,
    authorId: row.author_id,
    title: row.title,
    slug: row.slug,
    body: row.body,
    excerpt: row.excerpt || undefined,
    status: row.status,
    visibility: row.visibility,
    nextcloudFileId: row.nextcloud_file_id || undefined,
    nextcloudLastSync: row.nextcloud_last_sync || undefined,
    metadata: row.metadata || undefined,
    createdAt: row.created_at,
    publishedAt: row.published_at || undefined,
    updatedAt: row.updated_at,
    viewCount: row.view_count ?? 0,
    replyCount: row.reply_count ?? 0,
    author: row.author_name ? { displayName: row.author_name } : undefined,
    coverImage: row.cover_media_id
      ? {
          id: row.cover_media_id,
          orgId: row.cover_media_org_id,
          uploadedBy: row.cover_media_uploaded_by,
          attachedToType: row.cover_media_attached_to_type || undefined,
          attachedToId: row.cover_media_attached_to_id || undefined,
          nextcloudFileId: row.cover_media_nextcloud_file_id,
          nextcloudPath: row.cover_media_nextcloud_path,
          url: row.cover_media_url,
          type: row.cover_media_type || undefined,
          filename: row.cover_media_filename || undefined,
          sizeBytes: row.cover_media_size_bytes || undefined,
          mimeType: row.cover_media_mime_type || undefined,
          caption: row.cover_media_caption || undefined,
          altText: row.cover_media_alt_text || undefined,
          createdAt: row.cover_media_created_at ? new Date(row.cover_media_created_at) : row.created_at,
        }
      : undefined,
    media: (Array.isArray(row.media_items) ? row.media_items : row.media_items ? JSON.parse(row.media_items) : []).map(
      (item: any) => ({
          id: item.id,
          orgId: item.orgId,
          uploadedBy: item.uploadedBy,
          attachedToType: item.attachedToType || undefined,
          attachedToId: item.attachedToId || undefined,
          nextcloudFileId: item.nextcloudFileId,
          nextcloudPath: item.nextcloudPath,
          url: item.url,
          type: item.type || undefined,
          filename: item.filename || undefined,
          sizeBytes: item.sizeBytes || undefined,
          mimeType: item.mimeType || undefined,
          caption: item.caption || undefined,
          altText: item.altText || undefined,
          createdAt: item.createdAt ? new Date(item.createdAt) : row.created_at,
        })
    ),
  } as Post;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

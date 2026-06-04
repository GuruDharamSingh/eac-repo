import { db } from "@elkdonis/db";
import type { Meeting, MeetingVisibility, MeetingRecurrence, Post, EventPage, EventPageLayout, EventPageColors, EventPageTableData } from "@elkdonis/types";
import { getQuestionPollsByOrg } from "@elkdonis/services";
import type { QuestionPoll } from "@elkdonis/services";

// Organization ID for InnerGathering
const ORG_ID = 'inner_group';

// ============================================================================
// Unified-threads data layer.
//
// All content lives in the `threads` table discriminated by `kind`
// ('meeting' | 'post' | 'workshop' | 'event'). This module still exposes
// Meeting / Post / EventPage shapes so UI components don't break — the
// mappers translate thread rows back into the legacy shapes.
//
//   meetings           -> threads WHERE kind = 'meeting'
//   posts              -> threads WHERE kind = 'post'
//   meeting.guide_id   -> thread.author_id  (aliased as guide_id in SQL)
//   meeting.description-> thread.body
//   meeting_attendees  -> thread_rsvps
//   event_pages        -> thread.drawing + thread.metadata.event_page
//   media attached_to  -> 'thread' (migration 030 retargeted the CHECK)
// ============================================================================

// Shared SELECT fragment for a thread row mapped to a Meeting-ish shape.
// guide_* and has_event_page aliases keep mapMeeting() untouched.
const THREAD_MEETING_COLUMNS = `
  t.id, t.kind, t.org_id, t.slug, t.title, t.status, t.visibility,
  t.scheduled_at, t.duration_minutes, t.location, t.is_online,
  t.meeting_url, t.recurrence_pattern, t.recurrence_custom_rule,
  t.recurrence_until, t.is_rsvp_enabled, t.rsvp_deadline,
  t.attendee_limit, t.min_attendees, t.notify_on_min_attendees,
  t.min_attendees_notified, t.nextcloud_file_id,
  t.nextcloud_talk_token, t.nextcloud_last_sync, t.document_url,
  t.video_url, t.show_in_live_feed, t.view_count, t.reply_count,
  t.metadata, t.created_at, t.published_at, t.updated_at,
  t.body AS description,
  t.author_id AS guide_id,
  COALESCE(((t.metadata->>'event_page')::jsonb->>'isPublished')::boolean, false) AS has_event_page
`;

const THREAD_POST_COLUMNS = `
  t.id, t.org_id, t.slug, t.title, t.body, t.excerpt, t.status,
  t.visibility, t.nextcloud_file_id, t.nextcloud_last_sync,
  t.metadata, t.created_at, t.published_at, t.updated_at,
  t.view_count, t.reply_count,
  t.author_id
`;

// Get all meetings, posts, and polls for the feed (filtered by inner_group org)
export async function getFeed(isAdmin = false) {
  const [meetings, posts, questionPolls] = await Promise.all([
    getMeetings(isAdmin),
    getPosts(),
    getQuestionPollsByOrg(ORG_ID).catch(() => [] as QuestionPoll[]),
  ]);

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
      ${db.unsafe(THREAD_MEETING_COLUMNS)},
      u.display_name AS guide_name,
      u.avatar_url AS guide_avatar,
      (SELECT COUNT(*) FROM thread_rsvps WHERE thread_id = t.id AND status = 'yes') AS attendee_count,
      cm.id AS cover_media_id, cm.org_id AS cover_media_org_id,
      cm.uploaded_by AS cover_media_uploaded_by,
      cm.attached_to_type AS cover_media_attached_to_type,
      cm.attached_to_id AS cover_media_attached_to_id,
      cm.nextcloud_file_id AS cover_media_nextcloud_file_id,
      cm.nextcloud_path AS cover_media_nextcloud_path,
      cm.url AS cover_media_url, cm.type AS cover_media_type,
      cm.filename AS cover_media_filename,
      cm.size_bytes AS cover_media_size_bytes,
      cm.mime_type AS cover_media_mime_type,
      cm.caption AS cover_media_caption,
      cm.alt_text AS cover_media_alt_text,
      cm.created_at AS cover_media_created_at,
      ml.media_items
    FROM threads t
    LEFT JOIN users u ON t.author_id = u.id
    LEFT JOIN LATERAL (
      SELECT id, org_id, uploaded_by, attached_to_type, attached_to_id,
             nextcloud_file_id, nextcloud_path, url, type, filename,
             size_bytes, mime_type, caption, alt_text, created_at
      FROM media
      WHERE attached_to_type = 'thread' AND attached_to_id = t.id AND type = 'image'
      ORDER BY created_at DESC LIMIT 1
    ) cm ON TRUE
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
      FROM media WHERE attached_to_type = 'thread' AND attached_to_id = t.id
    ) ml ON TRUE
    WHERE t.kind = 'meeting'
      AND t.org_id = ${ORG_ID}
      AND t.status = 'published'
      AND t.scheduled_at >= ${startDate}
      AND t.scheduled_at <= ${endDate}
    ORDER BY t.scheduled_at ASC
  `;

  return meetings.map(mapMeeting);
}

// Get all meetings for inner_group
export async function getMeetings(isAdmin = false): Promise<Meeting[]> {
  const meetings = await db`
    SELECT
      ${db.unsafe(THREAD_MEETING_COLUMNS)},
      u.display_name AS guide_name,
      u.avatar_url AS guide_avatar,
      (SELECT COUNT(*) FROM thread_rsvps WHERE thread_id = t.id AND status = 'yes') AS attendee_count,
      cm.id AS cover_media_id, cm.org_id AS cover_media_org_id,
      cm.uploaded_by AS cover_media_uploaded_by,
      cm.attached_to_type AS cover_media_attached_to_type,
      cm.attached_to_id AS cover_media_attached_to_id,
      cm.nextcloud_file_id AS cover_media_nextcloud_file_id,
      cm.nextcloud_path AS cover_media_nextcloud_path,
      cm.url AS cover_media_url, cm.type AS cover_media_type,
      cm.filename AS cover_media_filename,
      cm.size_bytes AS cover_media_size_bytes,
      cm.mime_type AS cover_media_mime_type,
      cm.caption AS cover_media_caption,
      cm.alt_text AS cover_media_alt_text,
      cm.created_at AS cover_media_created_at,
      ml.media_items
    FROM threads t
    LEFT JOIN users u ON t.author_id = u.id
    LEFT JOIN LATERAL (
      SELECT id, org_id, uploaded_by, attached_to_type, attached_to_id,
             nextcloud_file_id, nextcloud_path, url, type, filename,
             size_bytes, mime_type, caption, alt_text, created_at
      FROM media
      WHERE attached_to_type = 'thread' AND attached_to_id = t.id AND type = 'image'
      ORDER BY created_at DESC LIMIT 1
    ) cm ON TRUE
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
      FROM media WHERE attached_to_type = 'thread' AND attached_to_id = t.id
    ) ml ON TRUE
    WHERE t.kind IN ('meeting', 'workshop')
      AND t.org_id = ${ORG_ID}
      AND t.status = 'published'
      AND (t.visibility = 'PUBLIC' OR ${isAdmin})
    ORDER BY t.created_at DESC
    LIMIT 50
  `;

  return meetings.map(mapMeeting);
}

// Get recurring meetings for inner_group (upcoming, with a recurrence pattern)
export async function getRecurringMeetings(): Promise<Meeting[]> {
  const meetings = await db`
    SELECT
      ${db.unsafe(THREAD_MEETING_COLUMNS)},
      u.display_name AS guide_name,
      u.avatar_url AS guide_avatar,
      (SELECT COUNT(*) FROM thread_rsvps WHERE thread_id = t.id AND status = 'yes') AS attendee_count,
      cm.id AS cover_media_id, cm.org_id AS cover_media_org_id,
      cm.uploaded_by AS cover_media_uploaded_by,
      cm.attached_to_type AS cover_media_attached_to_type,
      cm.attached_to_id AS cover_media_attached_to_id,
      cm.nextcloud_file_id AS cover_media_nextcloud_file_id,
      cm.nextcloud_path AS cover_media_nextcloud_path,
      cm.url AS cover_media_url, cm.type AS cover_media_type,
      cm.filename AS cover_media_filename,
      cm.size_bytes AS cover_media_size_bytes,
      cm.mime_type AS cover_media_mime_type,
      cm.caption AS cover_media_caption,
      cm.alt_text AS cover_media_alt_text,
      cm.created_at AS cover_media_created_at,
      ml.media_items
    FROM threads t
    LEFT JOIN users u ON t.author_id = u.id
    LEFT JOIN LATERAL (
      SELECT id, org_id, uploaded_by, attached_to_type, attached_to_id,
             nextcloud_file_id, nextcloud_path, url, type, filename,
             size_bytes, mime_type, caption, alt_text, created_at
      FROM media
      WHERE attached_to_type = 'thread' AND attached_to_id = t.id AND type = 'image'
      ORDER BY created_at DESC LIMIT 1
    ) cm ON TRUE
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
      FROM media WHERE attached_to_type = 'thread' AND attached_to_id = t.id
    ) ml ON TRUE
    WHERE t.kind = 'meeting'
      AND t.org_id = ${ORG_ID}
      AND t.status = 'published'
      AND t.recurrence_pattern IS NOT NULL
    ORDER BY t.scheduled_at ASC
    LIMIT 20
  `;

  return meetings.map(mapMeeting);
}

// Get all posts for inner_group
export async function getPosts(): Promise<Post[]> {
  const posts = await db`
    SELECT
      t.id, t.org_id, t.slug, t.title, t.body, t.excerpt, t.status,
      t.visibility, t.nextcloud_file_id, t.nextcloud_last_sync,
      t.metadata, t.created_at, t.published_at, t.updated_at,
      t.view_count, t.reply_count, t.author_id,
      u.display_name AS author_name,
      cm.id AS cover_media_id, cm.org_id AS cover_media_org_id,
      cm.uploaded_by AS cover_media_uploaded_by,
      cm.attached_to_type AS cover_media_attached_to_type,
      cm.attached_to_id AS cover_media_attached_to_id,
      cm.nextcloud_file_id AS cover_media_nextcloud_file_id,
      cm.nextcloud_path AS cover_media_nextcloud_path,
      cm.url AS cover_media_url, cm.type AS cover_media_type,
      cm.filename AS cover_media_filename,
      cm.size_bytes AS cover_media_size_bytes,
      cm.mime_type AS cover_media_mime_type,
      cm.caption AS cover_media_caption,
      cm.alt_text AS cover_media_alt_text,
      cm.created_at AS cover_media_created_at,
      ml.media_items
    FROM threads t
    LEFT JOIN users u ON t.author_id = u.id
    LEFT JOIN LATERAL (
      SELECT id, org_id, uploaded_by, attached_to_type, attached_to_id,
             nextcloud_file_id, nextcloud_path, url, type, filename,
             size_bytes, mime_type, caption, alt_text, created_at
      FROM media
      WHERE attached_to_type = 'thread' AND attached_to_id = t.id AND type = 'image'
      ORDER BY created_at DESC LIMIT 1
    ) cm ON TRUE
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
      FROM media WHERE attached_to_type = 'thread' AND attached_to_id = t.id
    ) ml ON TRUE
    WHERE t.kind = 'post'
      AND t.org_id = ${ORG_ID}
      AND t.status = 'published'
      AND (
        COALESCE(t.pinned, false) = true
        OR NOT EXISTS (
          SELECT 1 FROM thread_topics tt
          JOIN topics tp ON tp.id = tt.topic_id
          WHERE tt.thread_id = t.id AND tp.slug = 'what-is-art-for'
        )
      )
    ORDER BY t.created_at DESC
    LIMIT 50
  `;

  return posts.map(mapPost);
}

// Get a single post (thread with kind='post') by id
export async function getPostById(id: string): Promise<Post | null> {
  const posts = await db`
    SELECT
      t.id, t.org_id, t.slug, t.title, t.body, t.excerpt, t.status,
      t.visibility, t.nextcloud_file_id, t.nextcloud_last_sync,
      t.metadata, t.created_at, t.published_at, t.updated_at,
      t.view_count, t.reply_count, t.author_id,
      u.display_name AS author_name,
      cm.id AS cover_media_id, cm.org_id AS cover_media_org_id,
      cm.uploaded_by AS cover_media_uploaded_by,
      cm.attached_to_type AS cover_media_attached_to_type,
      cm.attached_to_id AS cover_media_attached_to_id,
      cm.nextcloud_file_id AS cover_media_nextcloud_file_id,
      cm.nextcloud_path AS cover_media_nextcloud_path,
      cm.url AS cover_media_url, cm.type AS cover_media_type,
      cm.filename AS cover_media_filename,
      cm.size_bytes AS cover_media_size_bytes,
      cm.mime_type AS cover_media_mime_type,
      cm.caption AS cover_media_caption,
      cm.alt_text AS cover_media_alt_text,
      cm.created_at AS cover_media_created_at,
      ml.media_items
    FROM threads t
    LEFT JOIN users u ON t.author_id = u.id
    LEFT JOIN LATERAL (
      SELECT id, org_id, uploaded_by, attached_to_type, attached_to_id,
             nextcloud_file_id, nextcloud_path, url, type, filename,
             size_bytes, mime_type, caption, alt_text, created_at
      FROM media
      WHERE attached_to_type = 'thread' AND attached_to_id = t.id AND type = 'image'
      ORDER BY created_at DESC LIMIT 1
    ) cm ON TRUE
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
      FROM media WHERE attached_to_type = 'thread' AND attached_to_id = t.id
    ) ml ON TRUE
    WHERE t.kind = 'post' AND t.id = ${id} AND t.org_id = ${ORG_ID}
    LIMIT 1
  `;

  if (posts.length === 0) return null;
  return mapPost(posts[0]);
}

// Create a new meeting (thread with kind='meeting')
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
  const threadId = generateId();
  const scheduledAt = params.scheduledAt;

  const [thread] = await db`
    INSERT INTO threads (
      id, org_id, author_id, kind, title, slug,
      body, scheduled_at, duration_minutes, location,
      is_online, meeting_url, visibility, status,
      nextcloud_file_id, video_url, is_rsvp_enabled, rsvp_deadline,
      min_attendees, notify_on_min_attendees,
      recurrence_pattern, recurrence_custom_rule, recurrence_until,
      show_in_live_feed, published_at
    ) VALUES (
      ${threadId}, ${ORG_ID}, ${params.userId}, 'meeting', ${params.title},
      ${slug}, ${params.description || ''},
      ${scheduledAt}, ${params.durationMinutes || null}, ${params.location || null},
      ${params.isOnline ?? false}, ${params.meetingUrl || null},
      ${params.visibility || 'PUBLIC'}, 'published',
      ${params.nextcloudDocumentId || null}, ${params.documentUrl || null},
      ${params.isRSVPEnabled ?? false}, ${params.rsvpDeadline || null},
      ${params.minAttendees || null}, ${params.notifyOnMinAttendees ?? false},
      ${params.recurrencePattern && params.recurrencePattern !== 'NONE' ? params.recurrencePattern : null},
      ${params.recurrenceCustomRule || null},
      ${params.recurrenceUntil || null},
      ${params.showInLiveFeed ?? false},
      NOW()
    )
    RETURNING *, body AS description, author_id AS guide_id
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
          ${generateId()}, ${ORG_ID}, ${params.userId}, 'thread', ${threadId},
          ${media.fileId}, ${media.path}, ${media.url}, ${media.type},
          ${media.filename}, ${media.size}, ${media.mimeType}
        )
      `;
    }
  }

  return mapMeeting(thread);
}

// Create a new post (thread with kind='post')
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
  const threadId = generateId();
  const effectiveOrgId = params.orgId || ORG_ID;

  const [thread] = await db`
    INSERT INTO threads (
      id, org_id, author_id, kind, title, slug, body, excerpt,
      visibility, status, nextcloud_talk_token, document_url, published_at
    ) VALUES (
      ${threadId}, ${effectiveOrgId}, ${params.userId}, 'post', ${params.title},
      ${slug}, ${params.body}, ${params.excerpt || null},
      ${params.visibility || 'PUBLIC'}, 'published',
      ${params.nextcloudTalkToken || null}, ${params.documentUrl || null},
      NOW()
    )
    RETURNING *
  `;

  if (params.media?.length) {
    for (const media of params.media) {
      await db`
        INSERT INTO media (
          id, org_id, uploaded_by, attached_to_type, attached_to_id,
          nextcloud_file_id, nextcloud_path, url, type,
          filename, size_bytes, mime_type
        ) VALUES (
          ${generateId()}, ${effectiveOrgId}, ${params.userId}, 'thread', ${threadId},
          ${media.fileId}, ${media.path}, ${media.url}, ${media.type},
          ${media.filename}, ${media.size}, ${media.mimeType}
        )
      `;
    }
  }

  return mapPost(thread);
}

// Get a single meeting by ID
export async function getMeetingById(id: string): Promise<Meeting | null> {
  const meetings = await db`
    SELECT
      ${db.unsafe(THREAD_MEETING_COLUMNS)},
      u.display_name AS guide_name,
      u.avatar_url AS guide_avatar,
      (SELECT COUNT(*) FROM thread_rsvps WHERE thread_id = t.id AND status = 'yes') AS attendee_count,
      cm.id AS cover_media_id, cm.org_id AS cover_media_org_id,
      cm.uploaded_by AS cover_media_uploaded_by,
      cm.attached_to_type AS cover_media_attached_to_type,
      cm.attached_to_id AS cover_media_attached_to_id,
      cm.nextcloud_file_id AS cover_media_nextcloud_file_id,
      cm.nextcloud_path AS cover_media_nextcloud_path,
      cm.url AS cover_media_url, cm.type AS cover_media_type,
      cm.filename AS cover_media_filename,
      cm.size_bytes AS cover_media_size_bytes,
      cm.mime_type AS cover_media_mime_type,
      cm.caption AS cover_media_caption,
      cm.alt_text AS cover_media_alt_text,
      cm.created_at AS cover_media_created_at,
      ml.media_items
    FROM threads t
    LEFT JOIN users u ON t.author_id = u.id
    LEFT JOIN LATERAL (
      SELECT id, org_id, uploaded_by, attached_to_type, attached_to_id,
             nextcloud_file_id, nextcloud_path, url, type, filename,
             size_bytes, mime_type, caption, alt_text, created_at
      FROM media
      WHERE attached_to_type = 'thread' AND attached_to_id = t.id AND type = 'image'
      ORDER BY created_at DESC LIMIT 1
    ) cm ON TRUE
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
      FROM media WHERE attached_to_type = 'thread' AND attached_to_id = t.id
    ) ml ON TRUE
    WHERE t.kind = 'meeting' AND t.id = ${id} AND t.org_id = ${ORG_ID}
    LIMIT 1
  `;

  if (meetings.length === 0) return null;
  return mapMeeting(meetings[0]);
}

// ============================================================================
// Event-page API backed by threads.drawing + threads.metadata.event_page.
// Migration 030 dropped the event_pages table; content/colors/tableData/layout
// are stashed in the thread's JSONB metadata for now.
// ============================================================================

export async function getEventPage(meetingId: string): Promise<EventPage | null> {
  const rows = await db`
    SELECT id, metadata, drawing, created_at, updated_at
    FROM threads
    WHERE kind = 'meeting' AND id = ${meetingId} AND org_id = ${ORG_ID}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return mapEventPageFromThread(rows[0]);
}

export async function createEventPage(
  meetingId: string,
  publish = true,
  tableData?: { columns: string[]; rows: string[][] }
): Promise<EventPage> {
  const ep: Record<string, unknown> = { isPublished: publish };
  if (tableData && tableData.columns.length > 0) ep.tableData = tableData;

  const [row] = await db`
    UPDATE threads
    SET metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{event_page}',
          ${JSON.stringify(ep)}::jsonb,
          true
        ),
        updated_at = NOW()
    WHERE kind = 'meeting' AND id = ${meetingId} AND org_id = ${ORG_ID}
    RETURNING id, metadata, drawing, created_at, updated_at
  `;
  return mapEventPageFromThread(row);
}

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
  // drawing is first-class on threads; everything else merges into metadata.event_page
  const epPatch: Record<string, unknown> = {};
  if (updates.content !== undefined) epPatch.content = updates.content;
  if (updates.colors !== undefined) epPatch.colors = updates.colors;
  if (updates.tableData !== undefined) epPatch.tableData = updates.tableData;
  if (updates.layout !== undefined) epPatch.layout = updates.layout;
  if (updates.isPublished !== undefined) epPatch.isPublished = updates.isPublished;

  const hasEpPatch = Object.keys(epPatch).length > 0;
  const hasDrawing = updates.drawing !== undefined;

  if (!hasEpPatch && !hasDrawing) return getEventPage(meetingId);

  let rows;
  if (hasEpPatch && hasDrawing) {
    rows = await db`
      UPDATE threads
      SET drawing = ${updates.drawing ? JSON.stringify(updates.drawing) : null}::jsonb,
          metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{event_page}',
            COALESCE(metadata->'event_page', '{}'::jsonb) || ${JSON.stringify(epPatch)}::jsonb,
            true
          ),
          updated_at = NOW()
      WHERE kind = 'meeting' AND id = ${meetingId} AND org_id = ${ORG_ID}
      RETURNING id, metadata, drawing, created_at, updated_at
    `;
  } else if (hasDrawing) {
    rows = await db`
      UPDATE threads
      SET drawing = ${updates.drawing ? JSON.stringify(updates.drawing) : null}::jsonb,
          updated_at = NOW()
      WHERE kind = 'meeting' AND id = ${meetingId} AND org_id = ${ORG_ID}
      RETURNING id, metadata, drawing, created_at, updated_at
    `;
  } else {
    rows = await db`
      UPDATE threads
      SET metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{event_page}',
            COALESCE(metadata->'event_page', '{}'::jsonb) || ${JSON.stringify(epPatch)}::jsonb,
            true
          ),
          updated_at = NOW()
      WHERE kind = 'meeting' AND id = ${meetingId} AND org_id = ${ORG_ID}
      RETURNING id, metadata, drawing, created_at, updated_at
    `;
  }

  if (rows.length === 0) return null;
  return mapEventPageFromThread(rows[0]);
}

function mapEventPageFromThread(row: any): EventPage {
  const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
  const ep = meta.event_page || {};
  const rawTable = ep.tableData || {};
  return {
    id: row.id,
    meetingId: row.id,
    orgId: ORG_ID,
    content: ep.content || {},
    colors: ep.colors || {},
    tableData: {
      columns: Array.isArray(rawTable.columns) ? rawTable.columns : [],
      rows: Array.isArray(rawTable.rows) ? rawTable.rows : [],
    },
    layout: ep.layout || 'default',
    drawing: row.drawing
      ? (typeof row.drawing === 'string' ? JSON.parse(row.drawing) : row.drawing)
      : null,
    isPublished: ep.isPublished ?? false,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ============================================================================
// Row-to-shape mappers (unchanged — queries alias thread columns into the
// legacy field names the mappers expect).
// ============================================================================

function mapMeeting(row: any): Meeting {
  return {
    id: row.id,
    kind: row.kind,
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
    hasEventPage: row.has_event_page === true || row.has_event_page === 'true' || row.has_event_page === 't',
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
    documentUrl: row.document_url || undefined,
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
    nextcloudTalkToken: row.nextcloud_talk_token || undefined,
    documentUrl: row.document_url || undefined,
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

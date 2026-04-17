"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { nanoid } from "nanoid";
import { getServerSession } from "@elkdonis/auth-server";
import { siteConfig } from "@/config/site";
import type { MeetingVisibility, MeetingRecurrence } from "@elkdonis/types";

const ORG_ID = siteConfig.orgId;

export async function createMeetingAction(payload: {
  userId: string;
  title: string;
  scheduledAt: Date;
  durationMinutes?: number;
  location?: string;
  description?: string;
  visibility?: MeetingVisibility;
  isOnline?: boolean;
  meetingUrl?: string;
  isRSVPEnabled?: boolean;
  rsvpDeadline?: Date;
  minAttendees?: number;
  notifyOnMinAttendees?: boolean;
  recurrencePattern?: MeetingRecurrence;
  recurrenceCustomRule?: string;
  recurrenceUntil?: Date;
  section?: string;
  media?: Array<{
    fileId: string;
    path: string;
    url: string;
    filename: string;
    mimeType: string;
    size: number;
    type: "image" | "video" | "audio" | "document";
  }>;
}) {
  const session = await getServerSession();

  if (!session.user || !siteConfig.ownerEmails.includes(session.user.email)) {
    throw new Error("Unauthorized");
  }

  // Validate required fields
  if (!payload.title?.trim()) {
    throw new Error("Meeting title is required");
  }

  if (!payload.scheduledAt) {
    throw new Error("Scheduled date/time is required");
  }

  const id = nanoid();
  const slug = payload.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') + '-' + id.slice(0, 6);

  try {
    const [meeting] = await db`
      INSERT INTO threads (
        id, org_id, author_id, kind, title, slug, body, location,
        scheduled_at, duration_minutes, is_online, meeting_url,
        visibility, status, is_rsvp_enabled, rsvp_deadline,
        attendee_limit, recurrence_pattern, recurrence_custom_rule,
        recurrence_until, section, published_at
      )
      VALUES (
        ${id},
        ${ORG_ID},
        ${payload.userId},
        'meeting',
        ${payload.title.trim()},
        ${slug},
        ${payload.description?.trim() || null},
        ${payload.location?.trim() || null},
        ${payload.scheduledAt},
        ${payload.durationMinutes || 150},
        ${payload.isOnline ?? false},
        ${payload.meetingUrl?.trim() || null},
        ${payload.visibility || 'PUBLIC'},
        'published',
        ${payload.isRSVPEnabled ?? true},
        ${payload.rsvpDeadline || null},
        ${payload.minAttendees || null},
        ${payload.recurrencePattern && payload.recurrencePattern !== 'NONE' ? payload.recurrencePattern : null},
        ${payload.recurrenceCustomRule || null},
        ${payload.recurrenceUntil || null},
        ${payload.section || null},
        NOW()
      )
      RETURNING id, title, slug
    `;

    // Handle media attachments if any
    if (payload.media?.length) {
      for (const media of payload.media) {
        await db`
          INSERT INTO media (
            id, org_id, uploaded_by, attached_to_type, attached_to_id,
            nextcloud_file_id, nextcloud_path, url, type,
            filename, size_bytes, mime_type
          ) VALUES (
            ${nanoid()}, ${ORG_ID}, ${payload.userId}, 'thread', ${id},
            ${media.fileId}, ${media.path}, ${media.url}, ${media.type},
            ${media.filename}, ${media.size}, ${media.mimeType}
          )
        `;
      }
    }

    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/sadhana");
    revalidatePath("/yoga");
    revalidatePath("/gurdwara");

    return { success: true, meetingId: meeting.id };
  } catch (err) {
    console.error('[amrit-canada] createMeetingAction error:', err);
    throw new Error("Failed to create meeting");
  }
}

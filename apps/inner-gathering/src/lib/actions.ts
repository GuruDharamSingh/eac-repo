"use server";

import { revalidatePath } from "next/cache";
import { createMeeting, createPost, createEventPage } from "./data";
import type { MeetingVisibility, MeetingRecurrence } from "@elkdonis/types";
import { getServerSession } from "@elkdonis/auth-server";
import { createNextcloudClient } from "@elkdonis/nextcloud";
import { syncMeetingToNextcloud } from "@elkdonis/services";
import { db } from "@elkdonis/db";
import { createHash } from "crypto";

/**
 * Server-side helper: verify that the user has access to post to an org.
 * Returns true if:
 * - User is owner/guide of the org
 * - User is a global admin
 * - The org has no blog password set
 * - The provided blogPassword matches the org's stored hash
 */
async function verifyOrgAccess(userId: string, orgId: string, blogPassword?: string): Promise<boolean> {
  // Check user's role in this org
  const [membership] = await db`
    SELECT role FROM user_organizations
    WHERE user_id = ${userId} AND org_id = ${orgId}
  `;

  const [user] = await db`
    SELECT is_admin FROM users WHERE id = ${userId}
  `;

  const role = membership?.role;
  if (role === 'owner' || role === 'guide' || user?.is_admin) {
    return true;
  }

  // Check if org has a password set
  const [org] = await db`
    SELECT blog_password_hash, blog_password_salt
    FROM organizations WHERE id = ${orgId}
  `;

  if (!org?.blog_password_hash || !org?.blog_password_salt) {
    return true; // No password set = open access
  }

  if (!blogPassword) {
    return false;
  }

  const hash = createHash('sha256').update(blogPassword + org.blog_password_salt).digest('hex');
  return hash === org.blog_password_hash;
}

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
  nextcloudDocumentId?: string;
  documentUrl?: string;
  syncToCalendar?: boolean;
  createTalkRoom?: boolean;
  isRSVPEnabled?: boolean;
  rsvpDeadline?: Date;
  minAttendees?: number;
  notifyOnMinAttendees?: boolean;
  recurrencePattern?: MeetingRecurrence;
  recurrenceCustomRule?: string;
  recurrenceUntil?: Date;
  createEventPage?: boolean;
  eventPageTableData?: { columns: string[]; rows: string[][] };
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
  blogPassword?: string;
}) {
  // Validate required fields
  if (!payload.title?.trim()) {
    throw new Error("Meeting title is required");
  }

  if (!payload.scheduledAt) {
    throw new Error("Scheduled date/time is required");
  }

  // Verify org access (blog password gating)
  const hasAccess = await verifyOrgAccess(payload.userId, 'inner_group', payload.blogPassword);
  if (!hasAccess) {
    throw new Error("You don't have access to publish to this organization. Please provide the correct blog password.");
  }

  // Validate scheduledAt is a valid date
  const scheduledAt = payload.scheduledAt instanceof Date ? payload.scheduledAt : new Date(payload.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new Error("Invalid scheduled date/time");
  }

  // Create meeting
  const meeting = await createMeeting({
    userId: payload.userId,
    title: payload.title.trim(),
    scheduledAt,
    durationMinutes: payload.durationMinutes,
    location: payload.location?.trim(),
    description: payload.description?.trim(),
    visibility: payload.visibility,
    isOnline: payload.isOnline,
    meetingUrl: payload.meetingUrl?.trim(),
    nextcloudDocumentId: payload.nextcloudDocumentId,
    documentUrl: payload.documentUrl,
    media: payload.media,
    isRSVPEnabled: payload.isRSVPEnabled,
    rsvpDeadline: payload.rsvpDeadline,
    minAttendees: payload.minAttendees,
    notifyOnMinAttendees: payload.notifyOnMinAttendees,
    recurrencePattern: payload.recurrencePattern,
    recurrenceCustomRule: payload.recurrenceCustomRule,
    recurrenceUntil: payload.recurrenceUntil,
    showInLiveFeed: payload.showInLiveFeed,
  });

  // Create event page if requested
  if (payload.createEventPage) {
    try {
      await createEventPage(meeting.id, true, payload.eventPageTableData);
      console.log(`✓ Event page created for meeting ${meeting.id}`);
    } catch (error) {
      console.error('✗ Failed to create event page:', error);
    }
  }

  // ============ Nextcloud Calendar & Talk Integration ============
  // Get user session with Nextcloud credentials
  const session = await getServerSession();

  let calendarSynced = false;
  let talkRoomCreated = false;

  if (session?.user?.nextcloud_user_id && session?.user?.nextcloud_app_password) {
    // Create Nextcloud client for this user
    const nextcloudClient = createNextcloudClient({
      baseUrl: process.env.NEXTCLOUD_URL || 'http://nextcloud-nginx:80',
      username: session.user.nextcloud_user_id,
      password: session.user.nextcloud_app_password,
    });

    // Sync to calendar (if enabled - default true)
    if (payload.syncToCalendar !== false) {
      try {
        await syncMeetingToNextcloud(meeting.id, nextcloudClient);
        calendarSynced = true;
        console.log(`✓ Meeting ${meeting.id} synced to Nextcloud Calendar`);
      } catch (error) {
        console.error('✗ Failed to sync meeting to calendar:', {
          meetingId: meeting.id,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        // Continue - meeting still exists, can retry sync later
      }
    }

    // Create Talk room if explicitly requested OR if online meeting (and not disabled)
    const shouldCreateTalkRoom = payload.createTalkRoom === true || (payload.isOnline && payload.createTalkRoom !== false);
    if (shouldCreateTalkRoom) {
      try {
        // Dynamic import to avoid loading Talk module unless needed
        const { createTalkRoom } = await import('@elkdonis/nextcloud/talk');

        console.log(`Creating Talk room for meeting: ${payload.title}`);

        const room = await createTalkRoom(nextcloudClient, {
          name: payload.title,
          type: 'public',
        });

        // Update meeting with Talk room token
        await db`
          UPDATE meetings
          SET nextcloud_talk_token = ${room.token}
          WHERE id = ${meeting.id}
        `;

        talkRoomCreated = true;
        console.log(`✓ Talk room created for meeting ${meeting.id}:`, {
          token: room.token,
          name: room.name,
        });
      } catch (error) {
        console.error('✗ Failed to create Talk room:', {
          meetingId: meeting.id,
          title: payload.title,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        // Continue - meeting still exists, Talk room can be created manually
      }
    }
  } else {
    console.warn('⚠ Nextcloud integration skipped: No user credentials available', {
      hasSession: !!session,
      hasUser: !!session?.user,
      hasNextcloudUserId: !!session?.user?.nextcloud_user_id,
      hasAppPassword: !!session?.user?.nextcloud_app_password,
    });
  }
  // ============ End Nextcloud Integration ============

  // Revalidate feed page
  revalidatePath("/feed");

  return {
    meetingId: meeting.id,
    calendarSynced,
    talkRoomCreated,
  };
}

export async function createPostAction(payload: {
  userId: string;
  title: string;
  body: string;
  excerpt?: string;
  visibility?: string;
  documentUrl?: string;
  createTalkRoom?: boolean;
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
  blogPassword?: string;
}) {
  // Validate required fields
  if (!payload.title?.trim()) {
    throw new Error("Post title is required");
  }

  if (!payload.body?.trim()) {
    throw new Error("Post body is required");
  }

  // Verify org access (blog password gating)
  const effectiveOrgId = payload.orgId || 'inner_group';
  const hasAccess = await verifyOrgAccess(payload.userId, effectiveOrgId, payload.blogPassword);
  if (!hasAccess) {
    throw new Error("You don't have access to publish to this organization. Please provide the correct blog password.");
  }

  let talkRoomToken: string | undefined;

  // Create Talk room if requested
  if (payload.createTalkRoom) {
    const session = await getServerSession();
    if (session?.user?.nextcloud_user_id && session?.user?.nextcloud_app_password) {
      try {
        const { createTalkRoom } = await import("@elkdonis/nextcloud");
        const client = createNextcloudClient({
          baseUrl: process.env.NEXTCLOUD_URL || 'http://nextcloud-nginx:80',
          username: session.user.nextcloud_user_id,
          password: session.user.nextcloud_app_password,
        });
        const roomName = `Post: ${payload.title.trim().slice(0, 50)}`;
        const talkRoom = await createTalkRoom(client, {
          name: roomName,
          type: 'public',
        });
        talkRoomToken = talkRoom.token;
        console.log('✓ Talk room created for post:', talkRoomToken);
      } catch (error) {
        console.error('✗ Failed to create Talk room for post:', error);
      }
    }
  }

  // Create post
  const post = await createPost({
    userId: payload.userId,
    title: payload.title.trim(),
    body: payload.body.trim(),
    excerpt: payload.excerpt?.trim(),
    visibility: payload.visibility,
    nextcloudTalkToken: talkRoomToken,
    documentUrl: payload.documentUrl,
    media: payload.media,
    orgId: payload.orgId,
  });

  // Revalidate feed page
  revalidatePath("/feed");

  return { postId: post.id, talkRoomCreated: !!talkRoomToken };
}

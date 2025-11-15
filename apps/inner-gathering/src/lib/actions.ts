"use server";

import { revalidatePath } from "next/cache";
import { createMeeting, createPost } from "./data";
import type { MeetingVisibility } from "@elkdonis/types";
import { getServerSession } from "@elkdonis/auth-server";
import { createNextcloudClient } from "@elkdonis/nextcloud";
import { syncMeetingToNextcloud } from "@elkdonis/services";
import { db } from "@elkdonis/db";

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
  // Validate required fields
  if (!payload.title?.trim()) {
    throw new Error("Meeting title is required");
  }

  if (!payload.scheduledAt) {
    throw new Error("Scheduled date/time is required");
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
  });

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

    // Create Talk room for online meetings (if enabled)
    if (payload.isOnline && payload.createTalkRoom !== false) {
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
  visibility?: "org" | "network" | "public";
}) {
  // Validate required fields
  if (!payload.title?.trim()) {
    throw new Error("Post title is required");
  }

  if (!payload.body?.trim()) {
    throw new Error("Post body is required");
  }

  // Create post
  const post = await createPost({
    userId: payload.userId,
    title: payload.title.trim(),
    body: payload.body.trim(),
    excerpt: payload.excerpt?.trim(),
    visibility: payload.visibility,
  });

  // Revalidate feed page
  revalidatePath("/feed");

  return { postId: post.id };
}

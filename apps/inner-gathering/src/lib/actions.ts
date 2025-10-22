"use server";

import { revalidatePath } from "next/cache";
import { createMeeting, createPost } from "./data";
import type { MeetingVisibility } from "@elkdonis/types";

export async function createMeetingAction(payload: {
  userId: string;
  title: string;
  startTime: string; // ISO string
  endTime?: string; // ISO string
  location?: string;
  description?: string;
  visibility?: MeetingVisibility;
  isOnline?: boolean;
  meetingUrl?: string;
  nextcloudDocumentId?: string;
  documentUrl?: string;
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

  if (!payload.startTime) {
    throw new Error("Start time is required");
  }

  // Parse dates
  const startTime = new Date(payload.startTime);
  if (Number.isNaN(startTime.getTime())) {
    throw new Error("Invalid start time");
  }

  let endTime: Date | undefined;
  if (payload.endTime) {
    endTime = new Date(payload.endTime);
    if (Number.isNaN(endTime.getTime())) {
      throw new Error("Invalid end time");
    }
  }

  // Create meeting
  const meeting = await createMeeting({
    userId: payload.userId,
    title: payload.title.trim(),
    startTime,
    endTime,
    location: payload.location?.trim(),
    description: payload.description?.trim(),
    visibility: payload.visibility,
    isOnline: payload.isOnline,
    meetingUrl: payload.meetingUrl?.trim(),
    nextcloudDocumentId: payload.nextcloudDocumentId,
    documentUrl: payload.documentUrl,
    media: payload.media,
  });

  // Revalidate feed page
  revalidatePath("/feed");

  return { meetingId: meeting.id };
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

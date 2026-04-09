"use server";

import { revalidatePath } from "next/cache";
import { createMeeting } from "./data";
import type { MeetingType, MeetingVisibility } from "@elkdonis/types";

type CreateMeetingActionPayload = {
  title: string;
  slug: string;
  orgId: string;
  guideId: string;
  meetingType: MeetingType;
  description?: string;
  scheduledAt?: string;
  durationMinutes?: number;
  location?: string;
  isOnline?: boolean;
  meetingUrl?: string;
  visibility?: MeetingVisibility;
  notes?: string;
};

export async function createMeetingAction(payload: CreateMeetingActionPayload) {
  const { orgId, guideId, title, slug, meetingType } = payload;

  // Validate required fields
  if (!orgId?.trim()) {
    throw new Error("Organization is required");
  }

  if (!guideId?.trim()) {
    throw new Error("Guide/facilitator is required");
  }

  if (!title?.trim()) {
    throw new Error("Meeting title is required");
  }

  if (!slug?.trim()) {
    throw new Error("Meeting slug is required");
  }

  if (!meetingType) {
    throw new Error("Meeting type is required");
  }

  // Parse scheduled date if provided
  let scheduledAt: Date | undefined;
  if (payload.scheduledAt) {
    scheduledAt = new Date(payload.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new Error("Invalid scheduled date");
    }
  }

  // Create meeting
  const meeting = await createMeeting({
    orgId: orgId.trim(),
    guideId: guideId.trim(),
    title: title.trim(),
    slug: slug.trim(),
    meetingType,
    description: payload.description?.trim(),
    scheduledAt,
    durationMinutes: payload.durationMinutes,
    location: payload.location?.trim(),
    isOnline: payload.isOnline ?? false,
    meetingUrl: payload.meetingUrl?.trim(),
    visibility: payload.visibility || 'org',
  });

  // Revalidate pages
  revalidatePath("/");
  revalidatePath("/dashboard");

  return { meetingId: meeting.id };
}

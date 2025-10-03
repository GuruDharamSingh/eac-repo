"use server";

import { prisma } from "@elkdonis/db";
import { revalidatePath } from "next/cache";

import { createMeeting } from "./data";
import type {
  MeetingRecurrence,
  MeetingVisibility,
} from "@elkdonis/types";

type CreateMeetingActionPayload = {
  title: string;
  description?: string;
  startTime: string;
  endTime?: string;
  orgId: string;
  videoLink?: string;
  isRSVPEnabled: boolean;
  createdBy?: string;
  location?: string;
  timeZone?: string;
  recurrencePattern?: MeetingRecurrence;
  recurrenceCustomRule?: string;
  reminderMinutesBefore?: number | string | null;
  coHosts?: string[];
  rsvpDeadline?: string;
  visibility?: MeetingVisibility;
  autoRecord?: boolean;
  tags?: string[];
  attachments?: string[];
  followUpWorkflow?: boolean;
};

const isValidRecurrence = (value: string): value is MeetingRecurrence =>
  ["NONE", "DAILY", "WEEKLY", "MONTHLY", "CUSTOM"].includes(value);

const isValidVisibility = (value: string): value is MeetingVisibility =>
  ["PUBLIC", "ORGANIZATION", "INVITE_ONLY"].includes(value);

const sanitizeStringArray = (values?: string[]) => {
  if (!values) return [];
  return values
    .map(value => value.trim())
    .filter(value => value.length > 0);
};

export async function createMeetingAction(
  payload: CreateMeetingActionPayload,
) {
  const orgId = payload.orgId?.trim();
  const title = payload.title?.trim();

  if (!orgId) {
    throw new Error("An organization is required to create a meeting.");
  }

  if (!title) {
    throw new Error("A meeting title is required.");
  }

  if (!payload.startTime) {
    throw new Error("A meeting start time is required.");
  }

  const startTime = new Date(payload.startTime);
  const endTime = payload.endTime ? new Date(payload.endTime) : undefined;

  if (Number.isNaN(startTime.getTime())) {
    throw new Error("The meeting start time is invalid.");
  }

  if (endTime && Number.isNaN(endTime.getTime())) {
    throw new Error("The meeting end time is invalid.");
  }

  const recurrencePattern = isValidRecurrence(
    payload.recurrencePattern ?? "NONE",
  )
    ? payload.recurrencePattern ?? "NONE"
    : "NONE";

  const reminderMinutesBeforeRaw = payload.reminderMinutesBefore;
  let reminderMinutesBefore: number | undefined;

  if (typeof reminderMinutesBeforeRaw === "number") {
    if (reminderMinutesBeforeRaw < 0) {
      throw new Error("Reminder minutes must be zero or greater.");
    }
    reminderMinutesBefore = reminderMinutesBeforeRaw;
  } else if (typeof reminderMinutesBeforeRaw === "string") {
    const parsed = Number(reminderMinutesBeforeRaw);
    if (!Number.isNaN(parsed)) {
      if (parsed < 0) {
        throw new Error("Reminder minutes must be zero or greater.");
      }
      reminderMinutesBefore = parsed;
    }
  }

  const rsvpDeadline = payload.rsvpDeadline
    ? new Date(payload.rsvpDeadline)
    : undefined;

  if (rsvpDeadline && Number.isNaN(rsvpDeadline.getTime())) {
    throw new Error("The RSVP deadline is invalid.");
  }

  const visibility = isValidVisibility(payload.visibility ?? "ORGANIZATION")
    ? payload.visibility ?? "ORGANIZATION"
    : "ORGANIZATION";

  const location = payload.location?.trim() || undefined;
  const timeZone = payload.timeZone?.trim() || undefined;
  const recurrenceCustomRule =
    recurrencePattern === "CUSTOM"
      ? payload.recurrenceCustomRule?.trim() || undefined
      : undefined;
  const coHostIds = sanitizeStringArray(payload.coHosts);
  const tags = sanitizeStringArray(payload.tags);
  const attachments = sanitizeStringArray(payload.attachments);
  const autoRecord = payload.autoRecord ?? false;
  const followUpWorkflow = payload.followUpWorkflow ?? false;

  let createdBy = payload.createdBy?.trim();

  if (!createdBy) {
    const membership = await prisma.userOrganization.findFirst({
      where: { orgId },
      select: { userId: true },
    });

    if (membership) {
      createdBy = membership.userId;
    } else {
      const fallbackUser = await prisma.user.findFirst({
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });

      if (!fallbackUser) {
        throw new Error(
          "Unable to create meeting: no users exist to assign as the creator.",
        );
      }

      createdBy = fallbackUser.id;
    }
  }

  const meeting = await createMeeting({
    title,
    description: payload.description?.trim() || undefined,
    startTime,
    endTime,
    orgId,
    createdBy,
    videoLink: payload.videoLink?.trim() || undefined,
    isRSVPEnabled: payload.isRSVPEnabled,
    location,
    timeZone,
    recurrencePattern,
    recurrenceCustomRule,
    reminderMinutesBefore,
    coHostIds,
    rsvpDeadline,
    visibility,
    autoRecord,
    tags,
    attachments,
    followUpWorkflow,
  });

  revalidatePath("/");
  revalidatePath("/dashboard");

  return { meetingId: meeting.id };
}

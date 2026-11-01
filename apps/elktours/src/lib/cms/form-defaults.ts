/**
 * Initial values for the content form.
 *
 * Kept out of content-form.tsx deliberately: that file is `"use client"`, and
 * anything exported from a client module can only be *rendered* by a server
 * component, not called by one. The /manage/content/new page needs to build
 * these defaults server-side, so they live here.
 */

import type { MaterialItem } from "@/components/manage/materials-field";

export interface ContentFormDefaults {
  id?: string;
  kind: "post" | "meeting";
  feedSlug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl: string;
  materials: MaterialItem[];
  createDocument: boolean;
  createTalkRoom: boolean;
  /** Set once provisioned, so the form can link to them instead of re-offering. */
  documentUrl: string;
  talkToken: string;
  status: "draft" | "published";
  visibility: "PUBLIC" | "ORGANIZATION" | "INVITE_ONLY";
  scheduledAt: string;
  durationMinutes: string;
  location: string;
  isOnline: boolean;
  meetingUrl: string;
  videoLink: string;
  recurrencePattern: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  recurrenceUntil: string;
  isRsvpEnabled: boolean;
  rsvpDeadline: string;
  attendeeLimit: string;
  minAttendees: string;
  notifyOnMinAttendees: boolean;
}

export function emptyDefaults(feedSlug: string): ContentFormDefaults {
  return {
    kind: "post",
    feedSlug,
    title: "",
    excerpt: "",
    body: "",
    coverImageUrl: "",
    materials: [],
    createDocument: false,
    createTalkRoom: false,
    documentUrl: "",
    talkToken: "",
    status: "draft",
    visibility: "PUBLIC",
    scheduledAt: "",
    durationMinutes: "",
    location: "",
    isOnline: false,
    meetingUrl: "",
    videoLink: "",
    recurrencePattern: "NONE",
    recurrenceUntil: "",
    isRsvpEnabled: true,
    rsvpDeadline: "",
    attendeeLimit: "",
    minAttendees: "",
    notifyOnMinAttendees: false,
  };
}

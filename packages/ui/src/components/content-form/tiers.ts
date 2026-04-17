import type { TierName } from "./types";

/**
 * Ordered tier list — drives the progressive scroll layout.
 * Each tier's fields (as keys on ContentDraft) are declared here so the
 * form can render collapsed previews and decide when a tier is "touched."
 */
export const TIER_ORDER: TierName[] = ["post", "schedule", "rsvp", "workshop"];

export const TIER_LABEL: Record<TierName, string> = {
  post: "Post",
  schedule: "Meeting",
  rsvp: "Event",
  workshop: "Workshop",
};

export const TIER_HINT: Record<TierName, string> = {
  post: "Title, body, and (optionally) when to publish.",
  schedule: "Add a meeting time, duration, and location.",
  rsvp: "Open RSVPs, set a cap or minimum attendees.",
  workshop: "Curriculum, sessions, pricing, and a pitch.",
};

export const TIER_FIELDS: Record<TierName, string[]> = {
  post: ["title", "body", "publishAt"],
  schedule: [
    "isMeeting",
    "meetingTimeLabel",
    "scheduledAt",
    "durationMinutes",
    "location",
    "isOnline",
  ],
  rsvp: ["isRsvpEnabled", "attendeeLimit", "rsvpDeadline", "minAttendees"],
  workshop: ["pitch", "price", "flyerUrl", "sessions"],
};

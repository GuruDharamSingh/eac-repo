// ============================================================================
// Example data for the event blocks.
//
// Shown only in the page editor, when there is no event to draw (a template
// opened before any gathering exists, or a thread-less page). A published page
// never shows it: the loader returns null and the view says there is nothing
// scheduled. Dates are fixed ISO strings so the editor canvas is stable.
// ============================================================================

export interface WireEvent {
  id: string;
  title: string;
  slug: string;
  kind: string;
  feedSlug: string | null;
  feedName: string | null;
  descriptionHtml: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  location: string | null;
  isOnline: boolean;
  meetingUrl: string | null;
  scheduledAt: string | null;
  durationMinutes: number | null;
  recurrencePattern: string | null;
  authorName: string | null;
  authorSlug: string | null;
  /** Null unless this viewer may be given the room (see data-event.ts). */
  talkUrl: string | null;
  hasRoom: boolean;
  canCreateRoom: boolean;
  isRsvpEnabled: boolean;
  attendeeLimit: number | null;
  attendanceCount: number;
  alreadyAttending: boolean;
  cancelled: boolean;
  signedIn: boolean;
  isMember: boolean;
  materials: Array<{ id: string; url: string; filename: string; size: number | null }>;
  attendees: Array<{ name: string; isMember: boolean; photoUrl: string | null }>;
}

export const SAMPLE_EVENT: WireEvent = {
  id: "sample-event",
  title: "Ritual Theatre Lab",
  slug: "ritual-theatre-lab",
  kind: "meeting",
  feedSlug: "gatherings",
  feedName: "Gatherings",
  descriptionHtml:
    "<p>A weekly lab for movement, voice and presence. Bring comfortable clothes and something to write with.</p>",
  excerpt: null,
  coverImageUrl: null,
  location: null,
  isOnline: true,
  meetingUrl: null,
  scheduledAt: "2026-10-09T00:30:00.000Z",
  durationMinutes: 90,
  recurrencePattern: "WEEKLY",
  authorName: "Your host",
  authorSlug: null,
  talkUrl: null,
  hasRoom: false,
  canCreateRoom: false,
  isRsvpEnabled: true,
  attendeeLimit: null,
  attendanceCount: 3,
  alreadyAttending: false,
  cancelled: false,
  signedIn: false,
  isMember: false,
  materials: [{ id: "m1", url: "#", filename: "Reading for this week.pdf", size: 240000 }],
  attendees: [],
};

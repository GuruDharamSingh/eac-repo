/**
 * View-model types for the site.
 *
 * Deliberately local rather than from @elkdonis/types: that package still
 * models the pre-migration-030 `Post`/`Meeting` shapes (and its PostVisibility
 * disagrees with the DB's CHECK constraint), so mapping from `threads` in
 * lib/data.ts and typing the result here is the honest option. Same call
 * arts-collective made.
 */

export type ThreadCycleStatus = "confirmed" | "cancelled" | "pending";

export interface Thread {
  id: string;
  title: string;
  slug: string;
  /** post | meeting | event | workshop */
  kind: string;
  /** org_feeds.slug this belongs to, or null if unfiled. */
  feedSlug: string | null;
  status: string;
  visibility: string;
  /** threads.body — rich text HTML. */
  description: string | null;
  excerpt: string | null;
  coverImageUrl: string | null;
  /** IANA zone the author entered the time in (metadata.timeZone). Null means the site's. */
  timeZone: string | null;
  location: string | null;
  isOnline: boolean;
  meetingUrl: string | null;
  videoLink: string | null;
  /** Nextcloud collaborative document, when one was provisioned. */
  documentUrl: string | null;
  /** Nextcloud Talk room token, when one was provisioned. */
  talkToken: string | null;
  scheduledAt: Date | null;
  durationMinutes: number | null;
  isRsvpEnabled: boolean;
  rsvpDeadline: Date | null;
  attendeeLimit: number | null;
  minAttendees: number | null;
  notifyOnMinAttendees: boolean;
  recurrencePattern: string | null;
  recurrenceUntil: Date | null;
  authorId: string | null;
  authorName: string | null;
  authorSlug: string | null;
  authorPhoto: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  /** The occurrence currently in play — rolls forward each cycle for recurring meetings. */
  nextOccurrenceAt: Date | null;
}

export interface GuideSocialLink {
  label?: string;
  url?: string;
}

export interface Guide {
  userId: string;
  slug: string;
  displayName: string;
  roleTitle: string | null;
  bio: string | null;
  photoUrl: string | null;
  city: string | null;
  socialLinks: GuideSocialLink[];
  sortOrder: number;
}

/** A downloadable file attached to a thread (media.attached_to_id). */
export interface Material {
  id: string;
  url: string;
  filename: string;
  mimeType: string | null;
  size: number | null;
}

/** org_site_sections content, keyed by section_key. */
export type SiteSections = Record<string, Record<string, string>>;

/** Combined member + guest attendance for a thread. */
export interface Attendee {
  name: string;
  /** Members have an account; guests RSVP'd by email only. */
  isMember: boolean;
  photoUrl: string | null;
  guideSlug: string | null;
  respondedAt: Date;
}

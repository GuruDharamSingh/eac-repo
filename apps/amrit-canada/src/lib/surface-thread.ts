import type { SurfaceThread } from "@elkdonis/cms-ui/surface";
import type { Thread, ThreadCycleStatus } from "@/lib/types";

/**
 * This site's `Thread` view-model → the shared `SurfaceThread`.
 *
 * One mapping, used by the hub API route (for popups) and the detail page
 * (for the page-size surface), so the popup and the page cannot disagree
 * about what a gathering is. The surface never sees this app's column names.
 */
export function toSurfaceThread(
  thread: Thread,
  extras: {
    feed?: { slug: string; name: string } | null;
    rsvpCount: number;
    viewerAttending: boolean | null;
    cycleStatus: ThreadCycleStatus | null;
  }
): SurfaceThread {
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return {
    id: thread.id,
    title: thread.title,
    slug: thread.slug,
    kind: thread.kind,
    status: thread.status,
    visibility: thread.visibility,
    feed: extras.feed ?? null,
    excerpt: thread.excerpt,
    bodyHtml: thread.description,
    coverImageUrl: thread.coverImageUrl,
    author: { name: thread.authorName, photo: thread.authorPhoto },
    publishedAt: iso(thread.publishedAt),
    scheduledAt: iso(thread.scheduledAt),
    nextOccurrenceAt: iso(thread.nextOccurrenceAt),
    durationMinutes: thread.durationMinutes,
    location: thread.location,
    // This site stores a boolean; the surface speaks the shared vocabulary.
    format: thread.isOnline ? (thread.location ? "hybrid" : "online") : "in_person",
    meetingUrl: thread.meetingUrl,
    talkToken: thread.talkToken,
    recurrencePattern: thread.recurrencePattern,
    recurrenceUntil: iso(thread.recurrenceUntil),
    cycleStatus: extras.cycleStatus,
    isRsvpEnabled: thread.isRsvpEnabled,
    attendeeLimit: thread.attendeeLimit,
    rsvpDeadline: iso(thread.rsvpDeadline),
    rsvpCount: extras.rsvpCount,
    viewerAttending: extras.viewerAttending,
    documentUrl: thread.documentUrl,
    videoLink: thread.videoLink,
    href: thread.feedSlug ? `/${thread.feedSlug}/${thread.slug}` : null,
    extra: {
      time_zone: thread.timeZone,
      min_attendees: thread.minAttendees,
      notify_on_min_attendees: thread.notifyOnMinAttendees,
    },
  };
}

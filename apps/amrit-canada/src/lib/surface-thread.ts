import { toSurfaceThread as sharedToSurfaceThread } from "@elkdonis/cms-ui/surface";
import type { ThreadCycleStatus } from "@/lib/types";
import type { Thread } from "@/lib/types";

/**
 * This site's `Thread` view-model → the shared `SurfaceThread`.
 *
 * The mapping itself is `@elkdonis/cms-ui/surface`'s `toSurfaceThread` — this
 * app, innergathering and hidden-enneagram each carried their own copy of it
 * (229 lines total; two were byte-identical). What is left here is what is
 * genuinely this site's own: deriving `format` from the boolean+location this
 * schema stores it as, this site's own URL scheme, and the extra fields its
 * own `threadToAnswers` reads back.
 */
export function toSurfaceThread(
  thread: Thread,
  extras: {
    feed?: { slug: string; name: string } | null;
    rsvpCount: number;
    viewerAttending: boolean | null;
    cycleStatus: ThreadCycleStatus | null;
    /** This is the org's featured (standing) meeting. */
    standing?: boolean;
  }
) {
  return sharedToSurfaceThread(
    {
      id: thread.id,
      title: thread.title,
      slug: thread.slug,
      kind: thread.kind,
      status: thread.status,
      visibility: thread.visibility,
      excerpt: thread.excerpt,
      bodyHtml: thread.description,
      coverImageUrl: thread.coverImageUrl,
      authorName: thread.authorName,
      authorId: thread.authorId ?? null,
      authorPhoto: thread.authorPhoto,
      publishedAt: thread.publishedAt,
      scheduledAt: thread.scheduledAt,
      nextOccurrenceAt: thread.nextOccurrenceAt,
      durationMinutes: thread.durationMinutes,
      location: thread.location,
      // This site stores a boolean; the surface speaks the shared vocabulary.
      format: thread.isOnline ? (thread.location ? "hybrid" : "online") : "in_person",
      meetingUrl: thread.meetingUrl,
      talkToken: thread.talkToken,
      recurrencePattern: thread.recurrencePattern,
      recurrenceUntil: thread.recurrenceUntil,
      isRsvpEnabled: thread.isRsvpEnabled,
      attendeeLimit: thread.attendeeLimit,
      rsvpDeadline: thread.rsvpDeadline,
      documentUrl: thread.documentUrl,
      videoLink: thread.videoLink,
      href: thread.feedSlug ? `/${thread.feedSlug}/${thread.slug}` : null,
    },
    {
      feed: extras.feed,
      rsvpCount: extras.rsvpCount,
      viewerAttending: extras.viewerAttending,
      cycleStatus: extras.cycleStatus,
      standing: extras.standing,
      extra: {
        time_zone: thread.timeZone,
        min_attendees: thread.minAttendees,
        notify_on_min_attendees: thread.notifyOnMinAttendees,
      },
    }
  );
}

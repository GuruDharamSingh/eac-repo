import type { SurfaceThread } from "@elkdonis/cms-ui/surface";
import type { Thread } from "@/lib/types";

/**
 * This site's `Thread` view-model → the shared `SurfaceThread`.
 *
 * One mapping, used by the hub API route (for popups) and by the detail page,
 * so a popup and a page cannot disagree about what a piece of content is. The
 * surface never sees this app's column names.
 *
 * This site publishes writing and offerings, not gatherings: there are no
 * scheduling, recurrence or RSVP columns on its threads. The corresponding
 * surface fields are therefore null rather than faked, which is what makes the
 * surface hide those sections instead of rendering empty ones.
 */
export function toSurfaceThread(
  thread: Thread,
  extras: { feed?: { slug: string; name: string } | null } = {}
): SurfaceThread {
  const iso = (d: Date | string | null | undefined) =>
    d ? (d instanceof Date ? d.toISOString() : String(d)) : null;

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

    // Not scheduled content — see the note above.
    scheduledAt: null,
    nextOccurrenceAt: null,
    durationMinutes: null,
    location: null,
    format: null,
    meetingUrl: null,
    talkToken: null,
    recurrencePattern: null,
    recurrenceUntil: null,
    cycleStatus: null,
    isRsvpEnabled: false,
    attendeeLimit: null,
    rsvpDeadline: null,
    rsvpCount: 0,
    viewerAttending: null,
    documentUrl: null,
    videoLink: null,

    // Threads live under their feed on this site: /{section}/{slug}.
    href: thread.feedSlug ? `/${thread.feedSlug}/${thread.slug}` : null,
  };
}

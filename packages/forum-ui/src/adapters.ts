import type { ForumThreadRecord } from "@elkdonis/services";
import type { SurfaceThread } from "@elkdonis/cms-ui/surface";
import { mediaUrl } from "./media";

/**
 * A forum thread as the surface layer sees it, so the thread page's masthead
 * and facts rail are the same rendering an org site's popup and page use.
 */
export function toSurfaceThread(t: ForumThreadRecord, href: string): SurfaceThread {
  return {
    id: t.id,
    title: t.title,
    slug: t.slug,
    kind: t.kind,
    visibility: t.visibility,
    feed: { slug: t.feed.slug, name: t.feed.name ?? t.feed.slug },
    excerpt: null, // the row excerpt is derived from the body; showing it again above the body would repeat it
    bodyHtml: t.bodyHtml,
    coverImageUrl: mediaUrl(t.coverImageUrl),
    // The forum draws its own byline above the body; leaving these out keeps
    // the surface's dateline from repeating it.
    author: null,
    publishedAt: null,
    scheduledAt: t.scheduledAt ? new Date(t.scheduledAt).toISOString() : null,
    durationMinutes: t.durationMinutes,
    location: t.location,
    format: t.isOnline == null ? null : t.isOnline ? "online" : "in_person",
    meetingUrl: t.meetingUrl,
    talkToken: t.talkToken,
    recurrencePattern: t.recurrencePattern,
    recurrenceUntil: t.recurrenceUntil ? new Date(t.recurrenceUntil).toISOString() : null,
    isRsvpEnabled: t.isRsvpEnabled,
    attendeeLimit: t.attendeeLimit,
    rsvpDeadline: t.rsvpDeadline ? new Date(t.rsvpDeadline).toISOString() : null,
    rsvpCount: t.rsvpCount,
    viewerAttending: t.viewerAttending,
    documentUrl: t.documentUrl,
    videoLink: t.videoLink,
    href,
  };
}

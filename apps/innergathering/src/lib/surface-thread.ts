import type { SurfaceThread } from "@elkdonis/cms-ui/surface";
import type { WorkshopOffering } from "@elkdonis/services";
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
    /** The workshop_pages row and sessions, when the thread is a workshop. */
    workshop?: WorkshopOffering | null;
  }
): SurfaceThread {
  const w = extras.workshop ?? null;
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
    price: w?.price ?? null,
    currency: w?.currency ?? null,
    sessions: w
      ? w.sessions.map((s) => ({
          title: s.title,
          startsAt: s.scheduledAt,
          durationMinutes: s.durationMinutes,
          location: s.isOnline ? "Online" : s.location || null,
        }))
      : null,
    extra: {
      time_zone: thread.timeZone,
      min_attendees: thread.minAttendees,
      notify_on_min_attendees: thread.notifyOnMinAttendees,
      ...(w
        ? {
            subtitle: w.subtitle ?? "",
            discipline: w.discipline ?? "",
            level: w.level ?? "",
            banner_image_url: w.bannerImageUrl ?? "",
            banner_focal_y: w.bannerFocalY,
            hero_media_url: w.heroMediaUrl ?? "",
            hero_text: w.heroText ?? "",
            background_color: w.backgroundColor ?? "",
            // The editor's shape: wall-clock strings, not instants.
            sessions: w.sessions.map((s) => ({
              id: s.id,
              title: s.title,
              description: s.description,
              scheduledAt: s.scheduledAt ? localInput(s.scheduledAt) : null,
              durationMinutes: s.durationMinutes,
              isOnline: s.isOnline,
              location: s.location,
              videoConferenceUrl: s.videoConferenceUrl,
              mediaUrl: s.mediaUrl,
              videoUrl: s.videoUrl,
              backgroundColor: s.backgroundColor,
              resources: s.resources,
            })),
          }
        : {}),
    },
  };
}

/** An instant as the `datetime-local` value it reads as in Toronto. */
function localInput(isoValue: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(isoValue));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

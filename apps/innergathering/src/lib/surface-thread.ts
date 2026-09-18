import { toSurfaceThread as sharedToSurfaceThread } from "@elkdonis/cms-ui/surface";
import type { WorkshopOffering } from "@elkdonis/services";
import type { Thread, ThreadCycleStatus } from "@/lib/types";

/**
 * This site's `Thread` view-model → the shared `SurfaceThread`.
 *
 * The mapping itself is `@elkdonis/cms-ui/surface`'s `toSurfaceThread` — see
 * the note in amrit-canada's copy of this file for why. What is left here is
 * this site's own: the boolean→format derivation, its URL scheme, the extra
 * fields its own `threadToAnswers` reads back, and workshop pricing/sessions,
 * which nowhere else in the network has.
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
    /** The workshop_pages row and sessions, when the thread is a workshop. */
    workshop?: WorkshopOffering | null;
  }
) {
  const w = extras.workshop ?? null;

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
    }
  );
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

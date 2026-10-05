import {
  getAttendanceCount,
  getCycleStatus,
  getThreadById,
  getThreadMaterials,
  getThreadRsvpForUser,
  getUpcomingThreads,
  listAttendees,
} from "@/lib/data";
import { getViewer } from "@/lib/auth";
import type { Thread } from "@/lib/types";
import type { WireEvent } from "@/blocks/event-sample";
import { siteConfig } from "@/config/site";
import { listOrgFeeds } from "@elkdonis/services";

// ============================================================================
// The event behind the event blocks.
//
// Published: the event route passes `metadata.threadId`, so every block on the
// template draws the thread being visited. Without one (a block placed on an
// ordinary page, or the editor canvas) it draws the next upcoming gathering.
//
// Per viewer, read per request: the Talk room URL is included only for people
// the block's "members only" setting allows, so it is never in the HTML of a
// page it is not for. Editors always get it. The attendee list is members' only,
// as on the thread page.
// ============================================================================

const toIso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

export async function loadEvent(
  ctx: Record<string, unknown>,
  props: Record<string, unknown>
): Promise<{ event: WireEvent | null }> {
  const viewer = await getViewer().catch(() => null);

  let thread: Thread | null = null;
  if (typeof ctx.threadId === "string" && ctx.threadId) {
    const t = await getThreadById(ctx.threadId);
    // Anyone may see a published thread; a draft only its editors.
    if (t && (t.status === "published" || viewer?.canEdit)) thread = t;
  } else {
    thread = (await getUpcomingThreads(1))[0] ?? null;
  }
  if (!thread) return { event: null };

  const [feeds, attendanceCount, cycle, alreadyAttending, materials, attendees] = await Promise.all([
    listOrgFeeds(siteConfig.orgId, { includePrivate: true }).catch(() => []),
    thread.isRsvpEnabled ? getAttendanceCount(thread) : Promise.resolve(0),
    thread.scheduledAt ? getCycleStatus(thread) : Promise.resolve("pending" as const),
    viewer ? getThreadRsvpForUser(thread, viewer.userId) : Promise.resolve(false),
    getThreadMaterials(thread.id),
    viewer?.isMember ? listAttendees(thread) : Promise.resolve([]),
  ]);

  const nextcloud = process.env.NEXT_PUBLIC_NEXTCLOUD_URL?.replace(/\/$/, "");
  const roomAllowed = props.membersOnly === false || Boolean(viewer?.isAffiliate) || Boolean(viewer?.canEdit);
  const feed = feeds.find((f) => f.slug === thread!.feedSlug);
  // Some gatherings hold their join link in the location field (the standing
  // meeting's was "https://…zoom… to start or join"). A link is not a place:
  // it makes the event online and is not printed as an address.
  const locationIsLink = /^https?:\/\//i.test(thread.location ?? "");

  return {
    event: {
      id: thread.id,
      title: thread.title,
      slug: thread.slug,
      kind: thread.kind,
      feedSlug: thread.feedSlug,
      feedName: feed?.name ?? null,
      descriptionHtml: thread.description ?? "",
      excerpt: thread.excerpt,
      coverImageUrl: thread.coverImageUrl,
      location: locationIsLink ? null : thread.location,
      isOnline: thread.isOnline || locationIsLink || Boolean(thread.meetingUrl),
      meetingUrl: roomAllowed ? thread.meetingUrl : null,
      scheduledAt: toIso(thread.nextOccurrenceAt ?? thread.scheduledAt),
      durationMinutes: thread.durationMinutes,
      recurrencePattern: thread.recurrencePattern,
      authorName: thread.authorName,
      authorSlug: thread.authorSlug,
      talkUrl: thread.talkToken && nextcloud && roomAllowed ? `${nextcloud}/call/${thread.talkToken}` : null,
      hasRoom: Boolean(thread.talkToken),
      canCreateRoom: Boolean(viewer?.canEdit) && !thread.talkToken,
      isRsvpEnabled: thread.isRsvpEnabled,
      attendeeLimit: thread.attendeeLimit,
      attendanceCount,
      alreadyAttending,
      cancelled: cycle === "cancelled",
      signedIn: Boolean(viewer),
      isMember: Boolean(viewer?.isMember),
      materials: materials.map((m) => ({ id: m.id, url: m.url, filename: m.filename, size: m.size })),
      attendees: attendees.map((a) => ({ name: a.name, isMember: a.isMember, photoUrl: a.photoUrl })),
    },
  };
}

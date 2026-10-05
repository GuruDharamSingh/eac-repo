import { NextResponse, type NextRequest } from "next/server";
import { toSurfaceThread } from "@elkdonis/cms-ui/surface";
import { canViewFeed, countConfirmedRsvps, getOrgFeed, getRsvpStatus } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";
import { getThreadById } from "@/lib/data";

/**
 * One thread in the shape the shared pop-up renders (the read half of the
 * surface system). Published PUBLIC threads only; a thread filed in a feed
 * with a min_role (a circle's discussion) reads only for those the feed lets
 * in. 404 either way, so a hidden thread does not confirm it exists.
 */
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer().catch(() => null);
  const thread = await getThreadById(id, { orgVisible: Boolean(viewer?.isAffiliate) });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const feed = thread.feedSlug ? await getOrgFeed(siteConfig.orgId, thread.feedSlug).catch(() => null) : null;
  if (feed && !canViewFeed(feed, viewer?.role ?? null)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [rsvpCount, status] = await Promise.all([
    countConfirmedRsvps(thread.id).catch(() => 0),
    viewer ? getRsvpStatus(thread.id, viewer.userId).catch(() => null) : Promise.resolve(null),
  ]);

  return NextResponse.json(
    toSurfaceThread(
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
        authorId: thread.authorId,
        authorPhoto: thread.authorPhoto,
        publishedAt: thread.publishedAt,
        scheduledAt: thread.scheduledAt,
        nextOccurrenceAt: thread.nextOccurrenceAt,
        durationMinutes: thread.durationMinutes,
        location: thread.location,
        format: thread.isOnline ? (thread.location ? "hybrid" : "online") : "in_person",
        meetingUrl: thread.meetingUrl,
        talkToken: thread.talkToken,
        recurrencePattern: thread.recurrencePattern,
        isRsvpEnabled: thread.isRsvpEnabled,
        attendeeLimit: thread.attendeeLimit,
        rsvpDeadline: thread.rsvpDeadline,
        // The document share is writable by anyone holding the link: people with a role here only.
        documentUrl: viewer?.isAffiliate ? thread.documentUrl : null,
        videoLink: thread.videoLink,
        href: thread.feedSlug ? `/${thread.feedSlug}/${thread.slug}` : null,
      },
      {
        feed: feed ? { slug: feed.slug, name: feed.name } : null,
        rsvpCount,
        viewerAttending: viewer ? status === "yes" : null,
      }
    )
  );
}

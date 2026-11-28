import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import { getForumThread } from "@elkdonis/services";
import { toSurfaceThread } from "@elkdonis/cms-ui/surface";
import { getHubForumViewer } from "@/lib/hub-forum";
import { resolveOrgHomeUrl } from "@/lib/org-url.server";

/**
 * One forum topic, in the shape the shared thread surface renders (the read half of a forum row's popup).
 *
 * Access is the FORUM's, from the SESSION: `getForumThread` applies `visibleTo` (published and public, or the
 * viewer's org membership / min role / authorship), so a topic of an org this viewer may not see is a 404,
 * which also means an unpublished or members-only item never confirms it exists. It does not cover drafts: an
 * editor's drafts open through the console's own /api/org/<slug>/threads/<id>, which stays the default
 * loader (see the wiring note: this route is tried first for forum rows only).
 */
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getHubForumViewer();
  const t = await getForumThread(id, viewer);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const metaRows = await db<Array<{ status: string }>>`SELECT status FROM threads WHERE id = ${id}`.catch(
    () => [] as Array<{ status: string }>
  );
  const home = await resolveOrgHomeUrl(t.org.slug).catch(() => "");
  const mine = (viewer.identityIds ?? (viewer.userId ? [viewer.userId] : [])).includes(t.author.id);

  return NextResponse.json(
    toSurfaceThread(
      {
        id: t.id,
        title: t.title,
        slug: t.slug,
        kind: t.kind,
        status: metaRows[0]?.status ?? "published",
        visibility: t.visibility,
        excerpt: t.excerpt,
        bodyHtml: t.bodyHtml,
        coverImageUrl: t.coverImageUrl,
        authorName: t.author.name,
        authorPhoto: t.author.avatarUrl,
        authorId: mine && viewer.userId ? viewer.userId : t.author.id,
        publishedAt: t.publishedAt,
        scheduledAt: t.scheduledAt,
        durationMinutes: t.durationMinutes,
        location: t.location,
        format: t.isOnline ? (t.location ? "hybrid" : "online") : t.location ? "in_person" : null,
        meetingUrl: t.meetingUrl,
        talkToken: t.talkToken,
        recurrencePattern: t.recurrencePattern,
        recurrenceUntil: t.recurrenceUntil,
        isRsvpEnabled: t.isRsvpEnabled,
        attendeeLimit: t.attendeeLimit,
        rsvpDeadline: t.rsvpDeadline,
        documentUrl: t.documentUrl,
        videoLink: t.videoLink,
        // The topic's own page on its org's site, when there is one.
        href: home && t.slug ? `${home}/${t.slug}` : null,
      },
      {
        feed: t.feed.slug ? { slug: t.feed.slug, name: t.feed.name ?? t.feed.slug } : null,
        rsvpCount: t.rsvpCount,
        viewerAttending: t.viewerAttending,
        extra: { pinned: t.pinned, orgSlug: t.org.slug },
      }
    )
  );
}

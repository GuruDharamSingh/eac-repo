import { NextResponse, type NextRequest } from "next/server";
import { createThreadAdminRoutes, getStandingMeetingId } from "@elkdonis/services";
import { getGathering, getOrgFeed, getWorkshopOfferingById } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { termHref, threadHref } from "@/lib/gather";
import { getViewer } from "@/lib/auth";
import {
  getAttendanceCount,
  getCycleStatus,
  getThreadById,
  getThreadRsvpForUser,
} from "@/lib/data";
import { toSurfaceThread } from "@/lib/surface-thread";

/**
 * One thread, in the shape the shared surface renders.
 *
 * This is the read half of every popup on the site: a face knows a title and
 * a date, the surface needs the rest. Access follows the thread, not the
 * route — a published PUBLIC thread reads for anyone (it is on the public
 * page already), ORGANIZATION visibility needs a member, and drafts need an
 * editor. That is what lets a listing card on a public feed page open the
 * same surface a hub tile does.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const viewer = await getViewer().catch(() => null);

  const thread = await getThreadById(id);
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const published = thread.status === "published";
  const allowed =
    (published && thread.visibility === "PUBLIC") ||
    // A follower (viewer role) reads ORGANIZATION threads too — decision 6.
    (published && thread.visibility === "ORGANIZATION" && Boolean(viewer?.isAffiliate)) ||
    Boolean(viewer?.canEdit);
  // 404 rather than 403: an unpublished item should not confirm it exists.
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [feed, rsvpCount, viewerAttending, cycleStatus, workshop, gathering] = await Promise.all([
    thread.feedSlug ? getOrgFeed(siteConfig.orgId, thread.feedSlug) : null,
    getAttendanceCount(thread),
    viewer ? getThreadRsvpForUser(thread, viewer.userId) : Promise.resolve(null),
    getCycleStatus(thread),
    thread.kind === "workshop" ? getWorkshopOfferingById(siteConfig.orgId, thread.id).catch(() => null) : Promise.resolve(null),
    // What this thread holds. `isMember` — not the thread's visibility and not
    // merely being signed in — is what decides whether a living document's URL
    // comes down with it; that share is public and writable.
    getGathering(thread.id, {
      viewerUserId: viewer?.userId ?? null,
      isMember: Boolean(viewer?.isMember),
      orgId: siteConfig.orgId,
      hrefFor: threadHref,
      termHref,
      // Files dropped into the thread's folder list beside the edges.
      withFolder: true,
    }),
  ]);

  return NextResponse.json(
    toSurfaceThread(thread, {
      // The org's featured meeting — so the popup can offer to feature/unfeature.
      standing: (thread.kind === "meeting" || thread.kind === "event") && (await getStandingMeetingId(siteConfig.orgId)) === thread.id,
      feed: feed ? { slug: feed.slug, name: feed.name } : null,
      rsvpCount,
      viewerAttending,
      cycleStatus,
      workshop,
      ...gathering,
    })
  );
}

/**
 * Remove (author or editor) and feature-as-weekly-meeting (editor) — the
 * shared rule in @elkdonis/services; this file supplies only who and where.
 */
export const { DELETE, PATCH } = createThreadAdminRoutes({
  orgId: siteConfig.orgId,
  viewer: async () => {
    const v = await getViewer();
    return v ? { userId: v.userId, canEdit: Boolean(v.canEdit) } : null;
  },
});

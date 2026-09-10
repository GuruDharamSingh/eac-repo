import { NextResponse, type NextRequest } from "next/server";
import { getOrgFeed } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
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
    (published && thread.visibility === "ORGANIZATION" && Boolean(viewer?.isMember)) ||
    Boolean(viewer?.canEdit);
  // 404 rather than 403: an unpublished item should not confirm it exists.
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [feed, rsvpCount, viewerAttending, cycleStatus] = await Promise.all([
    thread.feedSlug ? getOrgFeed(siteConfig.orgId, thread.feedSlug) : null,
    getAttendanceCount(thread),
    viewer ? getThreadRsvpForUser(thread, viewer.userId) : Promise.resolve(null),
    getCycleStatus(thread),
  ]);

  return NextResponse.json(
    toSurfaceThread(thread, {
      feed: feed ? { slug: feed.slug, name: feed.name } : null,
      rsvpCount,
      viewerAttending,
      cycleStatus,
    })
  );
}

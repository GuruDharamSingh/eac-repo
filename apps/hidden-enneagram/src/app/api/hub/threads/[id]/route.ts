import { NextResponse, type NextRequest } from "next/server";
import { getOrgFeed } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";
import { getThreadById } from "@/lib/data";
import { toSurfaceThread } from "@/lib/surface-thread";

/**
 * One thread, in the shape the shared surface renders.
 *
 * The read half of every popup on the site: a card knows a title and a date,
 * the surface needs the rest.
 *
 * Access follows the THREAD, not the route — a published PUBLIC thread reads
 * for anyone (it is already on a public page), ORGANIZATION visibility needs a
 * member, and anything unpublished needs an editor. That is what lets a card
 * on a public feed page open the same surface a hub tile does.
 *
 * `getThreadById` is deliberately unfiltered, so this route is where the gate
 * lives. 404 rather than 403 throughout: an unpublished item should not
 * confirm that it exists.
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
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const feed = thread.feedSlug
    ? await getOrgFeed(siteConfig.orgId, thread.feedSlug)
    : null;

  return NextResponse.json(
    toSurfaceThread(thread, {
      feed: feed ? { slug: feed.slug, name: feed.name } : null,
    })
  );
}

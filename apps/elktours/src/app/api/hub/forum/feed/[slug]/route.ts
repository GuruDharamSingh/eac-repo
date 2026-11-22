import { NextResponse } from "next/server";
import { forumFeedThreads } from "@elkdonis/forum-ui";
import { forumHrefs, getForumViewer } from "@/lib/forum";
import { siteConfig } from "@/config/site";

/** GET -> the topics in one section, newest activity first (the surface's `listFeed` and the section page). */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rows = await forumFeedThreads({ scope: { kind: "org", orgId: siteConfig.orgId }, viewer: await getForumViewer(), hrefs: forumHrefs, feedSlug: slug, limit: 40 });
  return NextResponse.json(rows);
}

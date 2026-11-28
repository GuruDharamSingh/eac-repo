import { NextResponse, type NextRequest } from "next/server";
import { getHubForumOrg, getHubForumViewer, hubForumFeed } from "@/lib/hub-forum";

/** GET ?org=<slug>&slug=<section> -> the topics of ONE section, for the forum surface's section layer (`listFeed`). */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const org = await getHubForumOrg(q.get("org") ?? "");
  const feed = q.get("slug") ?? "";
  if (!org || !feed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await hubForumFeed(org, await getHubForumViewer(), feed));
}

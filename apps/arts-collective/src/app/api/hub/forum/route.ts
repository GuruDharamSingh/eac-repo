import { NextResponse, type NextRequest } from "next/server";
import { getHubForumOrg, getHubForumViewer, hubForumSnapshot } from "@/lib/hub-forum";

/**
 * GET ?org=<slug> -> that org's forum as one snapshot, for the hub's forum face and surface
 * (the same object, so the face and the popup it opens agree). Counts are per viewer: a signed-out reader
 * sees the public board's numbers, a member theirs. The viewer is the session's; the org comes from the
 * query only to say WHICH board, and `visibleTo` in the services decides what of it this viewer sees.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const org = await getHubForumOrg(request.nextUrl.searchParams.get("org") ?? "");
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const viewer = await getHubForumViewer();
  return NextResponse.json(await hubForumSnapshot(org, viewer));
}

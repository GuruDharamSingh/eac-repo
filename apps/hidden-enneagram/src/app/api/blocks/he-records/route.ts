import { NextResponse } from "next/server";
import { loadForumTopics, loadPerson, loadServiceBlock } from "@/lib/record-blocks";

/**
 * The editor's view of the round 3 record blocks (he-service, he-forum,
 * he-person). Ungated like thread-feed's: only what a visitor sees (the
 * service sample carries no booking state; the forum as this request's
 * viewer; public profiles).
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  switch (q.get("block")) {
    case "service": {
      const { service } = await loadServiceBlock({ serviceSlug: q.get("slug") ?? "" });
      return NextResponse.json({ service, booking: null });
    }
    case "forum":
      return NextResponse.json({ topics: await loadForumTopics(q.get("limit")) });
    case "person":
      return NextResponse.json({ person: await loadPerson(q.get("slug") ?? "") });
    default:
      return NextResponse.json({ error: "Unknown block." }, { status: 400 });
  }
}

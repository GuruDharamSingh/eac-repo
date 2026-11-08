import { NextResponse } from "next/server";
import { loadShelf } from "@/lib/shelf";

/**
 * Rows for a he-shelf block, for the editor (round 3). Ungated like
 * thread-feed's route: loadShelf returns only published services and a
 * feed's public posts, what any visitor already sees.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const items = await loadShelf({
    source: url.searchParams.get("source"),
    feed: url.searchParams.get("feed"),
    limit: url.searchParams.get("limit"),
  });
  return NextResponse.json({ items });
}

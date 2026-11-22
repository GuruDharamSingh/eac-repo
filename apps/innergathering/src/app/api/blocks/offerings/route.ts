import { NextResponse } from "next/server";
import { loadOfferingsData } from "@/lib/landing-offerings";

/**
 * What an offerings-band block shows, for the editor's canvas (which has no database to read).
 *
 * Deliberately ungated, like api/blocks/thread-feed: it returns only what the public landing page already draws,
 * which is published, public threads of the Offerings feed and the counts shown beside them. The asker's own RSVP
 * answer is the one per-person field, and it is read from the asker's own session. A thread id that is not in that
 * feed shows nothing special: the lead falls back to the soonest gathering.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const featured = (url.searchParams.get("featured") ?? "").slice(0, 64);
  const more = url.searchParams.get("more") ?? "upcoming";
  const moreCount = Number(url.searchParams.get("moreCount") ?? 3);
  const data = await loadOfferingsData({ featured, more, moreCount });
  return NextResponse.json(data);
}

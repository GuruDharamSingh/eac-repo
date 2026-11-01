import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import { SeriesError, isSubscribedToSeries, setSeriesSubscription } from "@elkdonis/services";
import { siteConfig } from "@/config/site";

/**
 * Subscribe to a series, or leave it (2026-10-10). Signed-in only, any role,
 * like the week RSVP (`api/series/rsvp`). A subscription is a `thread_rsvps`
 * row with status `subscribed` on the series' own thread; subscribers get a
 * letter a few days before each published week (lib/reminders.ts, kind
 * `subscribers`). Migration 202 allows the status.
 *
 * POST { seriesId, subscribe?: boolean }   subscribe defaults to true
 * GET  ?seriesId=…                         { subscribed } for the viewer
 *
 * Called by the series page top (`components/site/series-top.tsx`).
 */
export const dynamic = "force-dynamic";

async function viewerId(): Promise<string | null> {
  const auth = await getServerSession();
  return auth.user ? (auth.user.db_user_id ?? auth.user.id) : null;
}

export async function GET(request: NextRequest) {
  const seriesId = request.nextUrl.searchParams.get("seriesId");
  if (!seriesId) return NextResponse.json({ error: "seriesId required" }, { status: 400 });
  const userId = await viewerId();
  if (!userId) return NextResponse.json({ subscribed: false, signedIn: false });
  return NextResponse.json({ subscribed: await isSubscribedToSeries(seriesId, userId), signedIn: true });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { seriesId?: string; subscribe?: boolean } | null;
  if (!body?.seriesId) return NextResponse.json({ error: "seriesId required" }, { status: 400 });
  const userId = await viewerId();
  if (!userId) return NextResponse.json({ error: "Sign in or create an account to subscribe." }, { status: 401 });
  try {
    const subscribed = await setSeriesSubscription({
      orgId: siteConfig.orgId,
      threadId: body.seriesId,
      userId,
      subscribed: body.subscribe !== false,
    });
    return NextResponse.json({ ok: true, subscribed });
  } catch (e) {
    const status = e instanceof SeriesError ? e.status : 400;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

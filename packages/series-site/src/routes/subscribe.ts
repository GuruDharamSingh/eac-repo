import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import { SeriesError, followOrg, isSubscribedToSeries, setSeriesSubscription } from "@elkdonis/services";
import type { SeriesSite } from "../config";

export function subscribeRoutes(site: SeriesSite) {

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

async function viewerId(): Promise<string | null> {
  const auth = await getServerSession();
  return auth.user ? (auth.user.db_user_id ?? auth.user.id) : null;
}

async function GET(request: NextRequest) {
  const seriesId = request.nextUrl.searchParams.get("seriesId");
  if (!seriesId) return NextResponse.json({ error: "seriesId required" }, { status: 400 });
  const userId = await viewerId();
  if (!userId) return NextResponse.json({ subscribed: false, signedIn: false });
  return NextResponse.json({ subscribed: await isSubscribedToSeries(seriesId, userId), signedIn: true });
}

async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { seriesId?: string; subscribe?: boolean } | null;
  if (!body?.seriesId) return NextResponse.json({ error: "seriesId required" }, { status: 400 });
  const userId = await viewerId();
  if (!userId) return NextResponse.json({ error: "Sign in or create an account to subscribe." }, { status: 401 });
  try {
    const subscribed = await setSeriesSubscription({
      orgId: site.orgId,
      threadId: body.seriesId,
      userId,
      subscribed: body.subscribe !== false,
    });
    // A subscriber follows the org, as with "I'm coming" (`answerSeriesWeek`).
    if (subscribed) {
      await followOrg(userId, site.orgId).catch((err) => console.error(`[${site.orgId}] follow on subscribe failed:`, err));
    }
    return NextResponse.json({ ok: true, subscribed });
  } catch (e) {
    const status = e instanceof SeriesError ? e.status : 400;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

  return { GET, POST };
}

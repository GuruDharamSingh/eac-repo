import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import { getMeetingSeries } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { answerSeriesWeek } from "@/lib/series-mail";

/**
 * RSVP for one week of a series, from the public series page.
 *
 * Members only: a `thread_rsvps` row on the week's topic thread (made on
 * first use), so the count and the member's answer are per week. A signed-out
 * visitor is sent to create an account (owner's decision, 2026-10-08): the
 * series is how people join the network to follow IFAC.
 *
 * Only published weeks take a yes (2026-10-10): a draft is not on the public
 * pages. Saying yes mails the person their confirmation and notifies the
 * week's host and co-host; the owner address is told only when the week has
 * nobody hosting it yet (`answerSeriesWeek`, lib/series-mail.ts).
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    seriesId?: string;
    occurrenceAt?: string;
    going?: boolean;
  } | null;
  if (!body?.seriesId || !body.occurrenceAt)
    return NextResponse.json({ error: "seriesId and occurrenceAt required" }, { status: 400 });
  const at = new Date(body.occurrenceAt);
  if (Number.isNaN(at.getTime())) return NextResponse.json({ error: "Bad occurrenceAt" }, { status: 400 });
  const going = body.going !== false;

  const series = await getMeetingSeries(siteConfig.orgId, { threadId: body.seriesId }, { count: 12, pastCount: 1 });
  if (!series) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const session = series.sessions.find((s) => s.at === at.toISOString());
  if (!session) return NextResponse.json({ error: "That week is not on the series." }, { status: 400 });
  if (session.isPast) return NextResponse.json({ error: "That week has already happened." }, { status: 400 });
  if (going && !session.isPublished)
    return NextResponse.json({ error: "That week is not open yet. It opens once its host has written it up." }, { status: 400 });

  const auth = await getServerSession();
  const userId = auth.user ? (auth.user.db_user_id ?? auth.user.id) : null;
  // Signed out: no guest RSVPs. Joining the network is the point.
  if (!userId) return NextResponse.json({ error: "Sign in or create an account to RSVP." }, { status: 401 });

  const result = await answerSeriesWeek({ series, week: session, userId, email: auth.user?.email ?? null, going });
  if (!result.ok) return NextResponse.json({ error: result.error ?? "Could not RSVP." }, { status: 409 });
  return NextResponse.json({ ok: true, status: result.status, rsvpCount: result.rsvpCount, signedIn: true });
}

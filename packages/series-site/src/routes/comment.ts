import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ensureSeriesSessionTopic, getMeetingSeries, postReply } from "@elkdonis/services";
import type { SeriesSite } from "../config";

export function commentRoutes(site: SeriesSite) {

/**
 * A comment on one week of a series. The week's topic thread (made on first
 * use) is the forum thread, so a comment here is a reply there: same rate
 * limit, same locking, same moderation. Signed-in only.
 */

async function POST(request: NextRequest) {
  const viewer = await site.getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in to comment." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { seriesId?: string; occurrenceAt?: string; text?: string } | null;
  if (!body?.seriesId || !body.occurrenceAt) return NextResponse.json({ error: "seriesId and occurrenceAt required" }, { status: 400 });
  const at = new Date(body.occurrenceAt);
  if (Number.isNaN(at.getTime())) return NextResponse.json({ error: "Bad occurrenceAt" }, { status: 400 });
  const text = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Write something first." }, { status: 400 });

  const series = await getMeetingSeries(site.orgId, { threadId: body.seriesId }, { count: 20, pastCount: 12 });
  const week = series?.sessions.find((s) => s.at === at.toISOString());
  if (!series || !week) return NextResponse.json({ error: "That week is not on the series." }, { status: 404 });

  const topic = await ensureSeriesSessionTopic(site.orgId, series.id, at, viewer.userId);
  const result = await postReply(await site.getForumViewer(), { threadId: topic.id, text });
  if (!result.ok) return NextResponse.json({ error: (result as { ok: false; error: string }).error }, { status: 400 });
  revalidatePath(`/series/${series.slug}/${week.number}`);
  return NextResponse.json({ ok: true, replyId: result.replyId });
}

  return { POST };
}

import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { listRefVotes, ReasoningError, recordRefVote } from "@elkdonis/astro-corpus/server";
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import { ownerOrResponse } from "@/lib/owner-api";
import { chartKeySet, passagesFor } from "@/lib/references";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The chart explorer's helpful / not-helpful votes on references (astro_reviews,
 * action "ref-vote", question_id NULL). Owners only.
 *
 * POST {textId, factorKey, statementId?, chartId?, elementId?, verdict: helpful|not|clear, note?, seconds?}
 *   200 { ok: true, reviewId, vote: payload }, or 400 { error } when it does not check out.
 *   The target is the PASSAGE (textId). Validated in @elkdonis/astro-corpus (cleanPassageVotePayload, recordRefVote):
 *   the passage must exist and be tagged with factorKey (or place it); a statementId must be from it; the chart
 *   must be the caller's.
 *
 * GET ?chartId=<uuid>&verdict=helpful|not&viewChart=<uuid>
 *   The caller's standing votes with their statements (Favourites and the
 *   toss list); no chartId = votes cast on any chart. viewChart: the chart
 *   being looked at, for each item's applicability to it.
 *   200 { votes: (RefVoteListItem & { chartName, ref: PassageRef })[] }
 */
export async function POST(request: NextRequest) {
  const viewer = await ownerOrResponse();
  if (viewer instanceof NextResponse) return viewer;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Expected a JSON object" }, { status: 400 });
  const ua = (await headers()).get("user-agent") ?? "";
  const seconds = typeof body.seconds === "number" && body.seconds >= 0 && body.seconds < 86400 ? body.seconds : null;
  try {
    const { reviewId, payload } = await recordRefVote({
      reviewerId: viewer.userId,
      payload: body,
      seconds,
      device: /Mobi|Android|iPhone|iPad/i.test(ua) ? "phone" : "desktop",
    });
    return NextResponse.json({ ok: true, reviewId, vote: payload });
  } catch (err) {
    if (err instanceof ReasoningError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[elastrocal] ref-vote failed", err);
    return NextResponse.json({ error: "Could not save the vote" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const viewer = await ownerOrResponse();
  if (viewer instanceof NextResponse) return viewer;
  const sp = request.nextUrl.searchParams;
  const chartId = sp.get("chartId");
  if (chartId && !UUID_RE.test(chartId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const v = sp.get("verdict");
  const verdict = v === "helpful" || v === "not" ? v : undefined;
  const viewChart = sp.get("viewChart");
  if (viewChart && !UUID_RE.test(viewChart)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const [votes, chart, names] = await Promise.all([
      listRefVotes(viewer.userId, { chartId: chartId ?? undefined, verdict }),
      viewChart ? chartKeySet(viewChart, { kind: "user", userId: viewer.userId }) : Promise.resolve(null),
      db<{ id: string; name: string }[]>`SELECT id, name FROM astro_charts WHERE owner_id = ${viewer.userId} AND org_id = ${siteConfig.orgId}`,
    ]);
    if (viewChart && !chart) return NextResponse.json({ error: "Chart not found" }, { status: 404 });
    const refs = await passagesFor(votes, chart);
    const chartName = new Map(names.map((c) => [c.id, c.name]));
    const out = votes.flatMap((x) => {
      const ref = refs.get(`${x.textId}|${x.factorKey}`);
      if (!ref) return [];
      return [{ ...x, chartName: x.chartId ? (chartName.get(x.chartId) ?? null) : null, ref: { ...ref, vote: { verdict: x.verdict, note: x.note } } }];
    });
    return NextResponse.json({ votes: out }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[elastrocal] ref-votes list failed", err);
    return NextResponse.json({ error: "Could not load votes" }, { status: 500 });
  }
}

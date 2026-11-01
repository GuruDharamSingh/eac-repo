import { NextResponse } from "next/server";
import { getSeriesBySlug, listSeriesLots, listSeriesBidFeed } from "@elkdonis/commerce/queries";

/**
 * The presenter board's feed: the series' lots and the latest bids, as
 * paddles only (no names, no emails). Polled every few seconds by
 * /series/[slug]/live. Public for a published series.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug);
  if (!series || series.status !== "published") return NextResponse.json({ error: "not found" }, { status: 404 });
  const [lots, bids] = await Promise.all([listSeriesLots(series.id), listSeriesBidFeed(series.id, 20)]);
  return NextResponse.json(
    { now: new Date().toISOString(), phase: series.phase, liveAt: series.liveAt, closeMode: series.closeMode, lots, bids },
    { headers: { "Cache-Control": "no-store" } }
  );
}

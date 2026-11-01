import { NextRequest, NextResponse } from "next/server";
import { getSeriesEmailStats } from "@elkdonis/services";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { findIfacSeries } from "@/lib/series-letters-store";

/**
 * Email figures for one series, for the planner's "Manage" tab (2026-10-10):
 * letters per week and overall, opens/clicks where SendGrid events exist,
 * subscribers and mailings (`getSeriesEmailStats`).
 *
 *   GET ?threadId=…   JSON: SeriesEmailStats
 *
 * Organisers only (owner or guide, `getApiEditor`); others get 403. The
 * thread must be one of IFAC's series (`findIfacSeries`, the reminder tick's
 * rule), else 404. Read-only; never cached.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const viewer = await getApiEditor();
  if (!viewer) return NextResponse.json({ error: "Organisers only" }, { status: 403, headers: NO_STORE });

  const threadId = request.nextUrl.searchParams.get("threadId");
  if (!threadId) return NextResponse.json({ error: "threadId required" }, { status: 400, headers: NO_STORE });

  const series = await findIfacSeries(threadId);
  if (!series) return NextResponse.json({ error: "Not an IFAC series" }, { status: 404, headers: NO_STORE });

  try {
    const stats = await getSeriesEmailStats(siteConfig.orgId, series.id);
    if (!stats) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
    return NextResponse.json(stats, { headers: NO_STORE });
  } catch (err) {
    console.error("[ifac] series stats failed:", err);
    return NextResponse.json({ error: "Could not read the email figures." }, { status: 500, headers: NO_STORE });
  }
}

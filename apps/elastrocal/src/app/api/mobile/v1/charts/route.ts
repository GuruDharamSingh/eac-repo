import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { getChart, listCharts } from "@/lib/charts";

/**
 * GET /api/mobile/v1/charts — the signed-in person's saved charts, each with
 * its birth data and computed chart, for the app's transit-to-natal feed.
 */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Not linked" }, { status: 401 });
  const keeper = { kind: "user" as const, userId: viewer.userId };
  const list = await listCharts(keeper);
  const charts = (await Promise.all(list.map((c) => getChart(c.id, keeper)))).filter(Boolean);
  return NextResponse.json({ charts });
}

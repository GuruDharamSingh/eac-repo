import { NextResponse, type NextRequest } from "next/server";
import { ChartInputError } from "@elkdonis/astro/server";
import { getIdentity, type Keeper } from "@/lib/auth";
import { claimGuestCharts, createChart } from "@/lib/charts";
import { newGuestId, setGuestCookie } from "@/lib/guest";
import { firstIssue, saveChartSchema } from "@/lib/validation";

/**
 * Save a chart. No account needed: a signed-out browser without a guest
 * cookie is given one here, so its very first save already has a keeper.
 */
export async function POST(request: NextRequest) {
  const parsed = saveChartSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const { viewer, guestId } = await getIdentity();
  let keeper: Keeper;
  if (viewer) {
    keeper = { kind: "user", userId: viewer.userId };
    if (guestId) await claimGuestCharts(guestId, viewer.userId);
  } else {
    keeper = { kind: "guest", guestId: guestId ?? newGuestId() };
  }

  try {
    const id = await createChart(keeper, parsed.data);
    const res = NextResponse.json({ id, keeper: keeper.kind }, { status: 201 });
    // Set (or refresh) the cookie only once the row exists, so they can't disagree.
    if (keeper.kind === "guest") setGuestCookie(res, keeper.guestId);
    return res;
  } catch (err) {
    if (err instanceof ChartInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[elastrocal] save failed", err);
    return NextResponse.json({ error: "The chart could not be saved" }, { status: 500 });
  }
}

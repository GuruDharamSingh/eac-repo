import { NextResponse, type NextRequest } from "next/server";
import { calculateChart, ChartInputError } from "@elkdonis/astro/server";
import { birthDataSchema, firstIssue } from "@/lib/validation";

/** Public: calculate without saving. Anyone may use the calculator. */
export async function POST(request: NextRequest) {
  const parsed = birthDataSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  try {
    const { date, time, timeKnown, timezone, latitude, longitude, houseSystem } = parsed.data;
    return NextResponse.json({
      chart: calculateChart({ date, time, timeKnown, timezone, latitude, longitude, houseSystem }),
    });
  } catch (err) {
    if (err instanceof ChartInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[elastrocal] calculate failed", err);
    return NextResponse.json({ error: "The chart could not be calculated" }, { status: 500 });
  }
}

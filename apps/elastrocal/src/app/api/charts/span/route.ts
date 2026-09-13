import { NextResponse, type NextRequest } from "next/server";
import { calculateSpan, ChartInputError } from "@elkdonis/astro/server";
import { z } from "zod";
import { birthDataSchema, firstIssue } from "@/lib/validation";

/**
 * A window of days, tabulated.
 *
 * Public, like /calculate, and for the same reason: it computes and returns
 * nothing that is not already public. It exists so the home page's dial can
 * be scrubbed without a round trip per day — one call covers a year, and the
 * browser assembles each date from the table (see @elkdonis/astro/span).
 *
 * A year of days is a few hundred kilobytes of JSON before compression, so
 * the window is capped and the response is cached: the same window for the
 * same place and time is the same numbers forever, which is exactly what an
 * immutable cache header is for.
 */
const schema = z.object({ days: z.coerce.number().int().min(1).max(400).default(365) });

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = birthDataSchema.safeParse(body);
  const window = schema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  if (!window.success) {
    return NextResponse.json({ error: firstIssue(window.error) }, { status: 400 });
  }

  try {
    const { date, time, timeKnown, timezone, latitude, longitude, houseSystem } = parsed.data;
    const span = calculateSpan(
      { date, time, timeKnown, timezone, latitude, longitude, houseSystem },
      window.data.days,
    );
    return NextResponse.json(
      { span },
      // The sky does not change its mind about 1995.
      { headers: { "Cache-Control": "public, max-age=86400, immutable" } },
    );
  } catch (err) {
    if (err instanceof ChartInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[elastrocal] span failed", err);
    return NextResponse.json({ error: "The span could not be calculated" }, { status: 500 });
  }
}

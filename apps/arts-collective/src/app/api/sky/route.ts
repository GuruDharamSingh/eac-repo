import { NextResponse, type NextRequest } from "next/server";
import { calculateSkyAt, ChartInputError } from "@elkdonis/astro/server";

/**
 * The sky at an instant, for the sky face on the landing page.
 *
 * The same contract as apps/elastrocal/src/app/api/sky — @elkdonis/sky-ui
 * fetches from whichever host it is mounted in, so this site answers for its
 * own face rather than reaching across to Elastrocal. A chart takes the
 * engine a few milliseconds.
 *
 * ?t=<ISO>  the moment (default now)
 * ?lat&lon  the place the houses are cast for (default Greenwich)
 */
const DEFAULT = { latitude: 51.4769, longitude: -0.0005 };

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const t = q.get("t");
  const at = t ? new Date(t) : new Date();
  if (Number.isNaN(at.getTime())) {
    return NextResponse.json({ error: "Invalid instant" }, { status: 400 });
  }

  let latitude: number = DEFAULT.latitude;
  let longitude: number = DEFAULT.longitude;
  if (q.has("lat") && q.has("lon")) {
    latitude = Number(q.get("lat"));
    longitude = Number(q.get("lon"));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
    }
  }

  try {
    return NextResponse.json({ chart: calculateSkyAt(at, latitude, longitude) });
  } catch (err) {
    if (err instanceof ChartInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[arts-collective] sky failed", err);
    return NextResponse.json({ error: "The sky could not be calculated" }, { status: 500 });
  }
}

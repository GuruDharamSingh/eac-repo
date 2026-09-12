import { NextResponse, type NextRequest } from "next/server";
import { calculateSkyAt, ChartInputError } from "@elkdonis/astro/server";
import { siteConfig } from "@/config/site";

/**
 * The sky at an instant, with houses cast for a place — what the home page
 * fetches as it plays through time. One chart takes the engine a few
 * milliseconds, so this can be hit many times a second per viewer.
 *
 * ?t=<ISO>  the moment (default now)
 * ?lat&lon  the place for houses (default siteConfig.skyLocation)
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const t = q.get("t");
  const at = t ? new Date(t) : new Date();
  if (Number.isNaN(at.getTime())) {
    return NextResponse.json({ error: "Invalid instant" }, { status: 400 });
  }

  let latitude: number = siteConfig.skyLocation.latitude;
  let longitude: number = siteConfig.skyLocation.longitude;
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
    console.error("[elastrocal] sky failed", err);
    return NextResponse.json({ error: "The sky could not be calculated" }, { status: 500 });
  }
}

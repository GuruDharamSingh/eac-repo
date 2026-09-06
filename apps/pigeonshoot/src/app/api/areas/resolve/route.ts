/**
 * Which neighbourhood is this coordinate in?
 *
 * Powers the live "Kensington-Chinatown" label under the map as the pin moves,
 * so a contributor sees their neighbourhood confirmed before they submit.
 *
 * Read-only, cheap (bounding-box prefilter, then one ray-cast) and public.
 */

import { NextRequest, NextResponse } from "next/server";
import { isPlausibleCoordinate, resolveArea } from "@/lib/geo";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!isPlausibleCoordinate(lat, lng)) {
    return NextResponse.json({ error: "Bad coordinates" }, { status: 400 });
  }

  const area = await resolveArea(lat, lng, searchParams.get("city") ?? undefined);

  // A point outside every polygon is a legitimate answer — open water, or
  // another city — so this is a 200 with null, not a 404.
  return NextResponse.json(
    { area },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}

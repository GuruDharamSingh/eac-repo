import { NextRequest, NextResponse } from "next/server";
import { suggestPlaces } from "@/lib/geo";

/**
 * Places-autocomplete proxy. Keeps any geocoder URL/key server-side, normalizes
 * Photon GeoJSON to a flat shape, and lets us cache. Called by PlaceAutocomplete.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ places: [] });

  const places = await suggestPlaces(q, 6);
  return NextResponse.json(
    { places },
    { headers: { "cache-control": "public, max-age=120" } }
  );
}

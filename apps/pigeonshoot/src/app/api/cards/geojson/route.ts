/**
 * Map pins as a GeoJSON FeatureCollection.
 *
 * Accepts the same filters as /cards plus an optional bbox, so the map can
 * refetch on pan once it's zoomed in far enough for that to mean anything.
 * Hard-capped in the read layer — a map that tried to draw every card in the
 * city would ship megabytes of JSON to a phone.
 *
 * Cards marked geo_precision='block' are jittered ~100m by listCardPins before
 * they ever reach this route, so the imprecise coordinate is the only one that
 * exists outside the database.
 */

import { NextRequest, NextResponse } from "next/server";
import { listCardPins } from "@/lib/data";

export const runtime = "nodejs";

function parseBbox(raw: string | null): [number, number, number, number] | undefined {
  if (!raw) return undefined;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return undefined;
  return parts as [number, number, number, number];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const pins = await listCardPins({
    city: searchParams.get("city") ?? undefined,
    area: searchParams.get("area") ?? undefined,
    species: searchParams.get("species") ?? undefined,
    tier: searchParams.get("tier") ?? undefined,
    bbox: parseBbox(searchParams.get("bbox")),
  });

  return NextResponse.json(
    {
      type: "FeatureCollection",
      features: pins.map((p) => ({
        type: "Feature",
        // GeoJSON is lng,lat — the opposite order to every other API here.
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: {
          slug: p.slug,
          title: p.title,
          tier: p.tierSlug,
          thumb: p.thumbUrl,
        },
      })),
    },
    { headers: { "Cache-Control": "public, max-age=60" } }
  );
}

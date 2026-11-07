// CONTRACT: walking legs between points via FOSSGIS foot routing (server only), straight-line fallback.
import type { RoutePreview } from "@/lib/catalogue-types";

type LngLat = [number, number];

function lengthKm(legs: LngLat[][]): number {
  let m = 0;
  for (const leg of legs)
    for (let k = 1; k < leg.length; k++) {
      const [lng1, lat1] = leg[k - 1]!;
      const [lng2, lat2] = leg[k]!;
      const x = (lng2 - lng1) * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
      m += Math.sqrt(x * x + (lat2 - lat1) ** 2) * 111_320;
    }
  return Math.round(m / 100) / 10;
}

/** Same router and splitting as lib/tour-cache.ts refreshTourRoute (routing.openstreetmap.de routed-foot). */
export async function walkingLegs(points: LngLat[]): Promise<RoutePreview> {
  let legs: LngLat[][] = points.slice(1).map((p, i) => [points[i]!, p]);
  if (points.length >= 2) {
    try {
      const path = points.map((p) => `${p[0]},${p[1]}`).join(";");
      const res = await fetch(`https://routing.openstreetmap.de/routed-foot/route/v1/driving/${path}?overview=full&geometries=geojson&steps=false`, {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "elkdonis-tours/1.0 (route preview)" },
      });
      if (res.ok) {
        const json = (await res.json()) as { routes?: { geometry: { coordinates: LngLat[] } }[]; waypoints?: { location: LngLat }[] };
        const coords = json.routes?.[0]?.geometry.coordinates;
        const wp = (json.waypoints ?? []).map((w) => w.location);
        if (coords && wp.length === points.length) {
          const cut = wp.map((w) => {
            let best = 0;
            let bd = Infinity;
            coords.forEach((c, i) => {
              const d = (c[0] - w[0]) ** 2 + (c[1] - w[1]) ** 2;
              if (d < bd) {
                bd = d;
                best = i;
              }
            });
            return best;
          });
          const split: LngLat[][] = [];
          for (let i = 0; i < cut.length - 1; i++) {
            const a = Math.min(cut[i]!, cut[i + 1]!);
            const b = Math.max(cut[i]!, cut[i + 1]!);
            split.push([points[i]!, ...coords.slice(a, b + 1), points[i + 1]!]);
          }
          if (split.length === points.length - 1) legs = split;
        }
      }
    } catch (err) {
      console.error("[elktours] walkingLegs:", err);
    }
  }
  return { legs, source: legs.some((l) => l.length > 2) ? "osrm" : "straight", km: lengthKm(legs) };
}

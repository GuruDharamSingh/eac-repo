/**
 * Which neighbourhood is this pin in?
 *
 * That is the only spatial question this app ever asks, which is why there is
 * no PostGIS. Boundaries live as simplified GeoJSON in public/geo/ and are
 * ray-cast here in JS. `pigeon_areas` stores each polygon's bounding box, so
 * the usual lookup tests one or two candidate polygons rather than all 158.
 *
 * @turf/boolean-point-in-polygon would do the same job, but it would pull a
 * dependency tree into this app for one 30-line function.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@elkdonis/db";

type Ring = [number, number][];
type PolygonCoords = Ring[];

interface Feature {
  slug: string;
  name: string;
  sourceId: string;
  polygons: PolygonCoords[];
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number };
}

/**
 * Parsed boundaries, cached per city for the life of the process.
 *
 * The promise itself is cached, not the result — concurrent first requests
 * then share one read and one parse instead of racing to do both.
 */
const cache = new Map<string, Promise<Feature[]>>();

/** Mirrors scripts/generate-toronto-areas.mjs so slugs match the seeded rows. */
function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function loadCityBoundaries(citySlug: string): Promise<Feature[]> {
  const cached = cache.get(citySlug);
  if (cached) return cached;

  const promise = (async (): Promise<Feature[]> => {
    const rows = await db<{ boundary_file: string | null }[]>`
      SELECT boundary_file FROM pigeon_cities WHERE slug = ${citySlug} LIMIT 1
    `;
    const file = rows[0]?.boundary_file;
    if (!file) return [];

    // path.basename defends the read against a boundary_file value that ever
    // came from somewhere less trustworthy than a migration.
    const full = path.join(process.cwd(), "public", "geo", path.basename(file));
    const geo = JSON.parse(await readFile(full, "utf8"));

    const seen = new Set<string>();
    return (geo.features as Array<{ properties: Record<string, string>; geometry: { type: string; coordinates: unknown } }>).map(
      (f) => {
        const name = f.properties.AREA_NAME;
        const sourceId = String(f.properties.AREA_SHORT_CODE ?? "");
        let slug = slugify(name);
        if (seen.has(slug)) slug = `${slug}-${sourceId}`;
        seen.add(slug);

        const polygons: PolygonCoords[] =
          f.geometry.type === "Polygon"
            ? [f.geometry.coordinates as PolygonCoords]
            : (f.geometry.coordinates as PolygonCoords[]);

        let minLng = Infinity;
        let minLat = Infinity;
        let maxLng = -Infinity;
        let maxLat = -Infinity;
        for (const polygon of polygons) {
          for (const ring of polygon) {
            for (const [lng, lat] of ring) {
              if (lng < minLng) minLng = lng;
              if (lat < minLat) minLat = lat;
              if (lng > maxLng) maxLng = lng;
              if (lat > maxLat) maxLat = lat;
            }
          }
        }

        return { slug, name, sourceId, polygons, bbox: { minLng, minLat, maxLng, maxLat } };
      }
    );
  })();

  cache.set(citySlug, promise);
  // A failed read must not poison the cache forever — the next request retries.
  promise.catch(() => cache.delete(citySlug));
  return promise;
}

function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygons(lng: number, lat: number, polygons: PolygonCoords[]): boolean {
  for (const polygon of polygons) {
    if (!pointInRing(lng, lat, polygon[0])) continue;
    // Inside the outer ring — XOR out any interior ring (hole) it falls in.
    let inHole = false;
    for (let i = 1; i < polygon.length; i++) {
      if (pointInRing(lng, lat, polygon[i])) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }
  return false;
}

export interface ResolvedArea {
  citySlug: string;
  areaSlug: string;
  areaName: string;
}

/**
 * Resolve a coordinate to a neighbourhood.
 *
 * Returns null for a point outside every polygon — the middle of the lake, or
 * a photo taken in another city. That is a legitimate card, just an unplaced
 * one, so callers should treat null as "no area" and never as an error.
 */
export async function resolveArea(
  lat: number,
  lng: number,
  citySlug?: string
): Promise<ResolvedArea | null> {
  try {
    const cities = citySlug
      ? [citySlug]
      : (
          await db<{ slug: string }[]>`
            SELECT slug FROM pigeon_cities WHERE is_active ORDER BY sort_order
          `
        ).map((r) => r.slug);

    for (const city of cities) {
      const features = await loadCityBoundaries(city);
      for (const f of features) {
        // Bounding box first: one comparison rejects ~157 of 158 polygons.
        if (
          lng < f.bbox.minLng ||
          lng > f.bbox.maxLng ||
          lat < f.bbox.minLat ||
          lat > f.bbox.maxLat
        ) {
          continue;
        }
        if (pointInPolygons(lng, lat, f.polygons)) {
          return { citySlug: city, areaSlug: f.slug, areaName: f.name };
        }
      }
    }
    return null;
  } catch (err) {
    console.error("[pigeonshoot] resolveArea:", err);
    return null;
  }
}

/** Rough sanity gate on a submitted coordinate before it reaches the database. */
export function isPlausibleCoordinate(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    // Exactly 0,0 is Null Island — always a bug, never a pigeon.
    !(lat === 0 && lng === 0)
  );
}

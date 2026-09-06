#!/usr/bin/env node
/**
 * Generate the pigeon_areas seed rows for Toronto from the boundary GeoJSON.
 *
 * The polygons themselves deliberately do NOT go in the database — 158 rings
 * of coordinates would make the migration megabytes of unreadable numbers, and
 * nothing in Postgres would ever query them (there is no PostGIS here). The
 * database stores each neighbourhood's identity, centroid and bounding box;
 * the polygons stay in public/geo/ where src/lib/geo.ts ray-casts against them
 * to answer "which neighbourhood is this pin in".
 *
 * The bbox columns are what make that fast: geo.ts tests the 1–2 polygons whose
 * box contains the point, not all 158.
 *
 *   node scripts/generate-toronto-areas.mjs                # print SQL
 *   node scripts/generate-toronto-areas.mjs --check 43.6539 -79.4009
 *
 * Source: City of Toronto Open Data, "Neighbourhoods" (158-area 2021 model),
 * EPSG:4326, simplified with:
 *   npx mapshaper neighbourhoods-4326.geojson -simplify 6% keep-shapes \
 *     -filter-fields AREA_NAME,AREA_SHORT_CODE \
 *     -o precision=0.00001 format=geojson public/geo/toronto-neighbourhoods.json
 * Licence: Open Government Licence – Toronto (attribution required; it is in
 * org_site_sections.footer).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const GEOJSON = join(HERE, "..", "public", "geo", "toronto-neighbourhoods.json");
const CITY = "toronto";

/** Match the slug style used across the monorepo: lowercase, hyphens, ASCII. */
function slugify(name) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Every ring of a Polygon or MultiPolygon, outer and interior alike. */
function* rings(geometry) {
  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) yield ring;
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) for (const ring of polygon) yield ring;
  }
}

/** Outer rings only — what area-weighted centroids and bboxes are built from. */
function* outerRings(geometry) {
  if (geometry.type === "Polygon") {
    yield geometry.coordinates[0];
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) yield polygon[0];
  }
}

function bboxOf(geometry) {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const ring of rings(geometry)) {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return { minLng, minLat, maxLng, maxLat };
}

/**
 * Area-weighted polygon centroid (the shoelace formula), not the mean of the
 * vertices. The mean drifts badly toward whichever edge has the most points,
 * and these boundaries follow ravines and rail corridors — exactly the kind of
 * detailed edge that would drag a naive centroid outside its own polygon.
 *
 * Falls back to the bbox centre if the ring is degenerate.
 */
function centroidOf(geometry) {
  let sumArea = 0;
  let sumLng = 0;
  let sumLat = 0;

  for (const ring of outerRings(geometry)) {
    let a = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x0, y0] = ring[j];
      const [x1, y1] = ring[i];
      const cross = x0 * y1 - x1 * y0;
      a += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
    }
    a *= 0.5;
    if (a !== 0) {
      sumArea += Math.abs(a);
      sumLng += (cx / (6 * a)) * Math.abs(a);
      sumLat += (cy / (6 * a)) * Math.abs(a);
    }
  }

  if (sumArea === 0) {
    const b = bboxOf(geometry);
    return { lng: (b.minLng + b.maxLng) / 2, lat: (b.minLat + b.maxLat) / 2 };
  }
  return { lng: sumLng / sumArea, lat: sumLat / sumArea };
}

function pointInRing(lng, lat, ring) {
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

function pointInGeometry(lng, lat, geometry) {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  for (const polygon of polygons) {
    if (!pointInRing(lng, lat, polygon[0])) continue;
    // Inside the outer ring — now XOR out any hole it falls in.
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

function load() {
  const geo = JSON.parse(readFileSync(GEOJSON, "utf8"));
  const seen = new Map();

  return geo.features.map((f) => {
    const name = f.properties.AREA_NAME;
    const sourceId = String(f.properties.AREA_SHORT_CODE ?? "");

    // Two neighbourhoods can slugify to the same string ("St. James Town" and
    // "St James Town" would). The short code disambiguates deterministically,
    // so re-running this script never reshuffles slugs.
    let slug = slugify(name);
    if (seen.has(slug)) slug = `${slug}-${sourceId}`;
    seen.set(slug, true);

    return {
      slug,
      name,
      sourceId,
      centroid: centroidOf(f.geometry),
      bbox: bboxOf(f.geometry),
      geometry: f.geometry,
    };
  });
}

const n = (v) => v.toFixed(6);
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const args = process.argv.slice(2);

if (args[0] === "--check") {
  // Sanity-check a coordinate against the polygons: which area contains it?
  const lat = Number(args[1]);
  const lng = Number(args[2]);
  const areas = load();
  const hit = areas.find(
    (a) =>
      lng >= a.bbox.minLng &&
      lng <= a.bbox.maxLng &&
      lat >= a.bbox.minLat &&
      lat <= a.bbox.maxLat &&
      pointInGeometry(lng, lat, a.geometry)
  );
  console.log(hit ? `${hit.slug}\t${hit.name}` : "(outside every neighbourhood)");
  process.exit(0);
}

const areas = load();
const rows = areas
  .sort((a, b) => a.name.localeCompare(b.name))
  .map(
    (a) =>
      `  (${q(CITY)},${q(a.slug)},${q(a.name)},${q(a.sourceId)},` +
      `${n(a.centroid.lat)},${n(a.centroid.lng)},` +
      `${n(a.bbox.minLat)},${n(a.bbox.minLng)},${n(a.bbox.maxLat)},${n(a.bbox.maxLng)})`
  )
  .join(",\n");

console.log(`-- ${areas.length} neighbourhoods, generated by scripts/generate-toronto-areas.mjs`);
console.log(`INSERT INTO pigeon_areas (city_slug, slug, name, source_id,
                          centroid_lat, centroid_lng,
                          min_lat, min_lng, max_lat, max_lng) VALUES`);
console.log(rows);
console.log(`ON CONFLICT (city_slug, slug) DO NOTHING;`);

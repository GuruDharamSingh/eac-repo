// CONTRACT: place suggestions: own catalogue -> Photon -> Overpass (OSM attribution, 7-day cache). Server only. Types in lib/catalogue-types.ts.
import { db } from "@elkdonis/db";
import { distanceM, listPlaces } from "@/lib/places";
import type { PlaceSuggestion, ReverseGeocode, SuggestQuery, SuggestResult } from "@/lib/catalogue-types";

/**
 * Suggestions for "New place" and for stops inside tour creation, in order:
 *   1. our own catalogue: within 600 m of `near`, or matching the text;
 *   2. Photon (PHOTON_URL, the public komoot instance by default): text search;
 *   3. Overpass: named POIs within 400 m of `near` (tourism attraction/museum/
 *      artwork/viewpoint, any historic=*, amenity place_of_worship/theatre).
 * Both OSM sources are free with fair-use limits and ODbL attribution: the
 * result carries "© OpenStreetMap contributors" whenever an OSM item is in it.
 * Photon and Overpass answers are cached for 7 days in geo_suggest_cache
 * (Postgres; migration 235), Overpass keyed by a rounded bbox.
 * Google Places is deliberately not used (billed per call; storage terms).
 */

export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";
const OSM_URL = "https://www.openstreetmap.org/copyright";
const CACHE_DAYS = 7;
const CATALOGUE_RADIUS_M = 600;
const OVERPASS_RADIUS_M = 400;
const PARIS = { lat: 48.8566, lng: 2.3522 };
const UA = "elkdonis-tours/1.0 (https://elkdonisexperiences.com)";

type Row = Record<string, unknown>;

async function cached<T>(key: string, load: () => Promise<T | null>): Promise<T | null> {
  try {
    const [hit] = (await db`
      SELECT payload FROM geo_suggest_cache WHERE key = ${key} AND fetched_at > NOW() - (${CACHE_DAYS} || ' days')::interval
    `) as unknown as Row[];
    if (hit) return hit.payload as T;
  } catch (err) {
    console.error("[elktours] suggest cache read:", err);
  }
  const fresh = await load();
  if (fresh != null) {
    try {
      await db`
        INSERT INTO geo_suggest_cache (key, payload, fetched_at) VALUES (${key}, ${db.json(fresh as never)}, NOW())
        ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = NOW()
      `;
      // Opportunistic sweep of stale rows.
      if (Math.random() < 0.05) await db`DELETE FROM geo_suggest_cache WHERE fetched_at < NOW() - (${CACHE_DAYS * 2} || ' days')::interval`;
    } catch (err) {
      console.error("[elktours] suggest cache write:", err);
    }
  }
  return fresh;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | number | undefined>;
}

async function photon(q: string, near: { lat: number; lng: number } | null): Promise<PlaceSuggestion[]> {
  const base = (process.env.PHOTON_URL || "https://photon.komoot.io").replace(/\/$/, "");
  const bias = near ?? PARIS;
  const key = `photon:${q.toLowerCase()}:${bias.lat.toFixed(2)},${bias.lng.toFixed(2)}`;
  const items = await cached<PlaceSuggestion[]>(key, async () => {
    try {
      const url = `${base}/api/?q=${encodeURIComponent(q)}&limit=8&lang=en&lat=${bias.lat}&lon=${bias.lng}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { "User-Agent": UA } });
      if (!res.ok) return null;
      const json = (await res.json()) as { features?: PhotonFeature[] };
      return (json.features ?? [])
        .map((f): PlaceSuggestion | null => {
          const p = f.properties ?? {};
          const [lng, lat] = f.geometry?.coordinates ?? [NaN, NaN];
          const name = typeof p.name === "string" ? p.name : null;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          const street = typeof p.street === "string" ? (p.housenumber ? `${p.housenumber} ${p.street}` : p.street) : null;
          const address = [street, p.postcode, p.city ?? p.county].filter(Boolean).join(", ") || null;
          const title = name ?? street;
          if (!title) return null;
          const osmType = p.osm_type === "N" ? "node" : p.osm_type === "W" ? "way" : p.osm_type === "R" ? "relation" : null;
          const ref = osmType && p.osm_id != null ? `osm:${osmType}/${p.osm_id}` : null;
          return {
            key: ref ?? `photon:${title}:${lat.toFixed(5)},${lng.toFixed(5)}`,
            source: "photon",
            title,
            lat,
            lng,
            address,
            category: typeof p.osm_value === "string" ? p.osm_value : null,
            placeId: null,
            sourceRef: ref,
            distanceM: null,
          };
        })
        .filter((s): s is PlaceSuggestion => s !== null);
    } catch {
      return null;
    }
  });
  return items ?? [];
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

async function overpass(near: { lat: number; lng: number }): Promise<PlaceSuggestion[]> {
  // Round to ~250 m cells so neighbouring lookups share a cache row.
  const cell = (v: number) => (Math.round(v * 400) / 400).toFixed(4);
  const c = { lat: Number(cell(near.lat)), lng: Number(cell(near.lng)) };
  const dLat = (OVERPASS_RADIUS_M + 150) / 111_320;
  const dLng = (OVERPASS_RADIUS_M + 150) / (111_320 * Math.cos((c.lat * Math.PI) / 180));
  const bbox = `${(c.lat - dLat).toFixed(5)},${(c.lng - dLng).toFixed(5)},${(c.lat + dLat).toFixed(5)},${(c.lng + dLng).toFixed(5)}`;
  const items = await cached<PlaceSuggestion[]>(`overpass:${bbox}`, async () => {
    const query = `[out:json][timeout:15];
(
  nwr["name"]["tourism"~"^(attraction|museum|artwork|viewpoint)$"](${bbox});
  nwr["name"]["historic"](${bbox});
  nwr["name"]["amenity"~"^(place_of_worship|theatre)$"](${bbox});
);
out center 80;`;
    // The public instances shed load with 429/502/504: try each once, in order.
    const endpoints = (process.env.OVERPASS_URL ? [process.env.OVERPASS_URL] : []).concat([
      "https://overpass-api.de/api/interpreter",
      "https://overpass.private.coffee/api/interpreter",
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    ]);
    try {
      let res: Response | null = null;
      for (const endpoint of endpoints) {
        res = await fetch(endpoint, {
          method: "POST",
          body: new URLSearchParams({ data: query }),
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(8_000),
        }).catch(() => null);
        if (res?.ok) break;
      }
      if (!res?.ok) return null;
      const json = (await res.json()) as { elements?: OverpassElement[] };
      return (json.elements ?? [])
        .map((e): PlaceSuggestion | null => {
          const lat = e.lat ?? e.center?.lat;
          const lng = e.lon ?? e.center?.lon;
          const t = e.tags ?? {};
          const title = t["name:en"] || t.name;
          if (lat == null || lng == null || !title) return null;
          const street = t["addr:street"] ? [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ") : null;
          return {
            key: `osm:${e.type}/${e.id}`,
            source: "overpass",
            title,
            lat,
            lng,
            address: [street, t["addr:postcode"], t["addr:city"]].filter(Boolean).join(", ") || null,
            category: t.tourism || t.amenity || (t.historic ? "historic" : null),
            placeId: null,
            sourceRef: `osm:${e.type}/${e.id}`,
            distanceM: null,
          };
        })
        .filter((s): s is PlaceSuggestion => s !== null);
    } catch {
      return null;
    }
  });
  return items ?? [];
}

/** Photon reverse geocoding for a pin: the nearest named feature as a suggested title and address. Cached 7 days. */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocode | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const base = (process.env.PHOTON_URL || "https://photon.komoot.io").replace(/\/$/, "");
  const key = `photon-rev:${lat.toFixed(5)},${lng.toFixed(5)}`;
  const hit = await cached<Omit<ReverseGeocode, "attribution" | "attributionUrl">>(key, async () => {
    try {
      const res = await fetch(`${base}/reverse?lat=${lat}&lon=${lng}&limit=1&lang=en`, {
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": UA },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { features?: PhotonFeature[] };
      const p = json.features?.[0]?.properties;
      if (!p) return null;
      const street = typeof p.street === "string" ? (p.housenumber ? `${p.housenumber} ${p.street}` : p.street) : null;
      const address = [street, p.postcode, p.city ?? p.county].filter(Boolean).join(", ") || null;
      const osmType = p.osm_type === "N" ? "node" : p.osm_type === "W" ? "way" : p.osm_type === "R" ? "relation" : null;
      return {
        title: typeof p.name === "string" && p.name.trim() ? p.name.trim() : null,
        address,
        category: typeof p.osm_value === "string" ? p.osm_value : null,
        sourceRef: osmType && p.osm_id != null ? `osm:${osmType}/${p.osm_id}` : null,
      };
    } catch {
      return null;
    }
  });
  return hit ? { ...hit, attribution: OSM_ATTRIBUTION, attributionUrl: OSM_URL } : null;
}

const norm = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export async function suggestPlaces(query: SuggestQuery): Promise<SuggestResult> {
  const q = query.q?.trim().slice(0, 120) ?? "";
  const near =
    query.near && Number.isFinite(query.near.lat) && Number.isFinite(query.near.lng) && Math.abs(query.near.lat) <= 90 && Math.abs(query.near.lng) <= 180
      ? { lat: query.near.lat, lng: query.near.lng }
      : null;
  if (q.length < 2 && !near) return { items: [], attribution: null, attributionUrl: null };

  const [ownNear, ownText, photonItems, overpassItems] = await Promise.all([
    near ? listPlaces({ near: { ...near, radiusM: CATALOGUE_RADIUS_M }, limit: 30 }) : Promise.resolve([]),
    q.length >= 2 ? listPlaces({ q, limit: 20 }) : Promise.resolve([]),
    q.length >= 2 ? photon(q, near) : Promise.resolve([]),
    near ? overpass(near) : Promise.resolve([]),
  ]);

  const items: PlaceSuggestion[] = [];
  const seenKeys = new Set<string>();
  const seenRefs = new Set<string>();
  const seenNames: { n: string; lat: number; lng: number }[] = [];
  const dist = (lat: number, lng: number) => (near ? distanceM(near, { lat, lng }) : null);
  const duplicate = (s: PlaceSuggestion) =>
    seenKeys.has(s.key) ||
    (s.sourceRef != null && seenRefs.has(s.sourceRef)) ||
    seenNames.some((x) => x.n === norm(s.title) && distanceM(x, s) < 150);
  const push = (s: PlaceSuggestion) => {
    if (duplicate(s)) return;
    items.push(s);
    seenKeys.add(s.key);
    if (s.sourceRef) seenRefs.add(s.sourceRef);
    seenNames.push({ n: norm(s.title), lat: s.lat, lng: s.lng });
  };

  // 1. Catalogue: text matches first, then nearby.
  for (const p of [...ownText, ...ownNear]) {
    if (p.lat == null || p.lng == null) continue;
    push({
      key: `place:${p.id}`,
      source: "catalogue",
      title: p.title,
      lat: p.lat,
      lng: p.lng,
      address: p.address,
      category: p.tags[0] ?? null,
      placeId: p.id,
      sourceRef: p.sourceRef,
      distanceM: dist(p.lat, p.lng),
    });
  }
  // 2. Photon text search.
  for (const s of photonItems) push({ ...s, distanceM: dist(s.lat, s.lng) });
  // 3. Overpass POIs near the point, nearest first, within the radius.
  const pois = overpassItems
    .map((s) => ({ ...s, distanceM: dist(s.lat, s.lng) }))
    .filter((s) => s.distanceM == null || s.distanceM <= OVERPASS_RADIUS_M)
    .filter((s) => !q || norm(s.title).includes(norm(q)) || q.length < 2)
    .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0))
    .slice(0, 25);
  for (const s of pois) push(s);

  const osm = items.some((s) => s.source !== "catalogue");
  return { items: items.slice(0, 60), attribution: osm ? OSM_ATTRIBUTION : null, attributionUrl: osm ? OSM_URL : null };
}

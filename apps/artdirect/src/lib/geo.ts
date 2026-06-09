/**
 * Places autocomplete backed by Photon (self-hosted OSM geocoder).
 *
 * Photon's API is `GET {base}/api/?q=…&limit=…&lang=…` returning GeoJSON. We
 * normalize each feature into a flat, canonical place. Same normalizer runs on
 * the offline `mock` provider (Photon-shaped fixtures), so dev without internet
 * and the self-hosted container exercise identical code.
 *
 * Provider selection:
 *   GEO_PROVIDER = "photon" (default) | "mock"
 *   PHOTON_URL   = base url of the geocoder (self-hosted: http://photon:2322,
 *                  public dev fallback: https://photon.komoot.io)
 */

export type PlaceSuggestion = {
  /** Display label, e.g. "Annex, Toronto, Ontario, Canada" */
  label: string;
  /** Primary place name */
  name: string;
  city: string;
  region: string;
  country: string;
  postcode: string;
  lat: number | null;
  lng: number | null;
  /** osm place type: city | suburb | state | postcode | … */
  type: string;
};

// ─── Photon GeoJSON shape (subset we use) ─────────────────────────────────────

type PhotonProps = {
  name?: string;
  city?: string;
  district?: string;
  locality?: string;
  county?: string;
  state?: string;
  country?: string;
  countrycode?: string;
  postcode?: string;
  type?: string;
  osm_value?: string;
  osm_key?: string;
};
type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: PhotonProps;
};

function normalizeFeature(f: PhotonFeature): PlaceSuggestion {
  const p = f.properties ?? {};
  const coords = f.geometry?.coordinates;
  const type = p.type || p.osm_value || "place";
  const name = p.name || p.city || p.locality || p.county || p.state || p.country || "";
  // For a city/locality result the name *is* the city; otherwise fall back to p.city.
  const city =
    p.city ||
    (["city", "town", "village", "hamlet", "locality"].includes(type) ? p.name ?? "" : "") ||
    p.locality ||
    "";
  const parts = [name, city && city !== name ? city : "", p.state, p.country].filter(Boolean);
  return {
    label: Array.from(new Set(parts)).join(", "),
    name,
    city,
    region: p.state ?? "",
    country: p.country ?? "",
    postcode: p.postcode ?? "",
    lat: Array.isArray(coords) ? coords[1] : null,
    lng: Array.isArray(coords) ? coords[0] : null,
    type,
  };
}

// ─── Offline / no-internet fixtures (Photon-shaped) ───────────────────────────

const MOCK_FEATURES: PhotonFeature[] = [
  { geometry: { coordinates: [-79.3839, 43.6535] }, properties: { name: "Toronto", city: "Toronto", state: "Ontario", country: "Canada", countrycode: "CA", type: "city" } },
  { geometry: { coordinates: [-79.4044, 43.6709] }, properties: { name: "The Annex", city: "Toronto", state: "Ontario", country: "Canada", countrycode: "CA", type: "suburb" } },
  { geometry: { coordinates: [-79.3733, 43.6629] }, properties: { name: "Toronto", state: "Ontario", country: "Canada", countrycode: "CA", postcode: "M5S", type: "postcode" } },
  { geometry: { coordinates: [-78.3197, 44.3091] }, properties: { name: "Peterborough", city: "Peterborough", state: "Ontario", country: "Canada", countrycode: "CA", type: "city" } },
  { geometry: { coordinates: [-85.0, 50.0] }, properties: { name: "Ontario", state: "Ontario", country: "Canada", countrycode: "CA", type: "state" } },
  { geometry: { coordinates: [-122.2712, 37.8044] }, properties: { name: "Oakland", city: "Oakland", state: "California", country: "United States", countrycode: "US", type: "city" } },
  { geometry: { coordinates: [-66.1057, 18.4655] }, properties: { name: "San Juan", city: "San Juan", state: "Puerto Rico", country: "United States", countrycode: "US", type: "city" } },
  { geometry: { coordinates: [-73.9857, 40.7484] }, properties: { name: "New York", city: "New York", state: "New York", country: "United States", countrycode: "US", type: "city" } },
];

function mockSuggest(q: string): PhotonFeature[] {
  const needle = q.toLowerCase();
  return MOCK_FEATURES.filter((f) => {
    const p = f.properties ?? {};
    return [p.name, p.city, p.state, p.country, p.postcode]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(needle));
  });
}

// ─── public entry ─────────────────────────────────────────────────────────────

export async function suggestPlaces(query: string, limit = 6): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const provider = (process.env.GEO_PROVIDER || "photon").toLowerCase();

  let features: PhotonFeature[] = [];
  if (provider === "mock") {
    features = mockSuggest(q);
  } else {
    const base = (process.env.PHOTON_URL || "https://photon.komoot.io").replace(/\/$/, "");
    const url = `${base}/api/?q=${encodeURIComponent(q)}&limit=${limit}&lang=en`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return [];
      const json = (await res.json()) as { features?: PhotonFeature[] };
      features = json.features ?? [];
    } catch {
      // Geocoder unreachable — degrade to no suggestions (form still accepts free text).
      return [];
    }
  }

  const seen = new Set<string>();
  const out: PlaceSuggestion[] = [];
  for (const f of features.slice(0, limit)) {
    const s = normalizeFeature(f);
    if (!s.label || seen.has(s.label)) continue;
    seen.add(s.label);
    out.push(s);
  }
  return out;
}

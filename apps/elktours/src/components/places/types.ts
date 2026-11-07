import type { Place, PlaceStats, PlaceSuggestion, PlaceUsage, TourAsset } from "@/lib/catalogue-types";

/**
 * View helpers for the places catalogue and the tour builder (manage only).
 * Everything here is editor-only: private notes and stats must never be
 * passed to a public page.
 */

/** One catalogue row: the place plus what the expanded row shows. */
export interface CatalogueEntry {
  place: Place;
  stats: PlaceStats | null;
  assets: TourAsset[];
  tours: PlaceUsage[];
}

/** Straight-line metres between two points (haversine). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number | null): string {
  if (m == null || !Number.isFinite(m)) return "";
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

export function formatDay(v: string | null): string {
  if (!v) return "never";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });
}

/**
 * Catalogue places as suggestions, matched in the browser: within `radius`
 * of `near`, or matching the text. Used while the server suggester is not
 * answering.
 */
export function catalogueSuggestions(
  places: Place[],
  { q, near, radius = 600, limit = 8 }: { q?: string; near?: { lat: number; lng: number } | null; radius?: number; limit?: number }
): PlaceSuggestion[] {
  const needle = (q ?? "").trim().toLowerCase();
  return places
    .filter((p) => !p.archivedAt && p.lat != null && p.lng != null)
    .map((p) => ({ p, d: near ? distanceM(near, { lat: p.lat!, lng: p.lng! }) : null }))
    .filter(({ p, d }) =>
      needle
        ? p.title.toLowerCase().includes(needle) || (p.address ?? "").toLowerCase().includes(needle) || p.tags.some((t) => t.toLowerCase().includes(needle))
        : d != null && d <= radius
    )
    .sort((a, b) => (a.d ?? Infinity) - (b.d ?? Infinity) || a.p.title.localeCompare(b.p.title))
    .slice(0, limit)
    .map(({ p, d }) => ({
      key: `place:${p.id}`,
      source: "catalogue" as const,
      title: p.title,
      lat: p.lat!,
      lng: p.lng!,
      address: p.address,
      category: p.tags[0] ?? null,
      placeId: p.id,
      sourceRef: p.sourceRef,
      distanceM: d,
    }));
}

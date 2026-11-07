import { listPlaceUsageMany, listPlaces } from "@/lib/places";
import { listPlaceAssetsMany } from "@/lib/assets";
import { listLowConfidenceLinksAction } from "@/lib/place-actions";
import { PlaceCatalogue } from "@/components/places/place-catalogue";
import type { CatalogueEntry } from "@/components/places/types";
import { requireOrgEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** The places catalogue. Editors only (manage/layout gates it); private notes and stats stay here. */
export default async function ManagePlacesPage() {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const places = await listPlaces({ includeArchived: true });
  const ids = places.map((p) => p.id);
  // Two batch queries for the whole list, not two per place.
  const [usage, assets, doubtful] = await Promise.all([
    listPlaceUsageMany(ids),
    listPlaceAssetsMany(ids),
    listLowConfidenceLinksAction().catch(() => []),
  ]);
  // Links matched without confidence, per place: the catalogue's "to review" filter.
  const toReview: Record<string, number> = {};
  for (const c of doubtful) toReview[c.placeId] = (toReview[c.placeId] ?? 0) + 1;
  const entries: CatalogueEntry[] = places.map(({ stats, ...place }) => ({
    place,
    stats,
    tours: usage.get(place.id) ?? [],
    assets: assets.get(place.id) ?? [],
  }));
  return <PlaceCatalogue entries={entries} linksToReview={toReview} />;
}

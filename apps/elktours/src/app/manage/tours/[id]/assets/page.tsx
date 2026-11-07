import { notFound } from "next/navigation";
import { AssetPanel, type AssetPanelStop } from "@/components/manage/asset-panel";
import { TourSubnav } from "@/components/manage/tour-subnav";
import { listAssets, listPlaceAssetsMany } from "@/lib/assets";
import { getTourById, loadTourFull } from "@/lib/tours";
import { requireOrgEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TourAssetsPage({ params }: { params: Promise<{ id: string }> }) {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const { id } = await params;
  const base = await getTourById(id);
  if (!base) notFound();
  const tour = await loadTourFull(base, { upcomingOnly: true });

  const stops: AssetPanelStop[] = tour.stops.map((s) => ({
    id: s.id,
    position: s.position,
    title: s.title,
    placeId: s.placeId ?? null,
  }));

  const placeIds = [...new Set(stops.map((s) => s.placeId).filter((p): p is string => Boolean(p)))];
  const [assets, byPlace] = await Promise.all([
    listAssets({ threadId: tour.id, includeStops: true }),
    listPlaceAssetsMany(placeIds),
  ]);
  const placeAssets = Object.fromEntries([...byPlace].filter(([, list]) => list.length > 0));

  return (
    <>
      <TourSubnav tour={tour} current="assets" counts={{ stops: tour.stops.length, assets: assets.filter((a) => !a.archivedAt).length }} />
      <div className="mt-6">
        <AssetPanel tourId={tour.id} stops={stops} assets={assets} placeAssets={placeAssets} />
      </div>
    </>
  );
}

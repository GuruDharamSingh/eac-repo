import { notFound } from "next/navigation";
import { AssetPanel, type AssetPanelStop } from "@/components/manage/asset-panel";
import { TourSubnav } from "@/components/manage/tour-subnav";
import { listAssets, listPlaceAssetsMany } from "@/lib/assets";
import { getTourById, loadTourFull } from "@/lib/tours";
import { requireOrgEditor } from "@/lib/auth";
import { Split } from "@/components/mobile/split";
import { TourMediaView, type MediaRows } from "@/components/mobile/tour-media-view";
import { getHeroLead } from "@/lib/hero";
import { realCover } from "@/lib/cover";
import { listTours } from "@/lib/tours";
import { ScanFolderButton } from "@/components/manage/scan-folder-button";
import { recordedFolder } from "@/lib/media-folders";

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

  // Phone tree (screen 37): the switches over the same assets. Desktop keeps the panel below, unchanged.
  const viewer = await requireOrgEditor();
  const [lead, allTours, folder] = await Promise.all([getHeroLead(tour.id), listTours({ includeDrafts: true }), recordedFolder({ threadId: tour.id })]);
  const tourLevel = assets.filter((a) => !a.stopId && !a.archivedAt);
  const items = (xs: typeof assets) => xs.map((a) => ({ id: a.id, visible: a.visible }));
  const map3d = tourLevel.find((a) => a.kind === "map3d");
  const rows: MediaRows = {
    film: { items: items(tourLevel.filter((a) => a.kind === "film")), seconds: tourLevel.find((a) => a.kind === "film")?.seconds ?? null },
    map3d: { id: map3d?.id ?? null, visible: map3d ? map3d.visible : true },
    cover: { items: items(tourLevel.filter((a) => a.kind === "poster")) },
    gallery: { items: items(tourLevel.filter((a) => a.kind === "image")) },
    stills: { items: items(assets.filter((a) => a.stopId && !a.archivedAt && a.kind === "still")) },
    hasStops: tour.stops.length > 0,
  };
  // The phone photos section (2026-11-17): the gallery pictures, and the cover unless it is a fly-over still.
  const cover = realCover(tour.coverImageUrl, tour.assets.film?.poster);
  const photos = tourLevel.filter((a) => a.kind === "image" && a.url).map((a) => ({ id: a.id, url: a.url!, visible: a.visible }));
  const tours = allTours.filter((t) => viewer.role === "owner" || t.authorId === viewer.userId).map((t) => ({ id: t.id, title: t.title }));
  if (!tours.some((t) => t.id === tour.id)) tours.unshift({ id: tour.id, title: tour.title });

  return (
    <Split
      mobile={<TourMediaView tours={tours} tourId={tour.id} title={tour.title} slug={tour.slug} rows={rows} lead={lead} cover={cover} coverFrame={cover ? tour.coverFrame : null} photos={photos} />}
      desktop={
        <>
          <TourSubnav tour={tour} current="assets" counts={{ stops: tour.stops.length, assets: assets.filter((a) => !a.archivedAt).length }} />
          <div className="mt-6">
            <ScanFolderButton scope={{ threadId: tour.id }} folder={folder} />
          </div>
          <div className="mt-6">
            <AssetPanel tourId={tour.id} stops={stops} assets={assets} placeAssets={placeAssets} />
          </div>
        </>
      }
    />
  );
}

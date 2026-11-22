import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@elkdonis/primitives";
import { getPlace, listPlaceUsage } from "@/lib/places";
import { listAssets } from "@/lib/assets";
import { PlaceDetails } from "@/components/places/place-details";
import { PlaceForm } from "@/components/places/place-form";
import { siteConfig } from "@/config/site";
import { requireOrgEditor } from "@/lib/auth";
import { Split } from "@/components/mobile/split";
import { PlaceEditView } from "@/components/mobile/place-edit-view";
import { getPlacePublic } from "@/lib/places-public";
import { listPlaceTags } from "@/lib/places";
import { ScanFolderButton } from "@/components/manage/scan-folder-button";
import { recordedFolder } from "@/lib/media-folders";

/** One catalogue place: edit form, then stats, media and the tours that use it. Editors only. */
export default async function ManagePlacePage({ params }: { params: Promise<{ id: string }> }) {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  const viewer = await requireOrgEditor();
  const { id } = await params;
  const found = await getPlace(id);
  if (!found) notFound();
  const { stats, ...place } = found;
  const [tours, assets, folder] = await Promise.all([
    listPlaceUsage(place.id),
    listAssets({ placeId: place.id }),
    recordedFolder({ placeId: place.id }),
  ]);

  // Phone tree (screen 38). Desktop keeps the full admin form below, unchanged.
  const [allTags, pub] = await Promise.all([listPlaceTags(), getPlacePublic(place.id).catch(() => null)]);
  const website = place.links?.find((l) => l.kind === "website")?.url ?? "";
  const mobile = (
    <PlaceEditView
      place={{ id: place.id, title: place.title, address: place.address, excerpt: place.excerpt, tags: place.tags }}
      allTags={allTags}
      website={website}
      favourite={Boolean(pub?.featuredBy.some((f) => f.userId === viewer.userId))}
    />
  );

  const desktop = (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <Link href="/manage/places" className="text-sm text-muted-foreground underline-offset-4 hover:underline">← Places</Link>
          <h2 className="mt-1 font-serif text-2xl">
            {place.title}
            {place.archivedAt && <Badge variant="outline" className="ml-2 align-middle">archived</Badge>}
          </h2>
        </div>
      </div>
      <div className="mt-6">
        <PlaceForm key={place.updatedAt} place={place} googleMapsKey={siteConfig.googleMapsKey} />
      </div>
      <div className="mt-10 border-t border-border pt-6">
        <ScanFolderButton scope={{ placeId: place.id }} folder={folder} />
      </div>
      <div className="mt-6">
        <PlaceDetails entry={{ place, stats, tours, assets }} showCopy={false} />
      </div>
    </>
  );
  return <Split mobile={mobile} desktop={desktop} />;
}

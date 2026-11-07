import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@elkdonis/primitives";
import { getPlace, listPlaceUsage } from "@/lib/places";
import { listAssets } from "@/lib/assets";
import { PlaceDetails } from "@/components/places/place-details";
import { PlaceForm } from "@/components/places/place-form";
import { siteConfig } from "@/config/site";
import { requireOrgEditor } from "@/lib/auth";

/** One catalogue place: edit form, then stats, media and the tours that use it. Editors only. */
export default async function ManagePlacePage({ params }: { params: Promise<{ id: string }> }) {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const { id } = await params;
  const found = await getPlace(id);
  if (!found) notFound();
  const { stats, ...place } = found;
  const [tours, assets] = await Promise.all([
    listPlaceUsage(place.id),
    listAssets({ placeId: place.id }),
  ]);

  return (
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
        <PlaceDetails entry={{ place, stats, tours, assets }} showCopy={false} />
      </div>
    </>
  );
}

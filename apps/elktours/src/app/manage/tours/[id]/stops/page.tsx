import Link from "next/link";
import { notFound } from "next/navigation";
import { TourBuilder } from "@/components/manage/tour-builder";
import { getTourById, loadTourFull } from "@/lib/tours";
import { listPlaces } from "@/lib/places";
import { listExperiences } from "@/lib/experiences";
import type { Place } from "@/lib/catalogue-types";
import { siteConfig } from "@/config/site";
import { requireOrgEditor } from "@/lib/auth";

/** The tour builder (editors only; manage/layout gates the route). */
export default async function TourStopsPage({ params }: { params: Promise<{ id: string }> }) {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const { id } = await params;
  const base = await getTourById(id);
  if (!base) notFound();
  const [tour, catalogue, experiences] = await Promise.all([
    loadTourFull(base, { includeCancelled: true }),
    // Private notes never reach the client builder.
    listPlaces().then((rows): Place[] => rows.map((p) => ({ ...p, privateNotes: null }))),
    listExperiences({ includeDrafts: true }),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <Link href={`/manage/tours/${tour.id}`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">← {tour.title}</Link>
          <h2 className="mt-1 font-serif text-2xl">Stops</h2>
        </div>
        <span className="flex gap-4 text-sm">
          <Link href="/manage/places" className="underline underline-offset-4">Places catalogue</Link>
          <Link href={`/tours/${tour.slug}`} className="underline underline-offset-4">
            {tour.status === "published" ? "View on site" : "Preview (draft)"}
          </Link>
        </span>
      </div>
      <div className="mt-6">
        <TourBuilder
          tourId={tour.id}
          initial={tour.stops}
          googleMapsKey={siteConfig.googleMapsKey}
          catalogue={catalogue}
          experiences={experiences}
        />
      </div>
    </>
  );
}

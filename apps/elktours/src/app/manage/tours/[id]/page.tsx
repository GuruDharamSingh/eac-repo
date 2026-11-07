import { notFound } from "next/navigation";
import { listDepartureBookings } from "@elkdonis/commerce/server";
import { TourForm } from "@/components/manage/tour-form";
import { StopsEditor } from "@/components/manage/stops-editor";
import { TourSubnav } from "@/components/manage/tour-subnav";
import { DeparturesPanel } from "@/components/manage/departures-panel";
import { getTourById, listGuides, loadTourFull } from "@/lib/tours";
import { siteConfig } from "@/config/site";
import { requireOrgEditor } from "@/lib/auth";

export default async function EditTourPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const { id } = await params;
  const { tab = "details" } = await searchParams;
  const base = await getTourById(id);
  if (!base) notFound();
  const [tour, guides] = await Promise.all([loadTourFull(base, { includeCancelled: true }), listGuides()]);

  const manifests = tab === "departures"
    ? Object.fromEntries(await Promise.all(tour.departures.map(async (d) => [d.id, await listDepartureBookings(siteConfig.orgId, d.id)])))
    : {};

  const upcoming = tour.departures.filter((d) => d.status === "scheduled" && new Date(d.startsAt) >= new Date()).length;

  return (
    <>
      {/* Stops now open the tour builder at /stops; ?tab=stops keeps the old editor until the builder is verified. */}
      <TourSubnav
        tour={tour}
        current={tab === "departures" ? "departures" : tab === "stops" ? "stops" : "details"}
        counts={{ stops: tour.stops.length, departures: upcoming }}
      />

      <div className="mt-6">
        {tab === "stops" ? (
          <StopsEditor tourId={tour.id} initial={tour.stops} googleMapsKey={siteConfig.googleMapsKey} />
        ) : tab === "departures" ? (
          <DeparturesPanel tourId={tour.id} departures={tour.departures} guides={guides} manifests={manifests} />
        ) : (
          <TourForm tour={tour} />
        )}
      </div>
    </>
  );
}

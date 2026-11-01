import Link from "next/link";
import { notFound } from "next/navigation";
import { listDepartureBookings } from "@elkdonis/commerce/server";
import { TourForm } from "@/components/manage/tour-form";
import { StopsEditor } from "@/components/manage/stops-editor";
import { DeparturesPanel } from "@/components/manage/departures-panel";
import { getTourById, listGuides, loadTourFull } from "@/lib/tours";
import { siteConfig } from "@/config/site";

export default async function EditTourPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab = "details" } = await searchParams;
  const base = await getTourById(id);
  if (!base) notFound();
  const [tour, guides] = await Promise.all([loadTourFull(base, { includeCancelled: true }), listGuides()]);

  const manifests = tab === "departures"
    ? Object.fromEntries(await Promise.all(tour.departures.map(async (d) => [d.id, await listDepartureBookings(siteConfig.orgId, d.id)])))
    : {};

  const tabs = [
    { key: "details", label: "Details" },
    { key: "stops", label: `Stops (${tour.stops.length})` },
    { key: "departures", label: `Departures (${tour.departures.filter((d) => d.status === "scheduled" && new Date(d.startsAt) >= new Date()).length})` },
  ];

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <Link href="/manage/tours" className="text-sm text-muted-foreground underline-offset-4 hover:underline">← Tours</Link>
          <h2 className="mt-1 font-serif text-2xl">{tour.title}</h2>
        </div>
        <span className="flex gap-4 text-sm">
          <Link href={`/manage/tours/${tour.id}/notes`} className="underline underline-offset-4">Guide notes</Link>
          <Link href={`/tours/${tour.slug}`} className="underline underline-offset-4">
            {tour.status === "published" ? "View on site" : "Preview (draft)"}
          </Link>
        </span>
      </div>

      <nav className="mt-4 flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/manage/tours/${tour.id}?tab=${t.key}`}
            className={`px-3 py-2 text-sm ${tab === t.key ? "border-b-2 border-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

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

import type { Metadata } from "next";
import { TourCard } from "@/components/tours/tour-card";
import { listTours, nextDepartures } from "@/lib/tours";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Tours",
  description: `Guided walks and experiences in ${siteConfig.city}.`,
};

export const dynamic = "force-dynamic";

export default async function ToursPage() {
  const tours = await listTours();
  const next = await nextDepartures(tours.map((t) => t.id));

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <header className="max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{siteConfig.city}</p>
        <h1 className="mt-2 font-serif text-4xl">Tours and experiences</h1>
        <p className="mt-3 text-muted-foreground">
          Small groups, on foot, led by people who live here. Pick a date, say how many you are, and pay by card.
        </p>
      </header>

      {tours.length === 0 ? (
        <p className="mt-10 border border-dashed border-border p-10 text-center text-muted-foreground">
          The first tours are being written. Check back soon.
        </p>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tours.map((t) => (
            <TourCard key={t.id} tour={t} next={next.get(t.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapPanel } from "@/components/map/map-panel";
import { getCity, listAreas, listCardPins } from "@/lib/data";

interface PageProps {
  params: Promise<{ city: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city } = await params;
  const found = await getCity(city);
  return { title: found?.name ?? "Not found" };
}

export default async function CityPage({ params }: PageProps) {
  const { city: citySlug } = await params;
  const city = await getCity(citySlug);
  if (!city) notFound();

  const [areas, pins] = await Promise.all([
    listAreas(citySlug, true),
    listCardPins({ city: citySlug }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <p className="text-sm">
        <Link href="/places" className="text-muted-foreground hover:text-foreground">
          ← Places
        </Link>
      </p>

      <h1 className="mt-4 font-display text-3xl font-bold">{city.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {city.cardCount ?? 0} cards across {areas.length}{" "}
        {areas.length === 1 ? "neighbourhood" : "neighbourhoods"}
      </p>

      <MapPanel
        center={[city.centerLat, city.centerLng]}
        zoom={city.defaultZoom}
        pins={pins.map((p) => ({
          slug: p.slug,
          title: p.title,
          lat: p.lat,
          lng: p.lng,
          tier: p.tierSlug,
          thumb: p.thumbUrl,
        }))}
        className="mt-6 h-96"
      />

      {areas.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          No neighbourhood has a card yet.
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {areas.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/places/${citySlug}/${a.slug}`}
                className="flex h-full flex-col justify-between rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary"
              >
                <span className="text-sm font-medium leading-tight">{a.name}</span>
                <span className="mt-2 font-display text-2xl font-bold tabular-nums text-primary">
                  {a.cardCount}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

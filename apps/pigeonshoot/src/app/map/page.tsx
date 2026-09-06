import type { Metadata } from "next";
import { MapPanel } from "@/components/map/map-panel";
import { getCity, listCardPins } from "@/lib/data";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Map" };

interface PageProps {
  searchParams: Promise<{ city?: string; species?: string; tier?: string; area?: string }>;
}

export default async function MapPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const citySlug = sp.city ?? siteConfig.defaultCity;

  const [city, pins] = await Promise.all([
    getCity(citySlug),
    listCardPins({ city: citySlug, area: sp.area, species: sp.species, tier: sp.tier }),
  ]);

  const center: [number, number] = city
    ? [city.centerLat, city.centerLng]
    : [43.6532, -79.3832];

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="mb-5">
        <h1 className="font-display text-3xl font-bold">Where they were</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {pins.length} placed {pins.length === 1 ? "pigeon" : "pigeons"} in{" "}
          {city?.name ?? "Toronto"}. Some pins are deliberately approximate.
        </p>
      </header>

      <MapPanel
        center={center}
        zoom={city?.defaultZoom ?? 11}
        pins={pins.map((p) => ({
          slug: p.slug,
          title: p.title,
          lat: p.lat,
          lng: p.lng,
          tier: p.tierSlug,
          thumb: p.thumbUrl,
        }))}
        className="h-[70vh] min-h-[24rem]"
      />
    </div>
  );
}

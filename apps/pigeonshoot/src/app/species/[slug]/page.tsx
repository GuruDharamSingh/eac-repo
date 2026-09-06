import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PigeonCard } from "@/components/pigeon-card";
import { MapPanel } from "@/components/map/map-panel";
import { getCity, getSpeciesBySlug, listCardPins, listCards, listTiers } from "@/lib/data";
import { siteConfig } from "@/config/site";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const species = await getSpeciesBySlug(slug);
  if (!species) return { title: "Not found" };
  return { title: species.name, description: species.tagline ?? undefined };
}

export default async function SpeciesPage({ params }: PageProps) {
  const { slug } = await params;
  const species = await getSpeciesBySlug(slug);

  // A proposed species has no public page yet — it isn't part of the guide
  // until the owner publishes it. 'merged' redirects the reader onward.
  if (!species || species.status === "rejected") notFound();
  if (species.status === "proposed") notFound();

  const [cards, tiers, pins, city] = await Promise.all([
    listCards({ species: slug, limit: 60 }),
    listTiers(),
    listCardPins({ species: slug }),
    getCity(siteConfig.defaultCity),
  ]);

  const areas = new Set(cards.map((c) => c.areaName).filter(Boolean));

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <p className="text-sm">
        <Link href="/species" className="text-muted-foreground hover:text-foreground">
          ← The field guide
        </Link>
      </p>

      <header className="mt-4">
        <h1 className="font-display text-4xl font-bold">{species.name}</h1>
        {species.tagline && (
          <p className="mt-2 text-lg text-muted-foreground">{species.tagline}</p>
        )}
        {species.description && <p className="mt-4 max-w-2xl">{species.description}</p>}

        {species.traits.length > 0 && (
          <div className="mt-5">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Field marks
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {species.traits.map((t) => (
                <li
                  key={t}
                  className="rounded-full border border-border bg-card px-3 py-1 text-sm"
                >
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-5 text-sm text-muted-foreground">
          {cards.length} {cards.length === 1 ? "sighting" : "sightings"}
          {areas.size > 0 && ` across ${areas.size} ${areas.size === 1 ? "neighbourhood" : "neighbourhoods"}`}
        </p>
      </header>

      {pins.length > 0 && city && (
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
          className="mt-8 h-80"
        />
      )}

      {cards.length > 0 && (
        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((card) => (
            <li key={card.id}>
              <PigeonCard
                card={card}
                tiers={tiers}
                variant="compact"
                href={`/cards/${card.slug}`}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

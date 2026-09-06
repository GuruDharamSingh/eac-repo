import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PigeonCard } from "@/components/pigeon-card";
import { getArea, getCity, listCards, listTiers } from "@/lib/data";

interface PageProps {
  params: Promise<{ city: string; area: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city, area } = await params;
  const found = await getArea(city, area);
  return { title: found?.name ?? "Not found" };
}

export default async function AreaPage({ params }: PageProps) {
  const { city: citySlug, area: areaSlug } = await params;
  const [city, area] = await Promise.all([getCity(citySlug), getArea(citySlug, areaSlug)]);
  if (!city || !area) notFound();

  const [cards, tiers] = await Promise.all([
    listCards({ city: citySlug, area: areaSlug, limit: 60 }),
    listTiers(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <p className="text-sm">
        <Link href={`/places/${citySlug}`} className="text-muted-foreground hover:text-foreground">
          ← {city.name}
        </Link>
      </p>

      <h1 className="mt-4 font-display text-3xl font-bold">{area.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {cards.length} {cards.length === 1 ? "pigeon" : "pigeons"} on record here
      </p>

      {cards.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          Nobody has photographed a pigeon here yet.
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((card) => (
            <li key={card.id}>
              <PigeonCard card={card} tiers={tiers} variant="compact" href={`/cards/${card.slug}`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

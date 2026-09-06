import Link from "next/link";
import { Camera, MapPin, Bird } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSiteSections, getSiteStats, listCards, listSpecies } from "@/lib/data";

export default async function HomePage() {
  const [sections, stats, recent, species] = await Promise.all([
    getSiteSections(),
    getSiteStats(),
    listCards({ limit: 12 }),
    listSpecies(),
  ]);

  const hero = sections.hero ?? {};

  return (
    <>
      <section className="bg-pavement border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-20 text-center sm:py-28">
          <h1 className="font-display text-5xl font-bold tracking-tight sm:text-7xl">
            {hero.title ?? "Shoot a pigeon."}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            {hero.subtitle ??
              "Toronto is full of them and no two are the same. Photograph one, drop a pin, get a card."}
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link href="/submit">
                <Camera className="size-5" />
                {hero.cta ?? "Start shooting"}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/cards">Browse the collection</Link>
            </Button>
          </div>

          <dl className="mx-auto mt-14 flex max-w-md justify-center gap-10 text-center">
            <Stat icon={<Bird className="size-4" />} value={stats.cards} label="cards" />
            <Stat icon={<Bird className="size-4" />} value={stats.species} label="species" />
            <Stat
              icon={<MapPin className="size-4" />}
              value={stats.areas}
              label="neighbourhoods"
            />
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-semibold">Latest sightings</h2>
          <Link href="/cards" className="text-sm text-primary hover:underline">
            See all →
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
            No cards yet. Be the first —{" "}
            <Link href="/submit" className="text-primary hover:underline">
              go find a pigeon
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {recent.map((card) => (
              <li key={card.id}>
                <Link
                  href={`/cards/${card.slug}`}
                  className="block overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md"
                >
                  <div className="aspect-[3/4] bg-muted">
                    {card.images[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={card.images[0].cardUrl ?? card.images[0].url}
                        alt={card.images[0].altText ?? card.title}
                        width={card.images[0].cardWidth ?? undefined}
                        height={card.images[0].cardHeight ?? undefined}
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium">{card.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {card.areaName ?? card.cityName ?? "Somewhere in the city"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {species.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pb-16">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-semibold">Known species</h2>
            <Link href="/species" className="text-sm text-primary hover:underline">
              The whole library →
            </Link>
          </div>
          <ul className="mt-6 flex flex-wrap gap-2">
            {species.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/species/${s.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:border-primary"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.cardCount ?? 0}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div>
      <dt className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="font-display text-3xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

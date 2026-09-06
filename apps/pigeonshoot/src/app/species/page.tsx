import Link from "next/link";
import type { Metadata } from "next";
import { listSpecies } from "@/lib/data";

export const metadata: Metadata = {
  title: "Species",
  description: "The field guide — every kind of pigeon catalogued so far.",
};

export default async function SpeciesIndexPage() {
  const species = await listSpecies();

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <header>
        <h1 className="font-display text-3xl font-bold">The field guide</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Kinds of pigeon, not scientific species. Names are made up by whoever spotted them
          first — that&apos;s the point. Propose a new one when you submit a card.
        </p>
      </header>

      {species.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
          Nothing catalogued yet.
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {species.map((s) => (
            <li key={s.id}>
              <Link
                href={`/species/${s.slug}`}
                className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md"
              >
                <div className="aspect-[4/3] bg-muted">
                  {s.heroUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.heroUrl}
                      alt=""
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-display text-lg font-semibold">{s.name}</h2>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {s.cardCount ?? 0} {s.cardCount === 1 ? "card" : "cards"}
                    </span>
                  </div>
                  {s.tagline && (
                    <p className="mt-1 text-sm text-muted-foreground">{s.tagline}</p>
                  )}
                  {s.traits.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-1">
                      {s.traits.map((t) => (
                        <li
                          key={t}
                          className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {t}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { PigeonCard } from "@/components/pigeon-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { countCards, listAreas, listCards, listSpecies, listTiers } from "@/lib/data";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Cards" };

const PAGE_SIZE = 48;

interface PageProps {
  searchParams: Promise<{
    city?: string;
    area?: string;
    species?: string;
    tier?: string;
    sort?: string;
    page?: string;
  }>;
}

/**
 * The collection.
 *
 * Filters are links, not client state, so every view has a URL someone can
 * send to a friend — which for a project whose whole point is "look what I
 * found round the corner" is the feature, not a detail.
 */
export default async function CardsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const sort = (["new", "rated", "top"] as const).includes(sp.sort as never)
    ? (sp.sort as "new" | "rated" | "top")
    : "new";

  const filters = {
    city: sp.city,
    area: sp.area,
    species: sp.species,
    tier: sp.tier,
    sort,
  };

  const [cards, total, tiers, species, areas] = await Promise.all([
    listCards({ ...filters, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    countCards(filters),
    listTiers(),
    listSpecies(),
    listAreas(sp.city ?? siteConfig.defaultCity, true),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) {
      if (v && k !== "page") next.set(k, String(v));
    }
    const s = next.toString();
    return s ? `/cards?${s}` : "/cards";
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Cards</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} {total === 1 ? "pigeon" : "pigeons"} on record
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {(
            [
              ["new", "Newest"],
              ["rated", "Just rated"],
              ["top", "Best"],
            ] as const
          ).map(([key, label]) => (
            <Link
              key={key}
              href={qs({ sort: key })}
              className={cn(
                "rounded-md px-3 py-1 text-sm",
                sort === key
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </header>

      <FilterRow label="Rarity" active={sp.tier} clearHref={qs({ tier: undefined })}>
        {tiers.map((t) => (
          <Chip key={t.slug} href={qs({ tier: t.slug })} active={sp.tier === t.slug}>
            {t.label}
          </Chip>
        ))}
      </FilterRow>

      {species.length > 0 && (
        <FilterRow label="Species" active={sp.species} clearHref={qs({ species: undefined })}>
          {species.map((s) => (
            <Chip key={s.id} href={qs({ species: s.slug })} active={sp.species === s.slug}>
              {s.name}
            </Chip>
          ))}
        </FilterRow>
      )}

      {areas.length > 0 && (
        <FilterRow label="Neighbourhood" active={sp.area} clearHref={qs({ area: undefined })}>
          {areas.map((a) => (
            <Chip key={a.slug} href={qs({ area: a.slug })} active={sp.area === a.slug}>
              {a.name} <span className="opacity-60">{a.cardCount}</span>
            </Chip>
          ))}
        </FilterRow>
      )}

      {cards.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-border p-14 text-center">
          <p className="text-muted-foreground">Nothing here yet.</p>
          <Button asChild className="mt-4">
            <Link href="/submit">Add the first one</Link>
          </Button>
        </div>
      ) : (
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

      {pages > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-3">
          {page > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={`${qs({})}${qs({}).includes("?") ? "&" : "?"}page=${page - 1}`}>
                Previous
              </Link>
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Button asChild variant="outline" size="sm">
              <Link href={`${qs({})}${qs({}).includes("?") ? "&" : "?"}page=${page + 1}`}>
                Next
              </Link>
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}

function FilterRow({
  label,
  active,
  clearHref,
  children,
}: {
  label: string;
  active?: string;
  clearHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <span className="w-full text-xs font-medium uppercase tracking-wide text-muted-foreground sm:w-auto">
        {label}
      </span>
      {children}
      {active && (
        <Link href={clearHref} className="text-xs text-primary hover:underline">
          clear
        </Link>
      )}
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground"
      )}
    >
      {children}
    </Link>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapPin, Calendar, Check, Minus, X } from "lucide-react";
import { PigeonCard } from "@/components/pigeon-card";
import { ReportButton } from "@/components/report-button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getCardBySlug, getCardCriteria, listTiers } from "@/lib/data";
import { displayTier } from "@/lib/rubric";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const card = await getCardBySlug(slug);
  if (!card) return { title: "Not found" };
  return {
    title: card.title,
    description:
      card.story ??
      `A ${card.species?.name ?? "pigeon"} spotted in ${card.areaName ?? "Toronto"}.`,
  };
}

export default async function CardPage({ params }: PageProps) {
  const { slug } = await params;
  const card = await getCardBySlug(slug);
  if (!card) notFound();

  const [tiers, criteria] = await Promise.all([listTiers(), getCardCriteria(card.id)]);
  const { tier, provisional } = displayTier(tiers, card);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="grid gap-10 md:grid-cols-[minmax(0,22rem)_1fr]">
        <div>
          <PigeonCard card={card} tiers={tiers} />
          {card.images.some((i) => i.role === "side") && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Tap the medallion to see the side profile.
            </p>
          )}
        </div>

        <div>
          <h1 className="font-display text-3xl font-bold leading-tight">{card.title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {card.species ? (
              <Link href={`/species/${card.species.slug}`} className="text-primary hover:underline">
                {card.species.name}
              </Link>
            ) : card.proposedSpeciesName ? (
              <span className="italic">
                Proposed: {card.proposedSpeciesName} — awaiting review
              </span>
            ) : null}

            {card.areaSlug && card.citySlug && (
              <Link
                href={`/places/${card.citySlug}/${card.areaSlug}`}
                className="flex items-center gap-1 hover:text-foreground"
              >
                <MapPin className="size-3.5" />
                {card.areaName}
              </Link>
            )}

            {card.spottedAt && (
              <span className="flex items-center gap-1">
                <Calendar className="size-3.5" />
                {new Date(card.spottedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {card.story && <p className="mt-5 leading-relaxed">{card.story}</p>}

          {card.placeNote && (
            <p className="mt-2 text-sm text-muted-foreground">{card.placeNote}</p>
          )}

          <Separator className="my-6" />

          {/* The rating, and where it came from. */}
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">Rating</h2>
              {tier && (
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                    provisional
                      ? "border border-border text-muted-foreground"
                      : "text-white"
                  )}
                  style={
                    provisional ? undefined : { backgroundColor: tier.accentHex ?? undefined }
                  }
                >
                  {tier.label}
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              {provisional ? (
                <>
                  Provisionally scored <strong>{card.autoScore}</strong> of {card.autoMax} by the
                  site. Not yet rated by a human — the final call is always a human one.
                </>
              ) : (
                <>
                  Rated {tier?.label} by the project owner
                  {card.ownerScore != null && <> · {card.ownerScore}/{card.autoMax}</>}.
                </>
              )}
            </p>

            {card.ratingNote && (
              <blockquote className="mt-3 border-l-2 border-primary pl-3 text-sm italic">
                {card.ratingNote}
              </blockquote>
            )}

            {criteria.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {criteria.map((c) => (
                  <li key={c.key} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 shrink-0">
                      {c.confirmed === true ? (
                        <Check className="size-4 text-primary" />
                      ) : c.confirmed === false ? (
                        <X className="size-4 text-destructive" />
                      ) : (
                        <Minus className="size-4 text-muted-foreground/60" />
                      )}
                    </span>
                    <span
                      className={cn(
                        c.confirmed === false && "text-muted-foreground line-through"
                      )}
                    >
                      {c.label}
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {c.confirmed === null
                          ? "claimed, unreviewed"
                          : `${c.pointsAwarded ?? c.points} pt${(c.pointsAwarded ?? c.points) === 1 ? "" : "s"}`}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-4 text-xs text-muted-foreground">
              <Link href="/rubric" className="hover:underline">
                How cards are rated →
              </Link>
            </p>
          </section>

          <Separator className="my-6" />

          <footer className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>Shot by {card.submitterName ?? "someone anonymous"}</span>
            <ReportButton threadId={card.id} />
          </footer>
        </div>
      </div>
    </div>
  );
}

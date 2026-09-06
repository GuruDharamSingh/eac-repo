"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { rateCard } from "@/lib/manage/actions";
import type { Criterion, Tier } from "@/lib/types";
import type { QueueCard } from "@/lib/manage/data";

interface RatingPanelProps {
  cards: QueueCard[];
  criteria: Criterion[];
  tiers: Tier[];
}

/**
 * The rating queue — the screen the owner actually lives in.
 *
 * One card at a time, big. The submitter's claims arrive pre-ticked so the job
 * is confirming or rejecting rather than starting from nothing, and the score
 * updates live as boxes change so the tier choice is informed. "Rate & next"
 * advances without a page load, because rating fifty cards should not be fifty
 * round trips.
 */
export function RatingPanel({ cards, criteria, tiers }: RatingPanelProps) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [pending, startTransition] = useTransition();

  const card = cards[index];

  // Re-keyed per card so moving on resets the form.
  const initial = useMemo(() => {
    const set = new Set<string>();
    for (const c of card?.claims ?? []) {
      if (c.confirmed !== false) set.add(c.key);
    }
    return set;
  }, [card]);

  const [confirmed, setConfirmed] = useState<Set<string>>(initial);
  const [note, setNote] = useState("");
  const [lastCardId, setLastCardId] = useState(card?.threadId);

  // Reset when the card changes (render-phase sync beats an effect here).
  if (card && card.threadId !== lastCardId) {
    setLastCardId(card.threadId);
    setConfirmed(initial);
    setNote("");
  }

  const score = useMemo(
    () =>
      criteria.reduce((n, c) => (confirmed.has(c.key) ? n + c.points : n), 0),
    [confirmed, criteria]
  );

  const suggested = useMemo(() => {
    const ordered = [...tiers].sort((a, b) => a.minScore - b.minScore);
    let match = ordered[0];
    for (const t of ordered) if (score >= t.minScore) match = t;
    return match;
  }, [score, tiers]);

  if (!card) {
    return (
      <div className="rounded-lg border border-dashed border-border p-16 text-center">
        <p className="text-lg font-medium">Nothing waiting.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Every live card has been rated.
        </p>
      </div>
    );
  }

  function submit(tierSlug: string) {
    startTransition(async () => {
      const res = await rateCard({
        threadId: card.threadId,
        tierSlug,
        confirmedKeys: [...confirmed],
        note: note || null,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't save that.");
        return;
      }
      toast.success(`Rated ${tiers.find((t) => t.slug === tierSlug)?.label ?? tierSlug}.`);

      if (index + 1 < cards.length) {
        setIndex(index + 1);
      } else {
        // Queue exhausted — refetch to pull in anything submitted since.
        router.refresh();
        setIndex(0);
      }
    });
  }

  const front = card.images.find((i) => i.role === "front") ?? card.images[0];
  const side = card.images.find((i) => i.role === "side");

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Card {index + 1} of {cards.length} waiting
        </p>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={index === 0 || pending}
            onClick={() => setIndex((i) => i - 1)}
          >
            Previous
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={index + 1 >= cards.length || pending}
            onClick={() => setIndex((i) => i + 1)}
          >
            Skip
          </Button>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <div className="grid grid-cols-2 gap-3">
            {[front, side].filter(Boolean).map((img, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-lg border border-border bg-muted"
              >
                <div className="aspect-[3/4]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img!.url}
                    alt={img!.role}
                    className="size-full object-cover"
                  />
                </div>
                <p className="p-2 text-center text-xs capitalize text-muted-foreground">
                  {img!.role}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <h2 className="font-display text-2xl font-bold">{card.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {card.speciesName ?? (
                <span className="italic">
                  {card.proposedSpeciesName
                    ? `proposed: ${card.proposedSpeciesName}`
                    : "unidentified"}
                </span>
              )}
              {card.areaName && ` · ${card.areaName}`}
              {card.submitterName && ` · by ${card.submitterName}`}
            </p>
            {card.story && <p className="mt-3 text-sm leading-relaxed">{card.story}</p>}
            <Link
              href={`/cards/${card.slug}`}
              target="_blank"
              className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Open the public card <ExternalLink className="size-3" />
            </Link>
          </div>
        </div>

        <aside>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-medium">Criteria</h3>
              <span className="font-mono text-sm">
                {score}/{criteria.reduce((n, c) => n + c.points, 0)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Ticked boxes are what the submitter and the machine claimed. Untick anything
              that isn&apos;t true.
            </p>

            <ul className="mt-3 space-y-2">
              {criteria.map((c) => {
                const claimed = card.claims.some((cl) => cl.key === c.key);
                return (
                  <li key={c.key}>
                    <label className="flex cursor-pointer items-start gap-2">
                      <Checkbox
                        checked={confirmed.has(c.key)}
                        onCheckedChange={(on) =>
                          setConfirmed((prev) => {
                            const next = new Set(prev);
                            if (on) next.add(c.key);
                            else next.delete(c.key);
                            return next;
                          })
                        }
                        className="mt-0.5"
                      />
                      <span className="text-sm leading-tight">
                        <span className={cn(!claimed && "text-muted-foreground")}>
                          {c.label}
                        </span>
                        <span className="ml-1 text-xs text-muted-foreground">
                          {c.points}
                        </span>
                        {c.source === "auto" && (
                          <span className="ml-1 text-[10px] uppercase text-primary">auto</span>
                        )}
                        {c.source === "owner" && (
                          <span className="ml-1 text-[10px] uppercase text-iridescent">
                            yours
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 space-y-1.5">
              <Label htmlFor="note" className="text-xs">
                A note on the card (optional)
              </Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why it got what it got"
                maxLength={200}
              />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <h3 className="font-medium">Your verdict</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              The score suggests <strong>{suggested?.label}</strong>. You are not bound by it.
            </p>
            <div className="mt-3 grid gap-2">
              {tiers.map((t) => (
                <Button
                  key={t.slug}
                  variant={t.slug === suggested?.slug ? "default" : "outline"}
                  disabled={pending}
                  onClick={() => submit(t.slug)}
                  className="justify-start gap-2"
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: t.accentHex }}
                    />
                  )}
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

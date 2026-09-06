"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { promoteProposedSpecies, updateSpeciesStatus } from "@/lib/manage/actions";
import type { Species } from "@/lib/types";

interface Proposal {
  threadId: string;
  slug: string;
  cardTitle: string;
  name: string;
}

/**
 * Species review.
 *
 * Two inputs feed the library: names contributors typed on a card (the common
 * case, handled at the top) and rows already in pigeon_species. Merging exists
 * because most proposals will be a second name for something already in the
 * guide, and deleting instead would orphan the cards pointing at it.
 */
export function SpeciesManager({
  species,
  proposals,
}: {
  species: Species[];
  proposals: Proposal[];
}) {
  const [pending, startTransition] = useTransition();
  const published = species.filter((s) => s.status === "published");

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(msg);
      else toast.error(res.error ?? "That didn't work.");
    });
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-display text-lg font-semibold">
          Proposed on cards ({proposals.length})
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Names contributors invented. Adding one creates the species and moves that card onto
          it.
        </p>

        {proposals.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No proposals waiting.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
            {proposals.map((p) => (
              <li key={p.threadId} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-[12rem] flex-1">
                  <p className="font-medium">{p.name}</p>
                  <Link
                    href={`/cards/${p.slug}`}
                    target="_blank"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    on “{p.cardTitle}”
                  </Link>
                </div>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    act(
                      () => promoteProposedSpecies({ threadId: p.threadId, name: p.name }),
                      `${p.name} added to the guide.`
                    )
                  }
                >
                  Add to the guide
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold">The library ({species.length})</h2>
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
          {species.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-[12rem] flex-1">
                <p className="flex items-center gap-2 font-medium">
                  {s.name}
                  <Badge variant={s.status === "published" ? "default" : "secondary"}>
                    {s.status}
                  </Badge>
                </p>
                {s.tagline && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{s.tagline}</p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {s.cardCount ?? 0} {s.cardCount === 1 ? "card" : "cards"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {s.status !== "published" && (
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      act(
                        () => updateSpeciesStatus({ speciesId: s.id, status: "published" }),
                        `${s.name} published.`
                      )
                    }
                  >
                    Publish
                  </Button>
                )}
                {s.status === "published" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      act(
                        () => updateSpeciesStatus({ speciesId: s.id, status: "proposed" }),
                        `${s.name} unpublished.`
                      )
                    }
                  >
                    Unpublish
                  </Button>
                )}

                {published.length > 1 && (
                  <select
                    className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                    defaultValue=""
                    disabled={pending}
                    onChange={(e) => {
                      const target = e.target.value;
                      e.target.value = "";
                      if (!target) return;
                      const into = species.find((x) => x.id === target);
                      if (
                        !confirm(
                          `Merge “${s.name}” into “${into?.name}”? Its ${s.cardCount ?? 0} cards move across.`
                        )
                      ) {
                        return;
                      }
                      act(
                        () =>
                          updateSpeciesStatus({
                            speciesId: s.id,
                            status: "merged",
                            mergedInto: target,
                          }),
                        "Merged."
                      );
                    }}
                  >
                    <option value="">Merge into…</option>
                    {published
                      .filter((x) => x.id !== s.id)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

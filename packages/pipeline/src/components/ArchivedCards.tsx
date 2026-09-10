"use client";

import { useState } from "react";
import { Archive, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { DeckCard } from "@elkdonis/nextcloud";
import { Button } from "../ui/button";

type ArchivedCard = DeckCard & { stackTitle: string };

/**
 * Deck's "Archived cards" view. Loaded on demand rather than with the board:
 * archived cards come from a separate endpoint (`/stacks/archived`), and most
 * visits never need them.
 */
export function ArchivedCards({ canWrite, onChanged }: { canWrite: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<ArchivedCard[] | null>(null);

  async function load() {
    const res = await fetch("/api/pipeline/archived");
    setCards(res.ok ? await res.json() : []);
  }

  async function unarchive(cardId: number) {
    const res = await fetch(`/api/pipeline/cards/${cardId}/state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });
    if (!res.ok) {
      toast.error("Could not bring that card back.");
      return;
    }
    await load();
    onChanged();
  }

  return (
    <div className="mt-8 border-t pt-4">
      <Button
        variant="ghost"
        className="text-muted-foreground"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && cards === null) void load();
        }}
      >
        <Archive className="size-4" />
        {open ? "Hide archived cards" : "Archived cards"}
      </Button>

      {open && (
        <div className="mt-3">
          {cards === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : cards.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing archived.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {cards.map((card) => (
                <li key={card.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="truncate">{card.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{card.stackTitle}</span>
                  {canWrite && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto h-7"
                      onClick={() => void unarchive(card.id)}
                    >
                      <Undo2 className="size-3.5" />
                      Un-archive
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

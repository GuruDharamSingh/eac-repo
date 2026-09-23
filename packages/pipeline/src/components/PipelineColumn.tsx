"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { MoreHorizontal, Plus } from "lucide-react";
import type { DeckCard } from "@elkdonis/nextcloud";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { SortablePipelineCard } from "./PipelineCard";
import type { StackState } from "../deck-ui";

/**
 * One Deck stack. Header carries the title, the card count and the add-card
 * button; the composer is an inline input that stays open for consecutive
 * adds (Enter commits, Escape closes) the way Deck's does.
 */
export function PipelineColumn({
  stack,
  readable = false,
  canWrite,
  canManage,
  onOpenCard,
  onAddCard,
  onRenameStack,
  onDeleteStack,
  renderCardMenu,
}: {
  stack: StackState;
  /** See PipelineBoard's `readable`. */
  readable?: boolean;
  canWrite: boolean;
  canManage: boolean;
  onOpenCard: (card: DeckCard) => void;
  onAddCard: (stackId: number, title: string) => Promise<boolean>;
  onRenameStack: (stackId: number, title: string) => void;
  onDeleteStack: (stackId: number) => void;
  renderCardMenu: (card: DeckCard, stackId: number) => ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `stack-${stack.id}` });
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (composing) inputRef.current?.focus();
  }, [composing]);

  async function submit() {
    const value = title.trim();
    if (!value || saving) return;
    setSaving(true);
    const ok = await onAddCard(stack.id, value);
    setSaving(false);
    if (ok) {
      setTitle("");
      inputRef.current?.focus();
    }
  }

  return (
    <section
      className={`flex flex-col self-stretch rounded-md border-2 border-foreground/25 bg-muted/40 ${
        readable ? "min-w-[15rem] flex-1 basis-0" : "w-72 shrink-0"
      } ${isOver ? "ring-2 ring-primary" : ""}`}
      aria-label={stack.title}
    >
      <header className="flex items-center gap-2 rounded-t-[4px] border-b-2 border-foreground/70 bg-background px-3 py-2.5">
        <h3
          className={
            readable
              ? "truncate text-[1.35rem] font-bold leading-tight text-foreground"
              : "truncate font-mono text-[0.7rem] font-bold uppercase tracking-[0.12em] text-foreground"
          }
        >
          {stack.title}
        </h3>
        <span
          className={
            readable
              ? "rounded-sm bg-foreground px-2 py-0.5 text-base font-bold text-background"
              : "rounded-sm bg-foreground px-1.5 font-mono text-[0.68rem] font-semibold text-background"
          }
          aria-label={`${stack.cards.length} card${stack.cards.length === 1 ? "" : "s"}`}
        >
          {stack.cards.length}
        </span>
        <div className="ml-auto flex items-center">
          {canWrite && (
            <Button
              size="icon"
              variant="ghost"
              className={readable ? "size-10" : "size-7"}
              aria-label={`Add a card to ${stack.title}`}
              onClick={() => setComposing(true)}
            >
              <Plus className={readable ? "size-5" : "size-4"} />
            </Button>
          )}
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={readable ? "size-10" : "size-7"}
                  aria-label={`Actions for ${stack.title}`}
                >
                  <MoreHorizontal className={readable ? "size-5" : "size-4"} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    const next = window.prompt("Rename this list", stack.title);
                    if (next && next.trim() && next.trim() !== stack.title) {
                      onRenameStack(stack.id, next.trim());
                    }
                  }}
                >
                  Rename list
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    const warning =
                      stack.cards.length > 0
                        ? `Delete "${stack.title}" and its ${stack.cards.length} card(s)? This also removes them from Nextcloud.`
                        : `Delete "${stack.title}"?`;
                    if (window.confirm(warning)) onDeleteStack(stack.id);
                  }}
                >
                  Delete list
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <SortableContext items={stack.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={`flex flex-1 flex-col gap-2 px-2 pb-2 pt-2 ${readable ? "min-h-[7rem]" : "min-h-[60vh]"}`}>
          {stack.cards.length === 0 && !composing ? (
            <p className={`px-1 py-3 text-muted-foreground ${readable ? "text-base" : "text-xs"}`}>No cards here yet.</p>
          ) : (
            stack.cards.map((card) => (
              <SortablePipelineCard
                key={card.id}
                card={card}
                onOpen={onOpenCard}
                readable={readable}
                menu={renderCardMenu(card, stack.id)}
                disabled={!canWrite}
              />
            ))
          )}

          {composing && (
            <div className="rounded-md border bg-card p-2">
              <Input
                ref={inputRef}
                value={title}
                disabled={saving}
                placeholder="Card name"
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void submit();
                  }
                  if (e.key === "Escape") {
                    setComposing(false);
                    setTitle("");
                  }
                }}
                className="h-8 text-sm"
              />
              <div className="mt-2 flex gap-2">
                <Button size="sm" className="h-7" disabled={saving} onClick={() => void submit()}>
                  Add card
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  onClick={() => {
                    setComposing(false);
                    setTitle("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

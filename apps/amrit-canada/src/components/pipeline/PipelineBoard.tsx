"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { DeckBoardDetail, DeckCard, DeckStack } from "@elkdonis/nextcloud";
import { PipelineCard } from "./PipelineCard";

interface StackState extends DeckStack {
  cards: DeckCard[];
}

function toStackState(stacks: DeckStack[]): StackState[] {
  return [...stacks]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ ...s, cards: [...(s.cards ?? [])].sort((a, b) => a.order - b.order) }));
}

function findStack(stacks: StackState[], cardId: number): StackState | undefined {
  return stacks.find((s) => s.cards.some((c) => c.id === cardId));
}

function Column({ stack, writesEnabled }: { stack: StackState; writesEnabled: boolean }) {
  const { setNodeRef } = useDroppable({ id: `stack-${stack.id}` });

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between px-3 py-2">
        <h3 className="text-sm font-semibold">{stack.title}</h3>
        <span className="text-xs text-muted-foreground">{stack.cards.length}</span>
      </div>
      <SortableContext items={stack.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-24 flex-col gap-2 px-2 pb-2">
          {stack.cards.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">No cards here yet.</p>
          ) : (
            stack.cards.map((card) => <PipelineCard key={card.id} card={card} />)
          )}
        </div>
      </SortableContext>
      {!writesEnabled && (
        <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">Read-only for now</p>
      )}
    </div>
  );
}

export function PipelineBoard({
  board,
  writesEnabled,
}: {
  board: DeckBoardDetail;
  writesEnabled: boolean;
}) {
  const [stacks, setStacks] = useState<StackState[]>(() => toStackState(board.stacks));
  const [activeCard, setActiveCard] = useState<DeckCard | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragStart(event: DragStartEvent) {
    const cardId = Number(event.active.id);
    const stack = findStack(stacks, cardId);
    setActiveCard(stack?.cards.find((c) => c.id === cardId) ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const cardId = Number(active.id);
    const fromStack = findStack(stacks, cardId);
    if (!fromStack) return;
    const card = fromStack.cards.find((c) => c.id === cardId);
    if (!card) return;

    const overId = String(over.id);
    const toStackId = overId.startsWith("stack-")
      ? Number(overId.slice("stack-".length))
      : findStack(stacks, Number(over.id))?.id;
    if (toStackId === undefined) return;

    const toStack = stacks.find((s) => s.id === toStackId);
    if (!toStack) return;

    const overCardId = overId.startsWith("stack-") ? null : Number(over.id);
    const destIndex = overCardId
      ? toStack.cards.findIndex((c) => c.id === overCardId)
      : toStack.cards.length;

    if (fromStack.id === toStack.id && destIndex === fromStack.cards.findIndex((c) => c.id === cardId)) {
      return; // dropped in place
    }

    const previous = stacks;

    // Optimistic local move — always shown, so the interaction feels real
    // even when writes are disabled.
    setStacks((current) =>
      current.map((s) => {
        if (s.id === fromStack.id && s.id === toStack.id) {
          const withoutCard = s.cards.filter((c) => c.id !== cardId);
          withoutCard.splice(destIndex, 0, card);
          return { ...s, cards: withoutCard };
        }
        if (s.id === fromStack.id) return { ...s, cards: s.cards.filter((c) => c.id !== cardId) };
        if (s.id === toStack.id) {
          const withCard = [...s.cards];
          withCard.splice(destIndex, 0, card);
          return { ...s, cards: withCard };
        }
        return s;
      })
    );

    if (!writesEnabled) {
      // Visual-only: snap back once the drop animation settles, no network call.
      setStacks(previous);
      return;
    }

    try {
      const res = await fetch(`/api/pipeline/cards/${cardId}/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromStackId: fromStack.id, toStackId: toStack.id, order: destIndex }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (error) {
      console.error("[amrit-canada] pipeline move failed, reverting:", error);
      setStacks(previous);
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stacks.map((stack) => (
          <Column key={stack.id} stack={stack} writesEnabled={writesEnabled} />
        ))}
      </div>
      <DragOverlay>{activeCard && <PipelineCard card={activeCard} />}</DragOverlay>
    </DndContext>
  );
}

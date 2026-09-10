"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { DeckCard } from "@elkdonis/nextcloud";
import type { OrgDeckBoard } from "@elkdonis/services";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ArchivedCards } from "./ArchivedCards";
import { PipelineCard } from "./PipelineCard";
import { PipelineCardDialog, type Assignee, type CardPatch } from "./PipelineCardDialog";
import { PipelineCardMenu } from "./PipelineCardMenu";
import { PipelineColumn } from "./PipelineColumn";
import { findStackOf, toStackState, type StackState } from "../deck-ui";

/**
 * The org's Deck board.
 *
 * Every mutation is optimistic against local state and then confirmed by the
 * server; on failure the previous state is restored and the reason is shown,
 * so what's on screen never silently diverges from what's in Nextcloud. After
 * a successful write we refresh the route so the server's copy (card ids,
 * re-normalised orders, another member's concurrent edits) becomes the truth
 * again.
 */
export function PipelineBoard({
  board,
  assignees,
  viewerUid,
  canWrite,
  canManage,
}: {
  board: OrgDeckBoard;
  /** Board participants a card can be assigned to (Nextcloud users only). */
  assignees: Assignee[];
  /** The viewer's own Nextcloud uid, when they have one on this board. */
  viewerUid: string | null;
  /** Any member: create, move and edit cards. */
  canWrite: boolean;
  /** Owner/guide: add, rename and delete lists, and delete cards. */
  canManage: boolean;
}) {
  const router = useRouter();
  const [stacks, setStacks] = useState<StackState[]>(() => toStackState(board.stacks));
  const [activeCard, setActiveCard] = useState<DeckCard | null>(null);
  const [openCardId, setOpenCardId] = useState<number | null>(null);
  const [addingStack, setAddingStack] = useState(false);
  const [newStackTitle, setNewStackTitle] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Server state wins whenever the route refreshes — including after our own
  // writes, which is what reconciles optimistic ids and orders.
  useEffect(() => {
    setStacks(toStackState(board.stacks));
  }, [board]);

  const openCard = openCardId
    ? (stacks.flatMap((s) => s.cards).find((c) => c.id === openCardId) ?? null)
    : null;

  // "Assign to me" is only offered when the viewer's Nextcloud account is
  // actually a participant on this board — Deck rejects assigning anyone else.
  const assignableUid =
    viewerUid && assignees.some((a) => a.uid === viewerUid) ? viewerUid : null;

  function fail(message: string, previous: StackState[]) {
    setStacks(previous);
    toast.error(message);
  }

  async function send(url: string, init: RequestInit): Promise<boolean> {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    return res.ok;
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const cardId = Number(active.id);
    const fromStack = findStackOf(stacks, cardId);
    if (!fromStack) return;
    const card = fromStack.cards.find((c) => c.id === cardId);
    if (!card) return;

    const overId = String(over.id);
    const toStackId = overId.startsWith("stack-")
      ? Number(overId.slice("stack-".length))
      : findStackOf(stacks, Number(over.id))?.id;
    if (toStackId === undefined) return;

    const toStack = stacks.find((s) => s.id === toStackId);
    if (!toStack) return;

    const overCardId = overId.startsWith("stack-") ? null : Number(over.id);
    const destIndex =
      overCardId === null
        ? toStack.cards.length
        : toStack.cards.findIndex((c) => c.id === overCardId);
    const fromIndex = fromStack.cards.findIndex((c) => c.id === cardId);
    if (fromStack.id === toStack.id && destIndex === fromIndex) return;

    const previous = stacks;
    setStacks((current) =>
      current.map((s) => {
        if (s.id === fromStack.id && s.id === toStack.id) {
          const reordered = s.cards.filter((c) => c.id !== cardId);
          reordered.splice(destIndex, 0, card);
          return { ...s, cards: reordered };
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

    const ok = await send(`/api/pipeline/cards/${cardId}/reorder`, {
      method: "PUT",
      body: JSON.stringify({ toStackId, order: destIndex }),
    });
    if (!ok) return fail("Could not move that card.", previous);
    router.refresh();
  }

  async function addCard(stackId: number, title: string): Promise<boolean> {
    const res = await fetch("/api/pipeline/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stackId, title }),
    });
    if (!res.ok) {
      toast.error("Could not add that card.");
      return false;
    }
    const card: DeckCard = await res.json();
    setStacks((current) =>
      current.map((s) => (s.id === stackId ? { ...s, cards: [...s.cards, card] } : s))
    );
    router.refresh();
    return true;
  }

  async function saveCard(cardId: number, patch: CardPatch): Promise<boolean> {
    const previous = stacks;
    setStacks((current) =>
      current.map((s) => ({
        ...s,
        cards: s.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)),
      }))
    );
    const ok = await send(`/api/pipeline/cards/${cardId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (!ok) {
      fail("Could not save that card.", previous);
      return false;
    }
    router.refresh();
    return true;
  }

  async function toggleLabel(cardId: number, labelId: number, assigned: boolean) {
    const label = board.labels.find((l) => l.id === labelId);
    if (!label) return;
    const previous = stacks;
    setStacks((current) =>
      current.map((s) => ({
        ...s,
        cards: s.cards.map((c) =>
          c.id === cardId
            ? {
                ...c,
                labels: assigned
                  ? [...(c.labels ?? []), label]
                  : (c.labels ?? []).filter((l) => l.id !== labelId),
              }
            : c
        ),
      }))
    );
    const ok = await send(`/api/pipeline/cards/${cardId}/labels`, {
      method: "PUT",
      body: JSON.stringify({ labelId, assigned }),
    });
    if (!ok) return fail("Could not change that label.", previous);
    router.refresh();
  }

  async function toggleDone(cardId: number, done: boolean) {
    const previous = stacks;
    const stamp = done ? new Date().toISOString() : null;
    setStacks((current) =>
      current.map((s) => ({
        ...s,
        cards: s.cards.map((c) => (c.id === cardId ? { ...c, done: stamp } : c)),
      }))
    );
    const ok = await send(`/api/pipeline/cards/${cardId}/state`, {
      method: "PUT",
      body: JSON.stringify({ done }),
    });
    if (!ok) return fail("Could not change that card.", previous);
    router.refresh();
  }

  /** Archived cards leave the board but stay in Nextcloud's board archive. */
  async function archiveCard(cardId: number) {
    const previous = stacks;
    setStacks((current) =>
      current.map((s) => ({ ...s, cards: s.cards.filter((c) => c.id !== cardId) }))
    );
    const ok = await send(`/api/pipeline/cards/${cardId}/state`, {
      method: "PUT",
      body: JSON.stringify({ archived: true }),
    });
    if (!ok) return fail("Could not archive that card.", previous);
    toast.success("Card archived — find it in the board's archive in Nextcloud.");
    router.refresh();
  }

  async function toggleAssignee(cardId: number, uid: string, assigned: boolean) {
    const ok = await send(`/api/pipeline/cards/${cardId}/assignees`, {
      method: "PUT",
      body: JSON.stringify({ userId: uid, assigned }),
    });
    if (!ok) {
      toast.error("Could not change who this card is assigned to.");
      return;
    }
    router.refresh();
  }

  /** The card menu's "Move card" — same server call the drag makes. */
  async function moveCardToStack(cardId: number, toStackId: number) {
    const previous = stacks;
    const card = stacks.flatMap((s) => s.cards).find((c) => c.id === cardId);
    if (!card) return;
    setStacks((current) =>
      current.map((s) => {
        if (s.cards.some((c) => c.id === cardId)) {
          return { ...s, cards: s.cards.filter((c) => c.id !== cardId) };
        }
        if (s.id === toStackId) return { ...s, cards: [...s.cards, card] };
        return s;
      })
    );
    const order = stacks.find((s) => s.id === toStackId)?.cards.length ?? 0;
    const ok = await send(`/api/pipeline/cards/${cardId}/reorder`, {
      method: "PUT",
      body: JSON.stringify({ toStackId, order }),
    });
    if (!ok) return fail("Could not move that card.", previous);
    router.refresh();
  }

  function editTitle(card: DeckCard) {
    const next = window.prompt("Card title", card.title);
    if (next && next.trim() && next.trim() !== card.title) {
      void saveCard(card.id, { title: next.trim() });
    }
  }

  async function deleteCard(cardId: number) {
    const previous = stacks;
    setStacks((current) =>
      current.map((s) => ({ ...s, cards: s.cards.filter((c) => c.id !== cardId) }))
    );
    const ok = await send(`/api/pipeline/cards/${cardId}`, { method: "DELETE" });
    if (!ok) return fail("Could not delete that card.", previous);
    router.refresh();
  }

  async function addStack() {
    const title = newStackTitle.trim();
    if (!title) return;
    const ok = await send("/api/pipeline/stacks", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    if (!ok) {
      toast.error("Could not add that list.");
      return;
    }
    setNewStackTitle("");
    setAddingStack(false);
    router.refresh();
  }

  async function renameStack(stackId: number, title: string) {
    const previous = stacks;
    setStacks((current) => current.map((s) => (s.id === stackId ? { ...s, title } : s)));
    const ok = await send(`/api/pipeline/stacks/${stackId}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
    if (!ok) return fail("Could not rename that list.", previous);
    router.refresh();
  }

  async function deleteStack(stackId: number) {
    const previous = stacks;
    setStacks((current) => current.filter((s) => s.id !== stackId));
    const ok = await send(`/api/pipeline/stacks/${stackId}`, { method: "DELETE" });
    if (!ok) return fail("Could not delete that list.", previous);
    router.refresh();
  }

  function handleDragStart(event: DragStartEvent) {
    const cardId = Number(event.active.id);
    setActiveCard(findStackOf(stacks, cardId)?.cards.find((c) => c.id === cardId) ?? null);
  }

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex items-stretch gap-4 overflow-x-auto pb-4">
          {stacks.map((stack) => (
            <PipelineColumn
              key={stack.id}
              stack={stack}
              canWrite={canWrite}
              canManage={canManage}
              onOpenCard={(card) => setOpenCardId(card.id)}
              onAddCard={addCard}
              onRenameStack={renameStack}
              onDeleteStack={deleteStack}
              renderCardMenu={(card, stackId) => (
                <PipelineCardMenu
                  card={card}
                  stacks={stacks}
                  currentStackId={stackId}
                  canWrite={canWrite}
                  canManage={canManage}
                  assignableUid={assignableUid}
                  onOpenDetails={() => setOpenCardId(card.id)}
                  onEditTitle={() => editTitle(card)}
                  onAssignSelf={(assigned) => {
                    if (assignableUid) void toggleAssignee(card.id, assignableUid, assigned);
                  }}
                  onToggleDone={() => void toggleDone(card.id, !card.done)}
                  onMove={(toStackId) => void moveCardToStack(card.id, toStackId)}
                  onArchive={() => void archiveCard(card.id)}
                  onDelete={() => void deleteCard(card.id)}
                />
              )}
            />
          ))}

          {canManage && (
            <div className="w-72 shrink-0">
              {addingStack ? (
                <div className="rounded-lg border bg-muted/30 p-2">
                  <Input
                    autoFocus
                    value={newStackTitle}
                    placeholder="List name"
                    className="h-8 text-sm"
                    onChange={(e) => setNewStackTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void addStack();
                      }
                      if (e.key === "Escape") {
                        setAddingStack(false);
                        setNewStackTitle("");
                      }
                    }}
                  />
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" className="h-7" onClick={() => void addStack()}>
                      Add list
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7"
                      onClick={() => {
                        setAddingStack(false);
                        setNewStackTitle("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setAddingStack(true)}
                >
                  <Plus className="size-4" />
                  Add list
                </Button>
              )}
            </div>
          )}
        </div>

        <DragOverlay>{activeCard && <PipelineCard card={activeCard} overlay />}</DragOverlay>
      </DndContext>

      <ArchivedCards canWrite={canWrite} onChanged={() => router.refresh()} />

      <PipelineCardDialog
        card={openCard}
        boardLabels={board.labels}
        assignees={assignees}
        canWrite={canWrite}
        canManage={canManage}
        onClose={() => setOpenCardId(null)}
        onSave={saveCard}
        onToggleLabel={toggleLabel}
        onToggleAssignee={toggleAssignee}
        onToggleDone={toggleDone}
        onDelete={deleteCard}
      />
    </>
  );
}

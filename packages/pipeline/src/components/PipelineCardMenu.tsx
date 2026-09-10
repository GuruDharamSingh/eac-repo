"use client";

import { useState } from "react";
import {
  Archive,
  ArrowRightLeft,
  Check,
  MoreHorizontal,
  Pencil,
  SquareUser,
  Trash2,
  WalletCards,
} from "lucide-react";
import type { DeckCard } from "@elkdonis/nextcloud";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import type { StackState } from "../deck-ui";

/**
 * The per-card "..." menu, carrying the same actions as Nextcloud Deck's:
 * card details, edit title, assign to me, mark as done, move card, archive,
 * delete. Two of Deck's entries are deliberately absent — "Post to a
 * conversation" (Talk, not wired up here) and copy (Deck has no copy endpoint
 * in its REST API).
 */
export function PipelineCardMenu({
  card,
  stacks,
  currentStackId,
  canWrite,
  canManage,
  /** The viewer's Nextcloud uid, when they have one AND are on the board. */
  assignableUid,
  onOpenDetails,
  onEditTitle,
  onAssignSelf,
  onToggleDone,
  onMove,
  onArchive,
  onDelete,
}: {
  card: DeckCard;
  stacks: StackState[];
  currentStackId: number;
  canWrite: boolean;
  canManage: boolean;
  assignableUid: string | null;
  onOpenDetails: () => void;
  onEditTitle: () => void;
  onAssignSelf: (assigned: boolean) => void;
  onToggleDone: () => void;
  onMove: (toStackId: number) => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isDone = Boolean(card.done);
  const assignedToMe =
    assignableUid !== null &&
    (card.assignedUsers ?? []).some((a) => a.participant.uid === assignableUid);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="size-6 shrink-0 text-muted-foreground"
          aria-label={`Actions for ${card.title}`}
          // The tile is a drag handle; without this the menu button starts a drag.
          onPointerDown={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={onOpenDetails}>
          <WalletCards className="size-4" />
          Card details
        </DropdownMenuItem>

        {canWrite && (
          <>
            <DropdownMenuItem onSelect={onEditTitle}>
              <Pencil className="size-4" />
              Edit title
            </DropdownMenuItem>

            {assignableUid && (
              <DropdownMenuItem onSelect={() => onAssignSelf(!assignedToMe)}>
                <SquareUser className="size-4" />
                {assignedToMe ? "Unassign me" : "Assign to me"}
              </DropdownMenuItem>
            )}

            <DropdownMenuItem onSelect={onToggleDone}>
              <Check className="size-4" />
              {isDone ? "Mark as undone" : "Mark as done"}
            </DropdownMenuItem>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ArrowRightLeft className="size-4" />
                Move card
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {stacks
                  .filter((s) => s.id !== currentStackId)
                  .map((stack) => (
                    <DropdownMenuItem key={stack.id} onSelect={() => onMove(stack.id)}>
                      {stack.title}
                    </DropdownMenuItem>
                  ))}
                {stacks.length <= 1 && (
                  <DropdownMenuItem disabled>No other list</DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onArchive}>
              <Archive className="size-4" />
              Archive card
            </DropdownMenuItem>
          </>
        )}

        {canManage && (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              if (window.confirm(`Delete "${card.title}" from the Nextcloud board?`)) onDelete();
            }}
          >
            <Trash2 className="size-4" />
            Delete card
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

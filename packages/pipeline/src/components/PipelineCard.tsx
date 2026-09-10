"use client";

import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlignLeft, CalendarDays, Check, MessageSquare, Paperclip } from "lucide-react";
import type { DeckCard } from "@elkdonis/nextcloud";
import { cn } from "../ui/utils";
import { DUE_CLASSES, dueState, formatDue, labelTextColor } from "../deck-ui";

/**
 * A Deck card tile: label chips, title, then a footer of due date, the
 * has-description / attachment / comment indicators, and assignee initials —
 * the same anatomy and order Nextcloud Deck renders.
 */
export function PipelineCard({
  card,
  onOpen,
  menu,
  dragging,
  overlay,
}: {
  card: DeckCard;
  onOpen?: (card: DeckCard) => void;
  /** The per-card "..." menu, omitted in the drag overlay. */
  menu?: ReactNode;
  dragging?: boolean;
  /** Rendered inside DragOverlay: no sortable wiring, no click target. */
  overlay?: boolean;
}) {
  const labels = card.labels ?? [];
  const assignees = card.assignedUsers ?? [];
  const due = card.duedate ? new Date(card.duedate) : null;
  const hasDue = due !== null && !Number.isNaN(due.getTime());
  const isDone = Boolean(card.done);

  return (
    <div
      className={cn(
        "rounded-sm border border-foreground/30 bg-card p-3 text-left text-sm shadow-sm transition-shadow",
        !overlay && "hover:shadow-md",
        dragging && "opacity-40",
        overlay && "rotate-2 shadow-lg"
      )}
    >
      {labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {labels.map((label) => (
            <span
              key={label.id}
              className="rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight"
              style={{ backgroundColor: `#${label.color}`, color: labelTextColor(label.color) }}
            >
              {label.title}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-start gap-1">
        {isDone && (
          <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Done" />
        )}
        <button
          type="button"
          disabled={overlay}
          onClick={() => onOpen?.(card)}
          className="flex-1 text-left font-medium leading-snug hover:underline disabled:cursor-default disabled:no-underline"
        >
          {card.title}
        </button>
        {menu}
      </div>

      {(hasDue || card.description || card.attachmentCount || card.commentsCount || assignees.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {hasDue && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5",
                DUE_CLASSES[dueState(due)]
              )}
            >
              <CalendarDays className="size-3" aria-hidden />
              {formatDue(due)}
            </span>
          )}
          {card.description && <AlignLeft className="size-3.5" aria-label="Has a description" />}
          {(card.attachmentCount ?? 0) > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <Paperclip className="size-3.5" aria-hidden />
              {card.attachmentCount}
            </span>
          )}
          {(card.commentsCount ?? 0) > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <MessageSquare className="size-3.5" aria-hidden />
              {card.commentsCount}
            </span>
          )}
          <span className="ml-auto flex -space-x-1">
            {assignees.map((a) => (
              <span
                key={a.id}
                title={a.participant.displayname}
                className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium ring-1 ring-background"
              >
                {a.participant.displayname.charAt(0).toUpperCase()}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

/** The tile as a drag handle — the whole card moves, as in Deck. */
export function SortablePipelineCard({
  card,
  onOpen,
  menu,
  disabled,
}: {
  card: DeckCard;
  onOpen: (card: DeckCard) => void;
  menu?: ReactNode;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(!disabled && "cursor-grab active:cursor-grabbing")}
    >
      <PipelineCard card={card} onOpen={onOpen} menu={menu} dragging={isDragging} />
    </div>
  );
}

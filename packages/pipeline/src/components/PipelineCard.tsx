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
  readable = false,
}: {
  card: DeckCard;
  onOpen?: (card: DeckCard) => void;
  /** The per-card "..." menu, omitted in the drag overlay. */
  menu?: ReactNode;
  dragging?: boolean;
  /** Rendered inside DragOverlay: no sortable wiring, no click target. */
  overlay?: boolean;
  /**
   * Large type, plus the first lines of the description and the assignees'
   * names under the title — so a card says what it is about without being
   * opened. See PipelineBoard's `readable`.
   */
  readable?: boolean;
}) {
  const labels = card.labels ?? [];
  const assignees = card.assignedUsers ?? [];
  const due = card.duedate ? new Date(card.duedate) : null;
  const hasDue = due !== null && !Number.isNaN(due.getTime());
  const isDone = Boolean(card.done);
  const summary = readable ? describe(card.description) : "";

  return (
    <div
      className={cn(
        "rounded-sm border border-foreground/30 bg-card text-left shadow-sm transition-shadow",
        readable ? "p-3.5 text-base" : "p-3 text-sm",
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
              className={`rounded px-1.5 py-0.5 font-medium leading-tight ${readable ? "text-sm" : "text-[11px]"}`}
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
          className="flex-1 text-left leading-snug hover:underline disabled:cursor-default disabled:no-underline"
          // Inline, not utilities: a host whose own stylesheet has an
          // unlayered `button {}` rule (IFAC's does) beats every Tailwind
          // class, and the title drew as a grey bordered box.
          style={{ background: "transparent", border: 0, padding: 0, color: "inherit", font: "inherit" }}
        >
          <span className={readable ? "text-[1.15rem] font-bold" : "font-medium"}>{card.title}</span>
        </button>
        {menu}
      </div>

      {summary && <p className="mt-1.5 line-clamp-3 text-[0.98rem] leading-snug text-foreground/85">{summary}</p>}
      {/* No notes yet: say when it was added and where the notes go, so the
          line under the title is never empty in readable mode. */}
      {readable && !summary && (
        <p className="mt-1.5 text-[0.95rem] leading-snug text-foreground/80">
          {addedOn(card.createdAt)}No notes yet &mdash; open it to add some.
        </p>
      )}

      {(hasDue || card.description || card.attachmentCount || card.commentsCount || assignees.length > 0) && (
        <div className={`mt-2 flex flex-wrap items-center gap-2 ${readable ? "text-sm text-foreground/80" : "text-xs text-muted-foreground"}`}>
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
          {readable && assignees.length > 0 ? (
            <span className="ml-auto">
              {assignees.map((a) => a.participant.displayname).join(", ")}
            </span>
          ) : (
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
          )}
        </div>
      )}
    </div>
  );
}

/** "Added Sep 21 · " from Deck's createdAt (unix seconds), or nothing. */
function addedOn(createdAt: number | undefined): string {
  if (!createdAt) return "";
  const d = new Date(createdAt * 1000);
  if (Number.isNaN(d.getTime())) return "";
  // UTC on both sides of hydration: the server and the reader may be in
  // different zones, and a day-boundary card would otherwise mismatch.
  return `Added ${d.toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" })} · `;
}

/**
 * A card's description as one plain line of prose. Deck stores Markdown, and
 * a checklist or heading marker at the front of a teaser reads as noise.
 */
function describe(markdown: string | null | undefined): string {
  if (!markdown) return "";
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*(#{1,6}|[-*+]|\d+\.)\s+(\[[ xX]\]\s+)?/gm, "")
    .replace(/[*_`~>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The tile as a drag handle — the whole card moves, as in Deck. */
export function SortablePipelineCard({
  card,
  onOpen,
  menu,
  disabled,
  readable,
}: {
  card: DeckCard;
  onOpen: (card: DeckCard) => void;
  menu?: ReactNode;
  disabled: boolean;
  readable?: boolean;
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
      <PipelineCard card={card} onOpen={onOpen} menu={menu} dragging={isDragging} readable={readable} />
    </div>
  );
}

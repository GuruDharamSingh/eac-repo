"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DeckCard } from "@elkdonis/nextcloud";
import { cn } from "@/lib/utils";

export function PipelineCard({ card }: { card: DeckCard }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  const dueDate = card.duedate ? new Date(card.duedate) : null;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-grab rounded-md border bg-card p-3 text-sm shadow-sm active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
    >
      <p className="font-medium">{card.title}</p>
      {(dueDate || card.assignedUsers.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {dueDate && <span>{dueDate.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</span>}
          {card.assignedUsers.map((a) => (
            <span
              key={a.id}
              className="rounded-full bg-muted px-2 py-0.5"
              title={a.participant.displayname}
            >
              {a.participant.displayname.charAt(0).toUpperCase()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

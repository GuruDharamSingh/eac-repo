"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { LibraryNoteView } from "@elkdonis/astro-corpus/server";
import { libraryNoteAction } from "@/app/hub/studio/library/actions";
import { cn } from "@/lib/utils";

/**
 * A free-text note of the owner's on one Library entry (a silo, a keyword, a
 * passage, a value, a glossary term…), for an AI to read later. `box` is the
 * "Your note" box at the top of a page; otherwise it is a small pencil that
 * opens an inline text box. A saved note shows with its date and can be
 * edited (the latest wins, earlier wordings are kept); saving it empty
 * removes it.
 */
export function LibraryNote({
  targetType,
  targetId,
  silo,
  context,
  note,
  box,
}: {
  targetType: "silo" | "keyword" | "passage" | "correspondence" | "term" | "section" | "person" | "reading";
  targetId: string;
  silo: { type: string; subject: string };
  /** A short snapshot of what the note is attached to, stored with it. */
  context: string;
  note?: LibraryNoteView;
  box?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note?.text ?? "");
  const save = () =>
    startTransition(async () => {
      const r = await libraryNoteAction({ target_type: targetType, target_id: targetId, silo, text, context });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast(text.trim() ? "Note saved" : "Note removed");
      setEditing(false);
      router.refresh();
    });

  if (!editing && !note)
    return box ? (
      <button type="button" onClick={() => setEditing(true)} className="mt-3 w-full rounded-xl border border-dashed border-border px-4 py-2.5 text-left text-sm text-muted-foreground hover:border-primary/60">
        ✎ Your note: write anything you want remembered about this
      </button>
    ) : (
      <button type="button" onClick={() => setEditing(true)} title="Add a note" aria-label="Add a note" className="shrink-0 px-1 text-xs text-muted-foreground hover:text-primary">
        ✎
      </button>
    );
  return (
    <div className={cn("basis-full", box ? "mt-3 rounded-xl border border-gold/60 bg-gold/5 px-4 py-3" : "mt-1 rounded-lg border border-gold/50 bg-gold/5 px-2.5 py-1.5")}>
      {box && <p className="text-xs font-semibold uppercase tracking-wide text-gold">Your note</p>}
      {editing ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={box ? 4 : 2}
            maxLength={4000}
            autoFocus
            placeholder="Your note (kept for the AI to read later)"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="mt-1 flex items-center gap-2 text-xs">
            <button type="button" disabled={pending || text.trim() === (note?.text ?? "")} onClick={save} className="rounded-lg border border-primary px-3 py-1 text-primary disabled:opacity-40">
              {note && !text.trim() ? "Remove note" : "Save note"}
            </button>
            <button type="button" onClick={() => (setText(note?.text ?? ""), setEditing(false))} className="text-muted-foreground">
              Cancel
            </button>
          </div>
        </>
      ) : (
        note && (
          <p className="whitespace-pre-line text-sm">
            {note.text}{" "}
            <span className="text-[11px] text-muted-foreground">
              · {note.createdAt.slice(0, 10)}
              {note.versions > 1 ? ` · edited ${note.versions - 1}×` : ""}{" "}
            </span>
            <button type="button" onClick={() => setEditing(true)} className="text-[11px] text-primary">
              Edit
            </button>
          </p>
        )
      )}
    </div>
  );
}

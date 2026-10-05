"use client";

import { useState } from "react";
import { Check, MessageSquare, Trash2, Undo2 } from "lucide-react";
import { withBase } from "@/lib/base-path";
import type { Passage, PassageNote } from "@/lib/paath";

/** auto: Gurmukhi | English side by side on a wide screen, English alone on a narrow one. */
export type TextView = "auto" | "both" | "gurmukhi" | "english";

const time = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

/** Where a passage sits in the Granth, outermost first, without repeating itself. */
export function passagePlace(p: Passage): string[] {
  const out = [p.sectionGurmukhi ? `${p.section} · ${p.sectionGurmukhi}` : p.section];
  if (p.vaar) out.push(p.vaar);
  else if (p.subsection && p.subsection !== p.heading) out.push(p.subsection);
  return out;
}

export function PassageCard({
  passage,
  view,
  onRead,
  onUndo,
  busy,
  compact = false,
  readOnly = false,
}: {
  passage: Passage;
  view: TextView;
  onRead?: (p: Passage) => void;
  onUndo?: (p: Passage) => void;
  busy?: boolean;
  compact?: boolean;
  /** The public Granth: text only. */
  readOnly?: boolean;
}) {
  const [notes, setNotes] = useState<PassageNote[]>(passage.notes);
  const [open, setOpen] = useState(passage.notes.length > 0 && !compact);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = Boolean(passage.doneAt);

  async function save() {
    if (!draft.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch(withBase("/api/akhand-path/note"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unitId: passage.id, body: draft }),
    }).catch(() => null);
    const json = res?.ok ? ((await res.json()) as { note: PassageNote }) : null;
    setSaving(false);
    if (!json) return setError("Your thought was not saved. Try again.");
    setNotes((n) => [...n, json.note]);
    setDraft("");
  }

  async function remove(id: string) {
    const res = await fetch(withBase("/api/akhand-path/note"), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => null);
    if (res?.ok) setNotes((n) => n.filter((x) => x.id !== id));
  }

  return (
    <article className="paath-card" data-done={done} data-compact={compact}>
      <header className="paath-card__head">
        <span className="paath-card__ang">{passage.label}</span>
        <span className="paath-card__place">{passagePlace(passage).join(" › ")}</span>
      </header>
      {passage.heading && <p className="paath-card__heading">{passage.heading}</p>}
      <p className="paath-card__meta">
        {passage.authors.join(", ")}
        {passage.form ? ` · ${passage.form}` : ""}
        {passage.parts > 1 ? ` · part ${passage.part} of ${passage.parts}` : ""}
      </p>

      {!compact && (
        <div className="paath-card__texts" data-view={view}>
          {view !== "english" && <p className="paath-card__gurmukhi" lang="pa">{passage.gurmukhi}</p>}
          {view !== "gurmukhi" && <p className="paath-card__english">{passage.english}</p>}
        </div>
      )}

      {!readOnly && (
      <footer className="paath-card__foot">
        {done ? (
          <>
            <span className="paath-card__done">
              <Check size={14} aria-hidden /> Read {passage.doneAt ? time(passage.doneAt) : ""}{passage.doneBy ? ` · ${passage.doneBy}` : ""}
            </span>
            {onUndo && (
              <button type="button" className="paath-link" onClick={() => onUndo(passage)} disabled={busy}>
                <Undo2 size={13} aria-hidden /> Undo
              </button>
            )}
          </>
        ) : (
          onRead && (
            <button type="button" className="btn btn--primary paath-card__read" onClick={() => onRead(passage)} disabled={busy}>
              <Check size={15} aria-hidden /> Read
            </button>
          )
        )}
        <button type="button" className="paath-link" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <MessageSquare size={13} aria-hidden /> {notes.length ? `Thoughts (${notes.length})` : "Leave a thought"}
        </button>
      </footer>
      )}

      {!readOnly && open && (
        <div className="paath-notes">
          {notes.map((n) => (
            <div key={n.id} className="paath-note">
              <p className="paath-note__who">
                {n.author} · {time(n.at)}
                {n.mine && (
                  <button type="button" className="paath-link" onClick={() => remove(n.id)} aria-label="Remove this thought">
                    <Trash2 size={12} aria-hidden />
                  </button>
                )}
              </p>
              <p className="paath-note__body">{n.body}</p>
            </div>
          ))}
          <textarea
            className="paath-notes__input"
            rows={2}
            value={draft}
            placeholder="A thought, a question, a line that stayed with you…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
            }}
          />
          <div className="paath-notes__actions">
            {error && <span className="paath-error">{error}</span>}
            <button type="button" className="btn" onClick={save} disabled={saving || !draft.trim()}>
              {saving ? "Saving…" : "Save thought"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

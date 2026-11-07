"use client";

import * as React from "react";
import { toast } from "sonner";
import type { StopNote } from "@/lib/catalogue-types";
import {
  addStopNoteAction,
  deleteStopNoteAction,
  listStopNotesAction,
  promoteStopNoteAction,
  setStopExcerptAction,
} from "@/lib/stop-note-actions";

const EXCERPT_MAX = 300;

function errText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

function day(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });
  } catch {
    return iso;
  }
}

/**
 * Editors' tools on an expanded stop in the tour popup: the short public
 * excerpt (edited in place), private notes "from the event" (optionally
 * tagged with the date of the run), the stop's past notes, and promoting a
 * note into the excerpt. Notes never reach the public: every call is an
 * editor-only action (lib/stop-note-actions.ts).
 */
export function StopAdmin({
  stopId,
  excerpt: initialExcerpt,
  onExcerpt,
}: {
  stopId: string;
  excerpt: string | null;
  /** The popup shows the new excerpt in the collapsed row straight away. */
  onExcerpt?: (excerpt: string | null) => void;
}) {
  const [excerpt, setExcerpt] = React.useState(initialExcerpt ?? "");
  const [savedExcerpt, setSavedExcerpt] = React.useState(initialExcerpt ?? "");
  const [notes, setNotes] = React.useState<StopNote[] | null>(null);
  const [note, setNote] = React.useState("");
  const [runDate, setRunDate] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  const loadNotes = React.useCallback(async () => {
    try {
      setNotes(await listStopNotesAction(stopId));
    } catch (e) {
      toast.error(errText(e, "Notes could not be loaded."));
      setNotes([]);
    }
  }, [stopId]);
  React.useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  async function saveExcerpt() {
    setBusy("excerpt");
    const text = excerpt.trim();
    const r = await setStopExcerptAction(stopId, text || null).catch((e: unknown) => ({ ok: false as const, error: errText(e, "Could not save.") }));
    setBusy(null);
    if (!r.ok) return void toast.error(r.error);
    setSavedExcerpt(r.excerpt ?? "");
    setExcerpt(r.excerpt ?? "");
    onExcerpt?.(r.excerpt);
    toast.success("Excerpt saved");
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    const body = note.trim();
    if (!body) return;
    setBusy("note");
    const r = await addStopNoteAction({ stopId, body, runDate: runDate || null }).catch((x: unknown) => ({ ok: false as const, error: errText(x, "Could not save the note.") }));
    setBusy(null);
    if (!r.ok) return void toast.error(r.error);
    setNote("");
    setRunDate("");
    setNotes((list) => [r.note, ...(list ?? [])]);
    toast.success("Note saved (private)");
  }

  async function promote(n: StopNote) {
    const text = window.prompt("The public excerpt (one or two lines, up to 300 characters):", n.body.slice(0, EXCERPT_MAX));
    if (text === null) return;
    setBusy(n.id);
    const r = await promoteStopNoteAction(n.id, text.trim() || undefined).catch((x: unknown) => ({ ok: false as const, error: errText(x, "Could not promote.") }));
    setBusy(null);
    if (!r.ok) return void toast.error(r.error);
    setExcerpt(r.excerpt);
    setSavedExcerpt(r.excerpt);
    onExcerpt?.(r.excerpt);
    void loadNotes();
    toast.success("Now the stop's public excerpt");
  }

  async function remove(n: StopNote) {
    if (!window.confirm("Delete this note?")) return;
    setBusy(n.id);
    const r = await deleteStopNoteAction(n.id).catch((x: unknown) => ({ ok: false as const, error: errText(x, "Could not delete.") }));
    setBusy(null);
    if (!r.ok) return void toast.error(r.error);
    setNotes((list) => (list ?? []).filter((x) => x.id !== n.id));
  }

  const field = "w-full rounded-md border border-[color:var(--sf-line)] bg-transparent p-2 text-sm";
  return (
    <div className="space-y-3 rounded-md border border-dashed border-[color:var(--sf-line)] p-3">
      <p className="text-[0.65rem] uppercase tracking-wider text-[color:var(--sf-muted)]">Editors only</p>

      <div className="space-y-1">
        <label className="text-xs font-medium" htmlFor={`excerpt-${stopId}`}>
          Short excerpt (shown when the stop is folded)
        </label>
        <textarea
          id={`excerpt-${stopId}`}
          value={excerpt}
          maxLength={EXCERPT_MAX}
          rows={2}
          onChange={(e) => setExcerpt(e.target.value)}
          className={field}
        />
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            disabled={busy === "excerpt" || excerpt.trim() === savedExcerpt.trim()}
            onClick={saveExcerpt}
            className="underline underline-offset-4 disabled:opacity-40"
          >
            {busy === "excerpt" ? "Saving…" : "Save excerpt"}
          </button>
          <span className="text-[color:var(--sf-muted)]">
            {excerpt.length}/{EXCERPT_MAX}
          </span>
        </div>
      </div>

      <form onSubmit={addNote} className="space-y-1">
        <label className="text-xs font-medium" htmlFor={`note-${stopId}`}>
          Add note (private, from the event)
        </label>
        <textarea id={`note-${stopId}`} value={note} rows={2} onChange={(e) => setNote(e.target.value)} className={field} placeholder="What happened here on the walk, what to say next time…" />
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            Tour date
            <input type="date" value={runDate} onChange={(e) => setRunDate(e.target.value)} className="rounded border border-[color:var(--sf-line)] bg-transparent px-1 py-0.5" />
          </label>
          <span className="text-[color:var(--sf-muted)]">optional</span>
          <button type="submit" disabled={busy === "note" || !note.trim()} className="ml-auto underline underline-offset-4 disabled:opacity-40">
            {busy === "note" ? "Saving…" : "Add note"}
          </button>
        </div>
      </form>

      <div>
        <p className="text-xs font-medium">Past notes</p>
        {notes === null ? (
          <p className="text-xs text-[color:var(--sf-muted)]">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="text-xs text-[color:var(--sf-muted)]">None yet.</p>
        ) : (
          <ul className="mt-1 space-y-2">
            {notes.map((n) => {
              const when = day(n.departureStartsAt) ?? day(n.runDate);
              return (
                <li key={n.id} className="text-sm">
                  <p className="text-[0.7rem] text-[color:var(--sf-muted)]">
                    {[n.author.name, when ? `from ${when}` : `written ${day(n.createdAt)}`, n.promotedAt ? "now the excerpt" : null].filter(Boolean).join(" · ")}
                  </p>
                  <p className="whitespace-pre-line">{n.body}</p>
                  <div className="mt-0.5 flex gap-3 text-xs">
                    <button type="button" disabled={busy === n.id} onClick={() => promote(n)} className="underline underline-offset-4 disabled:opacity-40">
                      Use as public excerpt
                    </button>
                    <button type="button" disabled={busy === n.id} onClick={() => remove(n)} className="text-[color:var(--sf-muted)] underline underline-offset-4 disabled:opacity-40">
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

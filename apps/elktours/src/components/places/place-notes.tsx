"use client";

import * as React from "react";
import { toast } from "sonner";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { Button } from "@elkdonis/primitives";
import { addPlaceNoteAction, deletePlaceNoteAction, listPlaceNotesAction, updatePlaceNoteAction, type PlaceNote } from "@/lib/place-note-actions";

const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * Guides' notes on a place (place_notes): each note shows its author and date; every owner and guide reads
 * them all; the author (or an owner) edits or deletes theirs. Never shown to visitors.
 */
export function PlaceNotes({ placeId }: { placeId: string }) {
  const [notes, setNotes] = React.useState<PlaceNote[] | null>(null);
  const [draft, setDraft] = React.useState("");
  const [editing, setEditing] = React.useState<string | null>(null);
  const [editBody, setEditBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [editorKey, setEditorKey] = React.useState(0);

  const load = React.useCallback(() => {
    listPlaceNotesAction(placeId)
      .then(setNotes)
      .catch(() => setNotes([]));
  }, [placeId]);
  React.useEffect(load, [load]);

  async function add() {
    setBusy(true);
    const r = await addPlaceNoteAction(placeId, draft).catch(() => ({ ok: false as const, error: "Could not save the note." }));
    setBusy(false);
    if (r.ok === false) return void toast.error(r.error);
    setDraft("");
    setEditorKey((k) => k + 1);
    setNotes((n) => [...(n ?? []), r.note]);
  }

  async function save(id: string) {
    setBusy(true);
    const r = await updatePlaceNoteAction(id, editBody).catch(() => ({ ok: false as const, error: "Could not save the note." }));
    setBusy(false);
    if (r.ok === false) return void toast.error(r.error);
    setEditing(null);
    setNotes((n) => (n ?? []).map((x) => (x.id === id ? r.note : x)));
  }

  async function remove(id: string) {
    if (!confirm("Delete this note?")) return;
    const r = await deletePlaceNoteAction(id).catch(() => ({ ok: false as const, error: "Could not delete it." }));
    if (r.ok === false) return void toast.error(r.error);
    setNotes((n) => (n ?? []).filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-3">
      {notes === null ? (
        <p className="text-sm text-muted-foreground">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No guide has left a note here yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="border border-border p-3 text-sm">
              <p className="mb-1 text-xs text-muted-foreground">
                {n.author.name ?? "A guide"} · {when(n.createdAt)}
                {n.updatedAt !== n.createdAt ? ` · edited ${when(n.updatedAt)}` : ""}
              </p>
              {editing === n.id ? (
                <div className="space-y-2">
                  <RichTextEditor value={editBody} onChange={setEditBody} toolbar="compact" />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" disabled={busy} onClick={() => save(n.id)}>Save</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: n.body }} />
                  {n.mine && (
                    <p className="mt-1 flex gap-3 text-xs">
                      <button type="button" className="underline underline-offset-4" onClick={() => { setEditing(n.id); setEditBody(n.body); }}>Edit</button>
                      <button type="button" className="text-destructive underline underline-offset-4" onClick={() => remove(n.id)}>Delete</button>
                    </p>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2">
        <RichTextEditor key={editorKey} value={draft} onChange={setDraft} toolbar="compact" />
        <Button type="button" size="sm" variant="outline" disabled={busy || !draft.replace(/<[^>]*>/g, "").trim()} onClick={add}>
          {busy ? "Saving…" : "Add my note"}
        </Button>
      </div>
    </div>
  );
}

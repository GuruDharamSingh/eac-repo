"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useTourEdit, useTourPage } from "./context";

/** Editors only: the bar that turns the page into its own editor, and saves it. */
export function TourEditBar() {
  const page = useTourPage();
  const e = useTourEdit();

  // Unsaved edits: ask before leaving.
  useEffect(() => {
    if (!e.editing || !e.dirty) return;
    const warn = (ev: BeforeUnloadEvent) => { ev.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [e.editing, e.dirty]);

  if (!page || !e.canEdit) return null;
  const id = page.tour.id;

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="flex flex-wrap items-center gap-3 border border-border bg-card/95 px-4 py-2 text-sm shadow-lg backdrop-blur">
        {!e.editing ? (
          <>
            <button type="button" onClick={e.start} className="bg-primary px-3 py-1.5 font-medium text-primary-foreground">Edit page</button>
            <Link href={`/manage/tours/${id}`} className="underline underline-offset-4">Stops & dates</Link>
            <Link href="/manage/schedule" className="underline underline-offset-4">Schedule</Link>
            <Link href={`/manage/tours/${id}/assets`} className="underline underline-offset-4">Assets</Link>
            <Link href={`/manage/tours/${id}/flyover`} className="underline underline-offset-4">Request fly-over</Link>
          </>
        ) : (
          <>
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">Editing</span>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={e.draft.status === "published"} onChange={(ev) => e.set("status", ev.target.checked ? "published" : "draft")} />
              Published
            </label>
            {e.error && <span className="text-[color:var(--destructive,#e8805c)]">{e.error}</span>}
            <button type="button" onClick={e.cancel} disabled={e.saving} className="px-3 py-1.5 underline underline-offset-4">Cancel</button>
            <button type="button" onClick={() => void e.save()} disabled={e.saving || !e.dirty} className="bg-primary px-3 py-1.5 font-medium text-primary-foreground disabled:opacity-50">
              {e.saving ? "Saving…" : "Save"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { officeHref } from "@/lib/office-links";
import { useTourEdit, useTourPage } from "./context";

/**
 * Editors only: one Edit button at the top right of the tour page (2026-11-21; it was a row of links along the
 * bottom). "Edit this page" turns the page into its own editor and the button into Published / Cancel / Save. The
 * other entries open the hub's Office popups on this tour (lib/office-links.ts): Create a tour on its Route step
 * (stops and places), on its Details step (pictures), and Offer a tour (dates). Fly-over has no hub card yet and
 * stays on its /manage page.
 */
export function TourEditBar() {
  const page = useTourPage();
  const e = useTourEdit();
  // The stage's own edit mode (components/tours/stage/edit) has a bar of its own: this menu steps aside meanwhile.
  const [stageEditing, setStageEditing] = useState(false);
  useEffect(() => {
    const on = (ev: Event) => setStageEditing(Boolean((ev as CustomEvent<boolean>).detail));
    window.addEventListener("elk:stage-editing", on);
    return () => window.removeEventListener("elk:stage-editing", on);
  }, []);

  // Unsaved edits: ask before leaving.
  useEffect(() => {
    if (!e.editing || !e.dirty) return;
    const warn = (ev: BeforeUnloadEvent) => { ev.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [e.editing, e.dirty]);

  if (!page || !e.canEdit || stageEditing) return null;
  const id = page.tour.id;

  return (
    <div className="fixed right-4 top-[4.75rem] z-30 flex justify-end">
      {!e.editing ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 border border-border bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-lg">
            Edit
            <ChevronDownIcon className="size-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem onSelect={e.start}>Edit this page</DropdownMenuItem>
            {page.stage ? <DropdownMenuItem onSelect={() => window.dispatchEvent(new Event("elk:stage-edit"))}>Edit on the stage</DropdownMenuItem> : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={officeHref("create-tour", { tourId: id, step: "route" })}>Stops &amp; route</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={officeHref("create-tour", { tourId: id, step: "details" })}>Pictures</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={officeHref("schedule", { tourId: id })}>Dates &amp; schedule</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/manage/tours/${id}/flyover`}>Request fly-over</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex flex-wrap items-center gap-3 border border-border bg-card/95 px-4 py-2 text-sm shadow-lg backdrop-blur">
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
        </div>
      )}
    </div>
  );
}

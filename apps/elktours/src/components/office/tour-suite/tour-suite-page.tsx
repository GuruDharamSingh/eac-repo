"use client";

import * as React from "react";
import Link from "next/link";
import { listEditableTourSheet } from "@/lib/office-actions";
import { TourSuite } from "./tour-suite";

/** The suite page: the suite for one tour, or a picker of editable tours. */
export function TourSuitePage({ tourId }: { tourId?: string }) {
  if (tourId) return <TourSuite tourId={tourId} />;
  return <TourPicker />;
}

function TourPicker() {
  const [rows, setRows] = React.useState<Array<{ id: string; title: string; published: boolean }> | null>(null);
  React.useEffect(() => {
    listEditableTourSheet()
      .then(setRows)
      .catch(() => setRows([]));
  }, []);
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 text-sm">
      <p className="mb-2">
        <Link href="/hub" className="text-muted-foreground underline underline-offset-4">← Hub</Link>
      </p>
      <h1 className="text-xl font-semibold">Edit a tour</h1>
      {!rows && <p className="mt-4 text-muted-foreground">Loading…</p>}
      {rows && rows.length === 0 && <p className="mt-4 text-muted-foreground">No tours to edit yet. Make one with Create a tour on the hub.</p>}
      {rows && rows.length > 0 && (
        <ul className="mt-4 divide-y divide-border rounded-md border border-border">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/hub/tours/suite?tour=${encodeURIComponent(r.id)}`} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-accent/60">
                <span className="font-medium">{r.title}</span>
                <span className="text-xs text-muted-foreground">{r.published ? "Published" : "Draft"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { saveHomeLoftAction } from "@/app/home-actions";
import { DEFAULT_CROP, type LoftSpot } from "@/lib/loft-crop";

/**
 * The two works hung in the home page's loft, in wall order; blank = the
 * newest pictured work. Frame proportion and crop are set on the home page
 * itself ("Edit the loft") and are kept when a work is changed here.
 */
export function LoftForm({
  works,
  initial,
}: {
  works: Array<{ id: string; label: string }>;
  initial: LoftSpot[];
}) {
  const router = useRouter();
  const [spots, setSpots] = React.useState<LoftSpot[]>(() => {
    const s = initial.slice(0, 2);
    while (s.length < 2) s.push({ id: "", ratio: "auto", crop: DEFAULT_CROP });
    return s;
  });
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const r = await saveHomeLoftAction(spots.filter((s) => s.id));
    setBusy(false);
    setNote(r.ok ? "Saved." : (r.error ?? "Could not save."));
    if (r.ok) router.refresh();
  };

  const select = (i: number, label: string) => (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={spots[i]!.id}
        onChange={(e) => setSpots((all) => all.map((s, k) => (k === i ? { ...s, id: e.target.value } : s)))}
        className="h-9 rounded-md border border-border bg-background px-2"
      >
        <option value="">Newest pictured work</option>
        {works.map((w) => (
          <option key={w.id} value={w.id}>
            {w.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <form onSubmit={save} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
      {select(0, "First on the wall")}
      {select(1, "Second on the wall")}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
        {note && <span className="text-sm text-muted-foreground">{note}</span>}
      </div>
    </form>
  );
}

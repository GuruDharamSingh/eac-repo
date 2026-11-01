"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveHeroAction } from "./hero-actions";

type ArtistOption = { id: string; name: string };

/** The landing hero's featured artists: up to six stores, in order. Empty = the artists with the newest work. */
export function HeroForm({ artists, initial, viaSeriesSlug, dark }: { artists: ArtistOption[]; initial: string[]; viaSeriesSlug?: string; dark?: boolean }) {
  const router = useRouter();
  const [chosen, setChosen] = React.useState<string[]>(initial);
  const [pick, setPick] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const byId = new Map(artists.map((a) => [a.id, a]));
  const dirty = chosen.join() !== initial.join();
  async function save() {
    setBusy(true);
    const r = await saveHeroAction(chosen, viaSeriesSlug);
    setBusy(false);
    if (!r.ok) return toast.error(r.error ?? "Could not save.");
    toast.success("Saved. The home page shows the change now.");
    router.refresh();
  }
  return (
    <div className={dark ? "sw-card" : "rounded-lg border border-border p-4"}>
      <ol className="mb-3 space-y-2 text-sm">
        {chosen.map((id, i) => (
          <li key={id} className="flex items-center justify-between gap-3">
            <span>{i + 1}. {byId.get(id)?.name ?? id}</span>
            <span className="flex gap-3">
              <button type="button" className="underline underline-offset-4" disabled={i === 0} onClick={() => { const c = [...chosen]; [c[i - 1], c[i]] = [c[i]!, c[i - 1]!]; setChosen(c); }}>Up</button>
              <button type="button" className="text-destructive underline underline-offset-4" onClick={() => setChosen(chosen.filter((x) => x !== id))}>Remove</button>
            </span>
          </li>
        ))}
        {chosen.length === 0 && <li className="text-muted-foreground">None chosen: the hero shows the artists with the newest work on the market.</li>}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <select className="rounded-md border border-input bg-transparent px-3 py-2 text-sm" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Artist to feature">
          <option value="">Add an artist…</option>
          {artists.filter((a) => !chosen.includes(a.id)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <Button type="button" size="sm" variant="outline" disabled={!pick || chosen.length >= 6} onClick={() => { setChosen([...chosen, pick]); setPick(""); }}>Add</Button>
        <Button type="button" size="sm" disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  );
}

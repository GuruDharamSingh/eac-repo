"use client";
// /manage/media-folders body (2026-11-20): "Make missing folders" and the reviewed Stops/ move.

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@elkdonis/primitives";
import { backfillFoldersAction, registerStopsAction } from "@/lib/media-folder-actions";
import type { BackfillResult, FolderCounts, RegisterResult, StopsPlan } from "@/lib/media-folders";
import { allowedChoices, moveItemKey, type MoveChoice } from "@/lib/media-folder-choices";

export function MediaFoldersPanel({ counts, plan }: { counts: FolderCounts; plan: StopsPlan & { error?: string } }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"folders" | "move" | null>(null);
  const [made, setMade] = React.useState<BackfillResult | null>(null);
  const [moved, setMoved] = React.useState<RegisterResult | null>(null);
  // Per-file choice; files not in the map keep the plan's default.
  const [choices, setChoices] = React.useState<Record<string, MoveChoice>>({});
  const choiceOf = (it: StopsPlan["items"][number]) => choices[moveItemKey(it)] ?? it.choice;
  const moving = plan.items.filter((it) => choiceOf(it) !== "leave").length;
  const label = (it: StopsPlan["items"][number], c: MoveChoice) =>
    c === "place"
      ? `Of the place ${it.placeTitle} (every stop there shows it)`
      : c === "stop"
        ? `Of the stop ${it.stopTitle}`
        : c === "overview"
          ? "Of the tour as a whole (overview)"
          : "Not yet (skip it)";

  async function makeFolders() {
    setBusy("folders");
    const res = await backfillFoldersAction().catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed" }));
    setBusy(null);
    if (!res.ok) return void toast.error(res.error);
    setMade(res.result);
    toast.success(`Made ${res.result.tours} tour and ${res.result.places} place folders.`);
    router.refresh();
  }

  async function move() {
    if (!confirm(`Register ${moving} pictures as chosen? No file is moved or copied; they are shown on the tours.`)) return;
    setBusy("move");
    const res = await registerStopsAction(plan.items.length, choices).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed" }));
    setBusy(null);
    if (!res.ok) return void toast.error(res.error);
    setMoved(res.result);
    toast.success(`Registered ${res.result.registered + res.result.updated} pictures.`);
    router.refresh();
  }

  const byFolder = new Map<string, StopsPlan["items"]>();
  for (const it of plan.items) (byFolder.get(it.folder) ?? byFolder.set(it.folder, []).get(it.folder)!).push(it);

  return (
    <div className="mt-6 space-y-8">
      <section className="rounded-md border border-border p-4">
        <h3 className="font-medium">Folders</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {counts.toursWithout} tours and {counts.placesWithout} places have no folder yet. New tours and places get one when
          they are created.
        </p>
        <Button className="mt-3" size="sm" onClick={makeFolders} disabled={busy !== null || counts.toursWithout + counts.placesWithout === 0}>
          {busy === "folders" ? "Making folders…" : "Make missing folders"}
        </Button>
        {made && made.failed.length > 0 && (
          <ul className="mt-2 text-sm text-destructive">
            {made.failed.map((f) => (
              <li key={f.id}>
                {f.kind} {f.title}: {f.error}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-md border border-border p-4">
        <h3 className="font-medium">What is each picture of?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          For each picture, say what it is of: a place, a stop or the tour as a whole. The site records that and shows the picture;
          the file stays exactly where it is in Stops/, nothing is moved, copied or deleted. Pictures here are never filed by
          name: the site shows only what is recorded. The suggestion comes from matching file names to stops; change any row
          that is wrong, or skip a file for now. Only a file in a <code>Private/</code> folder is ever copied, and only when you
          switch it on, because it has to leave Private to be shown (its location is removed).
        </p>
        {plan.error && <p className="mt-2 text-sm text-destructive">{plan.error}</p>}
        {plan.items.length === 0 && !plan.error && <p className="mt-2 text-sm">Every picture in Stops/ is recorded{plan.registered ? ` (${plan.registered})` : ""}.</p>}
        {[...byFolder].map(([folder, items]) => (
          <div key={folder} className="mt-4">
            <div className="text-sm font-medium">
              Stops/{folder} → {items[0]!.tourTitle}
            </div>
            <table className="mt-1 w-full text-sm">
              <tbody>
                {items.map((it) => (
                  <tr key={it.file} className="border-t border-border align-top">
                    <td className="py-1 pr-3 break-all">{it.file}</td>
                    <td className="py-1 pr-3">
                      <select
                        className="w-full rounded border border-border bg-background px-2 py-1"
                        value={choiceOf(it)}
                        onChange={(e) => setChoices((m) => ({ ...m, [moveItemKey(it)]: e.target.value as MoveChoice }))}
                        aria-label={`What ${it.file} is of`}
                      >
                        {allowedChoices(it).map((c) => (
                          <option key={c} value={c}>
                            {label(it, c)}
                            {c === it.choice ? " (suggested)" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 text-muted-foreground">{it.credit ?? "no credit found"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {plan.unclaimed.length > 0 && (
          <p className="mt-4 text-sm text-muted-foreground">Not matched to a tour, left where they are: {plan.unclaimed.join(", ")}.</p>
        )}
        {plan.items.length > 0 && (
          <Button className="mt-4" size="sm" onClick={move} disabled={busy !== null || moving === 0}>
            {busy === "move" ? "Recording…" : `Record ${moving} pictures`}
          </Button>
        )}
        {moved && (
          <p className="mt-2 text-sm">
            Recorded {moved.registered} new, updated {moved.updated}, already recorded {moved.already}. No file was moved.
            {moved.failed.length > 0 && <span className="text-destructive"> Failed: {moved.failed.map((f) => `${f.file} (${f.error})`).join("; ")}</span>}
          </p>
        )}
      </section>
    </div>
  );
}

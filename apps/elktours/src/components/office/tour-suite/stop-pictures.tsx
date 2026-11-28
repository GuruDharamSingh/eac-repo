"use client";

import * as React from "react";
import { toast } from "sonner";
import type { TourAsset } from "@/lib/catalogue-types";
import { archiveAssetAction, copyPlaceAssetToStopAction, listAssetsAction, upsertAssetAction } from "@/lib/asset-actions";
import { MediaField } from "@/components/manage/media-field";

const label = "text-xs font-medium uppercase tracking-wider text-muted-foreground";

export const isPicture = (a: TourAsset) => (a.kind === "image" || a.kind === "still") && !!a.url && !a.archivedAt;

/**
 * A saved stop's pictures in the order the stage shows them (the same actions as the wizard's Details step, for one
 * stop): move, hide, remove, caption, add, or copy from the place's own pictures. `assets` is the tour's list, held by
 * the suite (it also marks stops without a picture); `reload` re-reads it and refreshes the preview.
 */
export function StopPictures({
  tourId,
  stopId,
  placeId,
  assets,
  reload,
}: {
  tourId: string;
  stopId: string;
  placeId: string | null | undefined;
  assets: TourAsset[];
  reload: () => Promise<void> | void;
}) {
  const [placeAssets, setPlaceAssets] = React.useState<TourAsset[] | null>(null);
  const [showPlace, setShowPlace] = React.useState(false);
  const list = assets.filter((a) => a.stopId === stopId && isPicture(a)).sort((a, b) => a.position - b.position);

  React.useEffect(() => {
    setPlaceAssets(null);
    setShowPlace(false);
  }, [placeId]);

  async function openPlacePictures() {
    setShowPlace((v) => !v);
    if (placeAssets || !placeId) return;
    const l = await listAssetsAction({ placeId }).catch(() => [] as TourAsset[]);
    setPlaceAssets(l.filter(isPicture));
  }

  async function save(a: TourAsset, patch: Partial<TourAsset>) {
    const r = await upsertAssetAction({
      id: a.id,
      threadId: a.threadId,
      stopId: a.stopId,
      kind: a.kind,
      url: a.url,
      caption: patch.caption !== undefined ? patch.caption : a.caption,
      altText: a.altText,
      position: patch.position !== undefined ? patch.position : a.position,
      visible: patch.visible !== undefined ? patch.visible : a.visible,
      source: a.source,
      attribution: a.attribution,
    }).catch(() => ({ ok: false as const, error: "Could not save the picture." }));
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    return true;
  }

  async function swap(i: number, j: number) {
    const a = list[i];
    const b = list[j];
    if (!a || !b) return;
    const pa = Math.min(a.position, b.position);
    const pb = pa === Math.max(a.position, b.position) ? pa + 1 : Math.max(a.position, b.position);
    if ((await save(a, { position: pb })) && (await save(b, { position: pa }))) await reload();
  }

  async function add(url: string) {
    if (!url) return;
    const top = Math.max(-1, ...list.map((a) => a.position));
    const r = await upsertAssetAction({ threadId: tourId, stopId, kind: "image", role: "gallery", url, source: "upload", visible: true, position: top + 1 }).catch(
      () => ({ ok: false as const, error: "Could not add the picture." })
    );
    if (!r.ok) return void toast.error(r.error);
    await reload();
  }

  async function copy(pa: TourAsset) {
    const r = await copyPlaceAssetToStopAction(pa.id, stopId).catch(() => ({ ok: false as const, error: "Could not copy the picture." }));
    if (!r.ok) return void toast.error(r.error);
    toast.success("Picture added to the stop");
    await reload();
  }

  async function remove(a: TourAsset) {
    if (!confirm("Remove this picture from the stop?")) return;
    const r = await archiveAssetAction(a.id).catch(() => ({ ok: false as const, error: "Could not remove it." }));
    if (!r.ok) return void toast.error(r.error);
    await reload();
  }

  return (
    <div className="space-y-3 text-sm">
      {list.length === 0 && <p className="text-muted-foreground">No pictures on this stop yet.</p>}
      <ul className="space-y-2">
        {list.map((a, i) => (
          <li key={a.id} className={`flex gap-3 ${a.visible ? "" : "opacity-60"}`}>
            <img src={a.url!} alt={a.altText ?? ""} className="h-16 w-24 shrink-0 object-cover" />
            <div className="min-w-0 flex-1 space-y-1">
              <input
                defaultValue={a.caption ?? ""}
                placeholder="Caption"
                aria-label="Caption"
                onBlur={(e) => {
                  const v = e.target.value.trim() || null;
                  if (v !== (a.caption ?? null)) void save(a, { caption: v }).then((ok) => ok && reload());
                }}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5"
              />
              <div className="flex flex-wrap items-center gap-1 text-xs">
                <span className="mr-1 text-muted-foreground">{a.visible ? (a.source === "upload" ? "Tour copy" : a.source) : "Hidden"}</span>
                <button type="button" disabled={i === 0} onClick={() => swap(i, i - 1)} className="rounded border border-border px-2 py-0.5 disabled:opacity-30">↑ Earlier</button>
                <button type="button" disabled={i === list.length - 1} onClick={() => swap(i, i + 1)} className="rounded border border-border px-2 py-0.5 disabled:opacity-30">↓ Later</button>
                <button type="button" onClick={() => void save(a, { visible: !a.visible }).then((ok) => ok && reload())} className="rounded border border-border px-2 py-0.5">{a.visible ? "Hide" : "Show"}</button>
                <button type="button" onClick={() => remove(a)} className="rounded border border-border px-2 py-0.5 text-destructive">Remove</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 sm:grid-cols-2">
        <MediaField value="" onChange={(url) => void add(url)} label="+ Add pictures" destination={{ kind: "tour", tourId, slot: "stop", stopId }} />
        {placeId && (
          <div>
            <span className={label}>From the place's pictures</span>
            <button type="button" onClick={openPlacePictures} className="mt-1 block rounded-md border border-border px-3 py-1.5 hover:bg-accent">
              {showPlace ? "Hide them" : "Show them"}
            </button>
            {showPlace && (
              <ul className="mt-2 grid grid-cols-3 gap-2">
                {!placeAssets && <li className="col-span-3 text-muted-foreground">Loading…</li>}
                {placeAssets && placeAssets.length === 0 && <li className="col-span-3 text-muted-foreground">The place has no pictures.</li>}
                {(placeAssets ?? []).map((pa) => (
                  <li key={pa.id}>
                    <button type="button" onClick={() => copy(pa)} className="block w-full" title="Use on this stop">
                      <img src={pa.url!} alt={pa.altText ?? ""} className="h-16 w-full object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <p>
        <a href={`/manage/tours/${tourId}/assets`} className="text-xs underline underline-offset-4">Open the library</a>
      </p>
    </div>
  );
}

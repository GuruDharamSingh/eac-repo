"use client";

import * as React from "react";
import { toast } from "sonner";
import type { TourStop } from "@elkdonis/commerce/server";
import type { TourAsset } from "@/lib/catalogue-types";
import { archiveAssetAction, copyPlaceAssetToStopAction, listAssetsAction, upsertAssetAction } from "@/lib/asset-actions";
import { MediaField } from "@/components/manage/media-field";

const label = "text-xs font-medium uppercase tracking-wider text-muted-foreground";

const isPicture = (a: TourAsset) => (a.kind === "image" || a.kind === "still") && !!a.url && !a.archivedAt;

/**
 * Step 3, Details: the tour page's pictures, stop by stop. Each stop lists its pictures in the order the page
 * shows them, with a caption each; pictures can be moved, hidden, removed, added, or copied from the place's own
 * pictures to tell the stop's story. Saves as it goes (tour assets, lib/asset-actions).
 */
export function DetailsStep({
  tourId,
  slug,
  stops,
  narratives,
  onEditRoute,
}: {
  tourId: string;
  slug: string;
  stops: TourStop[];
  /** Each stop's saved line on the tour page, by stop id (read-only here). */
  narratives: Record<string, string>;
  onEditRoute: () => void;
}) {
  const [assets, setAssets] = React.useState<TourAsset[] | null>(null);
  const [placeAssets, setPlaceAssets] = React.useState<Record<string, TourAsset[]>>({});
  const [openPlace, setOpenPlace] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const list = await listAssetsAction({ threadId: tourId, includeStops: true }).catch(() => [] as TourAsset[]);
    setAssets(list);
  }, [tourId]);
  React.useEffect(() => {
    void load();
  }, [load]);

  async function showPlacePictures(placeId: string) {
    setOpenPlace((v) => (v === placeId ? null : placeId));
    if (placeAssets[placeId]) return;
    const list = await listAssetsAction({ placeId }).catch(() => [] as TourAsset[]);
    setPlaceAssets((m) => ({ ...m, [placeId]: list.filter(isPicture) }));
  }

  const forStop = (stopId: string) => (assets ?? []).filter((a) => a.stopId === stopId && isPicture(a)).sort((a, b) => a.position - b.position);

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

  async function swap(list: TourAsset[], i: number, j: number) {
    const a = list[i];
    const b = list[j];
    if (!a || !b) return;
    // Positions may repeat on older rows: give the pair distinct ones.
    const pa = Math.min(a.position, b.position);
    const pb = pa === Math.max(a.position, b.position) ? pa + 1 : Math.max(a.position, b.position);
    if ((await save(a, { position: pb })) && (await save(b, { position: pa }))) await load();
  }

  async function add(stop: TourStop, url: string) {
    if (!url) return;
    const top = Math.max(-1, ...forStop(stop.id).map((a) => a.position));
    const r = await upsertAssetAction({ threadId: tourId, stopId: stop.id, kind: "image", role: "gallery", url, source: "upload", visible: true, position: top + 1 }).catch(
      () => ({ ok: false as const, error: "Could not add the picture." })
    );
    if (!r.ok) return void toast.error(r.error);
    await load();
  }

  async function copy(placeAsset: TourAsset, stop: TourStop) {
    const r = await copyPlaceAssetToStopAction(placeAsset.id, stop.id).catch(() => ({ ok: false as const, error: "Could not copy the picture." }));
    if (!r.ok) return void toast.error(r.error);
    toast.success("Picture added to the stop");
    await load();
  }

  async function remove(a: TourAsset) {
    if (!confirm("Remove this picture from the stop?")) return;
    const r = await archiveAssetAction(a.id).catch(() => ({ ok: false as const, error: "Could not remove it." }));
    if (!r.ok) return void toast.error(r.error);
    await load();
  }

  if (!assets) return <p className="text-sm text-muted-foreground">Loading the pictures…</p>;

  return (
    <div className="space-y-5 text-sm">
      <p className="text-muted-foreground">
        The tour page shows each stop with these pictures, in this order. Captions save when you leave the field.{" "}
        <a href={`/tours/${slug}`} target="_blank" rel="noopener" className="underline underline-offset-4">
          Open the tour page
        </a>{" "}
        ·{" "}
        <a href={`/manage/tours/${tourId}/assets`} className="underline underline-offset-4">
          All tour media
        </a>
      </p>
      {stops.length === 0 && <p className="text-muted-foreground">Add stops on the Route step first.</p>}
      {stops.map((stop, n) => {
        const list = forStop(stop.id);
        return (
          <section key={stop.id} className="rounded-md border border-border">
            <h4 className="flex items-baseline gap-2 border-b border-border px-3 py-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{n + 1}</span>
              <span className="font-medium">{stop.title}</span>
            </h4>
            <div className="space-y-3 p-3">
              <div className="flex items-start justify-between gap-3">
                {narratives[stop.id] ? (
                  <p className="min-w-0 whitespace-pre-line">{narratives[stop.id]}</p>
                ) : (
                  <p className="min-w-0 text-muted-foreground">No line written for this stop; the page shows the start of its text.</p>
                )}
                <button type="button" onClick={onEditRoute} className="shrink-0 text-xs underline underline-offset-4">
                  Edit on Route
                </button>
              </div>
              {list.length === 0 && <p className="text-muted-foreground">No pictures on this stop yet.</p>}
              <ul className="space-y-2">
                {list.map((a, i) => (
                  <li key={a.id} className={`flex gap-3 ${a.visible ? "" : "opacity-60"}`}>
                    <img src={a.url!} alt={a.altText ?? ""} className="h-16 w-24 shrink-0 object-cover" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <input
                        defaultValue={a.caption ?? ""}
                        placeholder="Caption"
                        onBlur={(e) => {
                          const v = e.target.value.trim() || null;
                          if (v !== (a.caption ?? null)) void save(a, { caption: v }).then((ok) => ok && load());
                        }}
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5"
                        aria-label="Caption"
                      />
                      <div className="flex flex-wrap gap-1 text-xs">
                        <button type="button" disabled={i === 0} onClick={() => swap(list, i, i - 1)} className="rounded border border-border px-2 py-0.5 disabled:opacity-30">
                          ↑ Earlier
                        </button>
                        <button type="button" disabled={i === list.length - 1} onClick={() => swap(list, i, i + 1)} className="rounded border border-border px-2 py-0.5 disabled:opacity-30">
                          ↓ Later
                        </button>
                        <button type="button" onClick={() => void save(a, { visible: !a.visible }).then((ok) => ok && load())} className="rounded border border-border px-2 py-0.5">
                          {a.visible ? "Hide" : "Show"}
                        </button>
                        <button type="button" onClick={() => remove(a)} className="rounded border border-border px-2 py-0.5 text-destructive">
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="grid gap-3 sm:grid-cols-2">
                <MediaField value="" onChange={(url) => void add(stop, url)} label="Add a picture" />
                {stop.placeId && (
                  <div>
                    <span className={label}>From the place's pictures</span>
                    <button type="button" onClick={() => showPlacePictures(stop.placeId!)} className="mt-1 block rounded-md border border-border px-3 py-1.5 hover:bg-accent">
                      {openPlace === stop.placeId ? "Hide them" : "Show them"}
                    </button>
                    {openPlace === stop.placeId && (
                      <ul className="mt-2 grid grid-cols-3 gap-2">
                        {(placeAssets[stop.placeId] ?? []).length === 0 && <li className="col-span-3 text-muted-foreground">The place has no pictures.</li>}
                        {(placeAssets[stop.placeId] ?? []).map((pa) => (
                          <li key={pa.id}>
                            <button type="button" onClick={() => copy(pa, stop)} className="block w-full" title="Use on this stop">
                              <img src={pa.url!} alt={pa.altText ?? ""} className="h-16 w-full object-cover" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { TourAsset } from "@/lib/catalogue-types";
import { listAssetsAction, setAssetVisibleAction, upsertAssetAction } from "@/lib/asset-actions";
import { MediaField } from "@/components/manage/media-field";
import { Layer } from "./layer";
import { useStageEdit } from "./stage-edit-store";

const isPicture = (a: TourAsset) => (a.kind === "image" || a.kind === "still") && !!a.url && !a.archivedAt;

/** The assets of a stop (or of a place), loaded and kept in order. */
function useAssets(scope: { stopId: string } | { placeId: string }, tourId: string) {
  const [list, setList] = useState<TourAsset[] | null>(null);
  const key = "stopId" in scope ? `s:${scope.stopId}` : `p:${scope.placeId}`;
  const load = useCallback(async () => {
    const rows =
      "stopId" in scope
        ? await listAssetsAction({ stopId: scope.stopId }).catch(() => [] as TourAsset[])
        : await listAssetsAction({ placeId: scope.placeId }).catch(() => [] as TourAsset[]);
    setList(rows.filter(isPicture).sort((a, b) => a.position - b.position));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tourId]);
  useEffect(() => {
    void load();
  }, [load]);
  return { list, load };
}

async function saveAsset(a: TourAsset, patch: { position?: number }) {
  const r = await upsertAssetAction({
    id: a.id, threadId: a.threadId, stopId: a.stopId, placeId: a.placeId, kind: a.kind, url: a.url, caption: a.caption, altText: a.altText,
    position: patch.position ?? a.position, visible: a.visible, source: a.source, attribution: a.attribution,
  }).catch(() => ({ ok: false as const, error: "Could not save the picture." }));
  if (!r.ok) toast.error(r.error);
  return r.ok;
}

/** Drag a thumbnail onto another to move it there; positions are rewritten in the new order. */
async function reorder(list: TourAsset[], from: number, to: number) {
  if (from === to) return false;
  const next = [...list];
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m!);
  for (const [i, a] of next.entries()) {
    if (a.position !== i && !(await saveAsset(a, { position: i }))) return false;
  }
  return true;
}

function Thumbs({ list, onChange, canHide }: { list: TourAsset[]; onChange: () => void; canHide: boolean }) {
  const [drag, setDrag] = useState<number | null>(null);
  return (
    <ul className="tse-thumbs">
      {list.map((a, i) => (
        <li
          key={a.id}
          className={`tse-thumb${a.visible ? "" : " is-hidden"}`}
          draggable
          onDragStart={() => setDrag(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={async () => {
            if (drag != null && (await reorder(list, drag, i))) onChange();
            setDrag(null);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.url!} alt={a.altText ?? ""} draggable={false} />
          {canHide && (
            <button
              type="button"
              className="tse-thumb__hide"
              onClick={async () => {
                const r = await setAssetVisibleAction(a.id, !a.visible).catch(() => ({ ok: false as const, error: "Could not change it." }));
                if (!r.ok) return void toast.error(r.error);
                onChange();
              }}
            >
              {a.visible ? "Hide this one" : "Show"}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The strip over the stop's picture: "Pictures · 2 of 4 · drag to reorder", + Add pictures, Hide this one. */
export function StopPicturesEdit({ stopId }: { stopId: string }) {
  const edit = useStageEdit();
  const api = edit?.api ?? null;
  const { list, load } = useAssets({ stopId }, api?.tourId ?? "");
  const [adding, setAdding] = useState(false);
  if (!api || !api.ready) return null;
  const shown = (list ?? []).filter((a) => a.visible).length;
  const changed = () => {
    void load();
    api.refresh();
  };
  async function add(url: string) {
    if (!url) return;
    const top = Math.max(-1, ...(list ?? []).map((a) => a.position));
    const r = await upsertAssetAction({ threadId: api!.tourId, stopId, kind: "image", role: "gallery", url, source: "upload", visible: true, position: top + 1 }).catch(() => ({ ok: false as const, error: "Could not add the picture." }));
    if (!r.ok) return void toast.error(r.error);
    setAdding(false);
    changed();
  }
  return (
    <div className="tse-region tse-pics" data-tse="pictures">
      <div className="tse-pics__head">
        <span className="tse-label">
          Pictures · {shown} of {list?.length ?? 0} · drag to reorder
        </span>
        <button type="button" className="tse-btn tse-btn--small" onClick={() => setAdding(true)}>
          + Add pictures
        </button>
      </div>
      {list && list.length > 0 ? <Thumbs list={list} onChange={changed} canHide /> : <p className="tse-note">{list ? "This stop has no pictures of its own yet." : "Loading…"}</p>}
      {adding && (
        <Layer title="Add pictures to this stop" onClose={() => setAdding(false)}>
          <MediaField value="" onChange={(u) => void add(u)} label="Pictures" destination={{ kind: "tour", tourId: api.tourId, slot: "stop", stopId }} />
        </Layer>
      )}
    </div>
  );
}

/** In the place panel: "Drop pictures here to add them to the place", with Upload and From the library. */
export function PlacePicturesEdit({ placeId, placeTitle }: { placeId: string; placeTitle: string }) {
  const edit = useStageEdit();
  const api = edit?.api ?? null;
  const { list, load } = useAssets({ placeId }, api?.tourId ?? "");
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lib, setLib] = useState(false);
  if (!api) return null;

  async function add(url: string) {
    if (!url) return false;
    const top = Math.max(-1, ...(list ?? []).map((a) => a.position));
    const r = await upsertAssetAction({ placeId, kind: "image", url, source: "upload", visible: true, position: top + 1 }).catch(() => ({ ok: false as const, error: "Could not add the picture." }));
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    return true;
  }
  async function dropped(files: File[]) {
    setBusy(true);
    let n = 0;
    for (const file of files.filter((f) => f.type.startsWith("image/"))) {
      const body = new FormData();
      body.set("file", file);
      body.set("destination", JSON.stringify({ kind: "place", placeId }));
      const res = await fetch("/api/media/upload-to", { method: "POST", body }).catch(() => null);
      const data = (await res?.json().catch(() => ({}))) as { url?: string; error?: string } | undefined;
      if (!res?.ok || !data?.url) {
        toast.error(data?.error ?? "Could not upload that file.");
        continue;
      }
      if (await add(data.url)) n++;
    }
    setBusy(false);
    if (n) {
      toast.success(`${n} picture${n === 1 ? "" : "s"} added to ${placeTitle}`);
      await load();
      api!.refresh();
    }
  }

  return (
    <div className="tse-region tse-place" data-tse="place-pictures">
      <span className="tse-label">
        The place · {placeTitle} ·{" "}
        <a href={`/manage/places/${placeId}`}>Edit the place</a>
      </span>
      {list && list.length > 0 && <Thumbs list={list} onChange={() => { void load(); api.refresh(); }} canHide={false} />}
      <div
        className={`tse-drop${over ? " is-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void dropped(Array.from(e.dataTransfer.files)); }}
      >
        <strong>{busy ? "Uploading…" : "Drop pictures here to add them to the place"}</strong>
        <small>They are filed in Places/ for this place and shown on every tour that stops here</small>
        <button type="button" className="tse-btn tse-btn--small" onClick={() => setLib(true)}>
          Upload · From the library
        </button>
      </div>
      {lib && (
        <Layer title={`Add pictures to ${placeTitle}`} onClose={() => setLib(false)}>
          <MediaField
            value=""
            onChange={async (u) => {
              if (await add(u)) {
                setLib(false);
                await load();
                api.refresh();
              }
            }}
            label="Pictures"
            destination={{ kind: "place", placeId }}
          />
        </Layer>
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import type { SurfaceDescriptor } from "../types";
import { useLayer, useSurface } from "../context";
import { SurfaceFrame, SurfaceSkeleton } from "../SurfaceShell";
import { SimpleLightbox } from "../../gallery/SimpleLightbox";

// ============================================================================
// The org's images, expanded.
//
// What the media picker shows as a "Library" tab, as a place of its own: a
// grid of everything in the org's storage, a lightbox to look at one, and —
// for someone who can compose — an upload tile. Nothing here is a URL box;
// an image is always something in the org's own storage (settled rule,
// 2026-09-07).
//
// The lightbox is the gallery package's SimpleLightbox and is styled by
// gallery.css, which the host imports alongside surface.css.
// ============================================================================

type Descriptor = Extract<SurfaceDescriptor, { type: "gallery" }>;

interface Item {
  url: string;
  name: string;
}

export function GallerySurface({ descriptor }: { descriptor: Descriptor }) {
  const { connectors } = useSurface();
  const layer = useLayer();

  const [items, setItems] = React.useState<Item[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [lightbox, setLightbox] = React.useState<number | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const title = descriptor.title ?? "Gallery";

  React.useEffect(() => {
    layer.setMeta({ title, kind: "gallery", size: "wide" });
  }, [layer, title]);

  const load = React.useCallback(async () => {
    if (!connectors.listMedia) {
      setItems([]);
      return;
    }
    try {
      setItems(await connectors.listMedia());
    } catch {
      setError("Could not load the library.");
      setItems([]);
    }
  }, [connectors]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const canUpload = connectors.viewer.canCompose && Boolean(connectors.uploadEndpoint);

  async function upload(files: FileList | File[]) {
    if (!connectors.uploadEndpoint) return;
    setUploading(true);
    setError(null);
    const added: Item[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const body = new FormData();
      body.append("file", file);
      for (const [k, v] of Object.entries(connectors.uploadFields ?? {})) body.append(k, v);
      try {
        const res = await fetch(connectors.uploadEndpoint, { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) {
          setError(data.error ?? `Could not upload ${file.name}`);
          continue;
        }
        added.push({ url: data.url, name: file.name });
      } catch {
        setError(`Could not upload ${file.name}`);
      }
    }
    if (added.length) {
      setItems((prev) => [...added, ...(prev ?? [])]);
      connectors.onMutated?.();
    }
    setUploading(false);
  }

  const count = items?.length ?? 0;

  return (
    <SurfaceFrame
      kind="gallery"
      title={title}
      kicker="Images in the org's storage"
      status={
        error ??
        (uploading ? "Uploading…" : items === null ? "Loading…" : `${count} ${count === 1 ? "image" : "images"}`)
      }
      statusTone={error ? "error" : "normal"}
      actions={
        canUpload
          ? [
              {
                label: uploading ? "Uploading…" : "Upload",
                primary: true,
                disabled: uploading,
                onClick: () => inputRef.current?.click(),
              },
            ]
          : undefined
      }
    >
      {items === null ? (
        <SurfaceSkeleton block />
      ) : (
        <div
          className="eac-gal-grid"
          onDragOver={(e) => {
            if (!canUpload) return;
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            if (!canUpload) return;
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
          }}
        >
          {canUpload && (
            <label className={`eac-gal-upload${dragging ? " is-dragging" : ""}`}>
              <b aria-hidden>+</b>
              <span>{dragging ? "Drop to upload" : "Add images"}</span>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  if (e.target.files?.length) void upload(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}

          {items.length === 0 && !canUpload && (
            <p className="eac-surface-empty" style={{ gridColumn: "1 / -1" }}>
              Nothing here yet.
            </p>
          )}

          {items.map((item, i) => (
            <button
              key={item.url}
              type="button"
              className="eac-gal-tile"
              onClick={() => setLightbox(i)}
              aria-label={`View ${item.name}`}
            >
              <img src={item.url} alt={item.name} loading="lazy" />
              <span className="eac-gal-name">{item.name}</span>
            </button>
          ))}
        </div>
      )}

      <SimpleLightbox
        images={(items ?? []).map((i) => ({ url: i.url, alt: i.name }))}
        index={lightbox}
        onClose={() => setLightbox(null)}
        onIndexChange={setLightbox}
      />
    </SurfaceFrame>
  );
}

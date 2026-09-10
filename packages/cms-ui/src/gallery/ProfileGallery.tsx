"use client";

import { useCallback, useRef, useState } from "react";
import { GridLayout, useContainerWidth, type Layout, type LayoutItem } from "react-grid-layout";
import { SimpleLightbox } from "./SimpleLightbox";

export interface GalleryItem {
  /** Stable id (react-grid-layout's `i`). Required here — the caller
   *  generates one (e.g. nanoid) for any item that doesn't already have one,
   *  such as right after upload. */
  id: string;
  url: string;
  title: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface ProfileGalleryProps {
  items: GalleryItem[];
  /** Owner/admin viewing their own page — shows drag/resize/upload/remove controls. */
  editable: boolean;
  /** Fires on every change (reorder, resize, add, remove, title edit) — the
   *  caller owns persistence (e.g. debounce and call updateProfile). */
  onChange?: (items: GalleryItem[]) => void;
  /** Upload endpoint — see e.g. apps/ifac's /api/upload, which accepts a
   *  `file` field and returns `{ url, filename }`. */
  uploadEndpoint?: string;
  /** Extra form fields sent with every upload (e.g. `{ memberSlug: slug }`). */
  uploadExtraFields?: Record<string, string>;
  className?: string;
}

const COLS = 12;
const ROW_HEIGHT = 40;
const DEFAULT_W = 4; // 3 tiles per row at 12 cols
const DEFAULT_H = 4;

/** Fills in x/y/w/h for any item that's never been through the editor (e.g. rows created before this existed, or a plain URL import). */
function placeMissing(items: GalleryItem[]): GalleryItem[] {
  let cursor = 0;
  return items.map((item) => {
    if (item.x !== undefined && item.y !== undefined && item.w !== undefined && item.h !== undefined) {
      return item;
    }
    const col = cursor % 3;
    const row = Math.floor(cursor / 3);
    cursor += 1;
    return { ...item, x: col * DEFAULT_W, y: row * DEFAULT_H, w: DEFAULT_W, h: DEFAULT_H };
  });
}

function toLayout(items: GalleryItem[]): Layout {
  return items.map((item): LayoutItem => ({
    i: item.id,
    x: item.x!,
    y: item.y!,
    w: item.w!,
    h: item.h!,
    minW: 2,
    minH: 2,
  }));
}

/**
 * Drag-to-reorder, drag-to-resize image gallery grid, built on
 * react-grid-layout (the standard for this — see the package's own docs;
 * nothing bespoke was invented here). Read-only mode renders the same grid
 * with dragging/resizing turned off, so the saved layout looks identical
 * whether or not the viewer can edit it.
 *
 * Click any image (in either mode) to open it in SimpleLightbox with
 * prev/next between the gallery's images.
 */
export function ProfileGallery({
  items: itemsProp,
  editable,
  onChange,
  uploadEndpoint,
  uploadExtraFields,
  className,
}: ProfileGalleryProps) {
  const [items, setItems] = useState<GalleryItem[]>(() => placeMissing(itemsProp));
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  // Where the pointer went down on a tile, so a click can be told apart from
  // a drag WITHOUT relying on react-grid-layout's onDrag firing (which it does
  // on a pixel of jitter, so a flag set from it swallows ordinary clicks too).
  const pressAt = useRef<{ x: number; y: number } | null>(null);

  const { width, containerRef, mounted } = useContainerWidth();

  const commit = useCallback(
    (next: GalleryItem[]) => {
      setItems(next);
      onChange?.(next);
    },
    [onChange]
  );

  function handleLayoutChange(layout: Layout) {
    if (!editable) return;
    const byId = new Map(layout.map((l) => [l.i, l]));
    commit(items.map((item) => {
      const l = byId.get(item.id);
      return l ? { ...item, x: l.x, y: l.y, w: l.w, h: l.h } : item;
    }));
  }

  function removeItem(id: string) {
    commit(items.filter((i) => i.id !== id));
  }

  function renameItem(id: string, title: string) {
    commit(items.map((i) => (i.id === id ? { ...i, title } : i)));
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || !files.length || !uploadEndpoint) return;
    setUploading(true);
    const added: GalleryItem[] = [];
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      for (const [k, v] of Object.entries(uploadExtraFields ?? {})) formData.append(k, v);
      try {
        const res = await fetch(uploadEndpoint, { method: "POST", body: formData });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.url) {
          added.push({ id: data.id ?? `${Date.now()}-${added.length}`, url: data.url, title: (data.filename ?? file.name).replace(/\.[^.]+$/, "") });
        }
      } catch {
        // best-effort — a failed upload just doesn't get added
      }
    }
    setUploading(false);
    if (added.length) commit(placeMissing([...items, ...added]));
  }

  const layout = toLayout(items);
  const lightboxImages = items.map((i) => ({ url: i.url, alt: i.title }));

  return (
    <div ref={containerRef} className={className}>
      {mounted && (
        <GridLayout
          width={width}
          layout={layout}
          gridConfig={{ cols: COLS, rowHeight: ROW_HEIGHT, margin: [8, 8], containerPadding: [0, 0], maxRows: Infinity }}
          dragConfig={{ enabled: editable, bounded: false, threshold: 4 }}
          resizeConfig={{ enabled: editable, handles: ["se"] }}
          onLayoutChange={handleLayoutChange}
          onDragStart={() => { pressAt.current = null; }}
        >
          {items.map((item, index) => (
            // Handlers sit on the TILE, not the <img>: in edit mode
            // react-grid-layout owns pointer events on the item, and hanging
            // the click off the image alone made it dependent on the event
            // reaching that specific element. The remove button and the title
            // caption stopPropagation, so they still do their own thing.
            <div
              key={item.id}
              onPointerDown={(e) => {
                pressAt.current = { x: e.clientX, y: e.clientY };
              }}
              onClick={(e) => {
                const from = pressAt.current;
                pressAt.current = null;
                // A real drag moves the pointer; a click does not. Measuring
                // that here means the lightbox opens whenever the person
                // actually clicked — in edit mode as well as read-only — and
                // never on the click react-grid-layout synthesises at
                // drag-end. onDragStart clears the anchor, so a drag starting
                // on this tile can never be mistaken for a click.
                if (!from) return;
                if (Math.hypot(e.clientX - from.x, e.clientY - from.y) > 5) return;
                setLightboxIndex(index);
              }}
              style={{ position: "relative", overflow: "hidden", borderRadius: 4, background: "#111", cursor: "zoom-in" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.title}
                draggable={false}
                style={{ width: "100%", height: "100%", objectFit: "cover", userSelect: "none" }}
              />
              {editable && (
                <>
                  <button
                    type="button"
                    aria-label="Remove image"
                    onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                    style={removeBtnStyle}
                  >
                    ✕
                  </button>
                  {editingTitle === item.id ? (
                    <input
                      autoFocus
                      defaultValue={item.title}
                      onBlur={(e) => { renameItem(item.id, e.currentTarget.value); setEditingTitle(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                      onClick={(e) => e.stopPropagation()}
                      style={titleInputStyle}
                    />
                  ) : (
                    <div
                      onClick={(e) => { e.stopPropagation(); setEditingTitle(item.id); }}
                      style={titleCaptionStyle}
                      title="Click to rename"
                    >
                      {item.title || "Untitled"}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </GridLayout>
      )}

      {editable && uploadEndpoint && (
        <label style={uploadTileStyle}>
          {uploading ? "Uploading…" : "+ Add image"}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={uploading}
            onChange={(e) => { uploadFiles(e.currentTarget.files); e.currentTarget.value = ""; }}
            style={{ display: "none" }}
          />
        </label>
      )}

      <SimpleLightbox
        images={lightboxImages}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </div>
  );
}

const removeBtnStyle: React.CSSProperties = {
  position: "absolute",
  top: 4,
  right: 4,
  width: 22,
  height: 22,
  borderRadius: "50%",
  border: "none",
  background: "rgba(0,0,0,0.65)",
  color: "#fff",
  fontSize: 11,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2,
};

const titleCaptionStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  padding: "3px 6px",
  fontSize: 11,
  background: "rgba(0,0,0,0.6)",
  color: "#fff",
  cursor: "text",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const titleInputStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  padding: "3px 6px",
  fontSize: 11,
  border: "none",
  width: "100%",
  boxSizing: "border-box",
};

const uploadTileStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  marginTop: 10,
  padding: "10px 16px",
  border: "1px dashed currentColor",
  borderRadius: 4,
  fontSize: 13,
  cursor: "pointer",
  opacity: 0.75,
};

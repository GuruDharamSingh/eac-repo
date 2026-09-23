"use client";

import { useCallback, useRef, useState } from "react";
import { GridLayout, useContainerWidth, type Layout, type LayoutItem } from "react-grid-layout";
import { SimpleLightbox } from "./SimpleLightbox";
import { LibraryPicker, type LibraryEntry } from "./LibraryPicker";

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
  /** A second line under the title. */
  subtitle?: string;
  /** The picture's focal point in its tile, 0–100 % (CSS object-position). */
  fx?: number;
  fy?: number;
  /** 1 = fill the tile; up to 4. */
  zoom?: number;
  /** Anything else the caller keeps on an item travels through untouched. */
  [extra: string]: unknown;
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
  /**
   * GET endpoint listing images already in storage (`{ files }` or
   * `{ items }`, see LibraryPicker). When set, editors get an "Add from
   * files" button beside the upload, so a gallery can be assembled from
   * what is already in the person's folder and the org's tree.
   */
  libraryEndpoint?: string;
  /** Labels for the picker's source tabs, keyed by the `source` the endpoint returns. */
  librarySourceLabels?: Record<string, string>;
  /** Shown in the empty editable state. */
  emptyHint?: string;
  className?: string;

  // --- Presentation options. All off by default: IFAC's grid is unchanged. ---

  /**
   * Keep tiles SQUARE at every width: the row height follows the column
   * width, so a tile 4 wide and 4 tall is a square on a phone and on a wide
   * screen alike. Off, rows are a fixed 40px and a tile's shape drifts with
   * the page width.
   */
  squareTiles?: boolean;
  /** Space between tiles, px. Default 8. */
  gap?: number;
  /**
   * Titles for visitors: "hover" lays each tile's title over it when pointed
   * at or focused. Tiles with no title show nothing. Default "never" — the
   * grid has always shown titles only to its editor.
   */
  captions?: "never" | "hover";
  /**
   * The address to draw a TILE from, e.g. a downscaled variant. The
   * slideshow still opens the full image. Default: the item's own url.
   */
  thumb?: (url: string) => string;
  /**
   * What the hover caption holds, when it is more than a title — e.g. a
   * listing's year, price and an enquire link. Links inside it stay clickable
   * (the rest of the caption lets clicks through to the tile). Only used with
   * `captions="hover"`. Default: the item's title.
   */
  renderCaption?: (item: GalleryItem) => React.ReactNode;
  /** The slideshow's caption for an item. Default: its title. */
  lightboxCaption?: (item: GalleryItem) => string;
  /**
   * Let the editor FRAME each picture inside its tile — drag to move the
   * painting within its square, wheel or +/− to zoom. Saved on the item as
   * fx / fy / zoom and shown to everyone. Off by default.
   */
  framing?: boolean;
  /**
   * Take over what opening a picture does: called with the item's index
   * instead of showing the built-in slideshow — for a caller whose viewer
   * does more (e.g. nested galleries). Absent: the built-in slideshow.
   */
  onOpenItem?: (index: number) => void;
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

function toLayout(items: GalleryItem[], pinned: string | null = null): Layout {
  return items.map((item): LayoutItem => ({
    ...(item.id === pinned ? { static: true } : {}),
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
  libraryEndpoint,
  librarySourceLabels,
  emptyHint,
  className,
  squareTiles = false,
  gap = 8,
  captions = "never",
  thumb,
  renderCaption,
  lightboxCaption,
  framing = false,
  onOpenItem,
}: ProfileGalleryProps) {
  const [items, setItems] = useState<GalleryItem[]>(() => placeMissing(itemsProp));
  const [lightboxIndex, setLightboxIndexState] = useState<number | null>(null);
  const setLightboxIndex = (index: number | null) =>
    index !== null && onOpenItem ? onOpenItem(index) : setLightboxIndexState(index);
  const [uploading, setUploading] = useState(false);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  // The tile whose picture is being framed; it is pinned in the grid meanwhile.
  const [framingId, setFramingId] = useState<string | null>(null);
  const panFrom = useRef<{ x: number; y: number; fx: number; fy: number; w: number; h: number } | null>(null);
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

  function addFromLibrary(entries: LibraryEntry[]) {
    const have = new Set(items.map((i) => i.url));
    const stamp = Date.now();
    const added: GalleryItem[] = entries
      .filter((e) => !have.has(e.url))
      .map((e, n) => ({
        id: `lib-${stamp}-${n}`,
        url: e.url,
        title: e.name.replace(/\.[^.]+$/, "").replace(/^\d{10,}-/, ""),
      }));
    if (added.length) commit(placeMissing([...items, ...added]));
  }

  const layout = toLayout(items, framingId);

  function setFrame(id: string, patch: Partial<Pick<GalleryItem, "fx" | "fy" | "zoom">>) {
    commit(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  // Square tiles: one row as tall as one column is wide, so w === h is square.
  const rowHeight = squareTiles && width > 0 ? Math.max(12, (width - (COLS - 1) * gap) / COLS) : ROW_HEIGHT;
  const lightboxImages = items.map((i) => ({ url: i.url, alt: lightboxCaption ? lightboxCaption(i) : i.title }));

  return (
    <div ref={containerRef} className={className}>
      {mounted && (
        <GridLayout
          width={width}
          layout={layout}
          gridConfig={{ cols: COLS, rowHeight, margin: [gap, gap], containerPadding: [0, 0], maxRows: Infinity }}
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
              className={captions === "hover" && !editable ? "eac-gallery-tile eac-gallery-tile--captioned" : "eac-gallery-tile"}
              // A tile opens the slideshow, so it is reachable and operable
              // from the keyboard too — Enter or Space, like a button.
              role="button"
              tabIndex={0}
              aria-label={item.title ? `${item.title} — open full size` : "Open full size"}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setLightboxIndex(index);
                }
              }}
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
                src={thumb ? thumb(item.url) : item.url}
                alt={item.title}
                draggable={false}
                loading="lazy"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  userSelect: "none",
                  objectPosition: `${item.fx ?? 50}% ${item.fy ?? 50}%`,
                  ...(item.zoom && item.zoom !== 1
                    ? { transform: `scale(${item.zoom})`, transformOrigin: `${item.fx ?? 50}% ${item.fy ?? 50}%` }
                    : {}),
                }}
              />
              {editable && framing && framingId === item.id ? (
                <div
                  className="eac-frame-surface"
                  aria-label="Drag to move the picture inside its square; scroll to zoom"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    const r = e.currentTarget.getBoundingClientRect();
                    panFrom.current = { x: e.clientX, y: e.clientY, fx: item.fx ?? 50, fy: item.fy ?? 50, w: r.width, h: r.height };
                  }}
                  onPointerMove={(e) => {
                    const p = panFrom.current;
                    if (!p) return;
                    // Dragging the picture right shows more of its left side.
                    const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v * 10) / 10));
                    const z = item.zoom ?? 1;
                    setFrame(item.id, {
                      fx: clamp(p.fx - ((e.clientX - p.x) / p.w) * (100 / z)),
                      fy: clamp(p.fy - ((e.clientY - p.y) / p.h) * (100 / z)),
                    });
                  }}
                  onPointerUp={() => {
                    panFrom.current = null;
                  }}
                  onWheel={(e) => {
                    e.preventDefault();
                    const z = Math.min(4, Math.max(1, Math.round(((item.zoom ?? 1) - e.deltaY * 0.0015) * 100) / 100));
                    setFrame(item.id, { zoom: z });
                  }}
                >
                  <div className="eac-frame-tools" onPointerDown={(e) => e.stopPropagation()}>
                    <button type="button" aria-label="Zoom out" onClick={() => setFrame(item.id, { zoom: Math.max(1, Math.round(((item.zoom ?? 1) - 0.25) * 100) / 100) })}>−</button>
                    <button type="button" aria-label="Zoom in" onClick={() => setFrame(item.id, { zoom: Math.min(4, Math.round(((item.zoom ?? 1) + 0.25) * 100) / 100) })}>+</button>
                    <button type="button" onClick={() => setFrame(item.id, { fx: 50, fy: 50, zoom: 1 })}>Centre</button>
                    <button type="button" onClick={() => setFramingId(null)}>Done</button>
                  </div>
                </div>
              ) : null}
              {(() => {
                if (captions !== "hover" || editable) return null;
                const content = renderCaption ? renderCaption(item) : item.title;
                // Nothing to say, no scrim: an empty dark band on hover reads as broken.
                if (content === null || content === undefined || content === "" || content === false) return null;
                return (
                <span
                  className="eac-gallery-caption"
                  // A link inside the caption must not also open the slideshow.
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a")) e.stopPropagation();
                  }}
                >
                  {content}
                </span>
                );
              })()}
              {editable && (
                <>
                  {framing && framingId !== item.id ? (
                    <button
                      type="button"
                      aria-label="Frame this picture — move and zoom it inside its square"
                      title="Frame: move and zoom the picture inside its square"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); setFramingId(item.id); }}
                      style={{ ...removeBtnStyle, right: "auto", left: 4 }}
                    >
                      ⤧
                    </button>
                  ) : null}
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

      {editable && items.length === 0 && emptyHint && (
        <p style={{ fontSize: 13, opacity: 0.7, margin: "4px 0 0" }}>{emptyHint}</p>
      )}

      {editable && (uploadEndpoint || libraryEndpoint) && (
        <div className="eac-gallery-actions">
          {uploadEndpoint && (
            <label style={uploadTileStyle}>
              {uploading ? "Uploading…" : "+ Upload images"}
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
          {libraryEndpoint && (
            <button type="button" style={{ ...uploadTileStyle, background: "none", color: "inherit" }} onClick={() => setLibraryOpen(true)}>
              + Add from files
            </button>
          )}
        </div>
      )}

      {libraryOpen && libraryEndpoint && (
        <LibraryPicker
          endpoint={libraryEndpoint}
          existingUrls={new Set(items.map((i) => i.url))}
          sourceLabels={librarySourceLabels}
          onAdd={addFromLibrary}
          onClose={() => setLibraryOpen(false)}
        />
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
  padding: "10px 16px",
  border: "1px dashed currentColor",
  borderRadius: 4,
  fontSize: 13,
  cursor: "pointer",
  opacity: 0.75,
};

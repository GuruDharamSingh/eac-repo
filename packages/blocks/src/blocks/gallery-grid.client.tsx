"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProfileGallery, SimpleLightbox, type GalleryItem } from "@elkdonis/cms-ui/gallery";
import { sized } from "../media";
import { NEST_DEPTH, type Nested, type NestedPicture } from "./gallery-grid.nested";

// ============================================================================
// Saving a layout, from a component ANY org's page can host.
//
// Not a server action import — see gallery-grid.tsx's header for why. A
// fixed route every host implements, mirroring contact-form's /api/contact:
// the gallery's OWNER is the only one this can ever write as (the route's
// job, via @elkdonis/services' updateOwnGalleryItems), so posting here from a
// page that is not even the owner's own site is still safe by construction.
// A host with no such route gets a save that fails honestly (the "error"
// branch below), never one that silently drops the edit.
// ============================================================================
async function saveGalleryItems(
  galleryId: string,
  items: unknown
): Promise<{ error: string } | { ok: true }> {
  try {
    const res = await fetch(`/api/galleries/${encodeURIComponent(galleryId)}/items`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return { error: (body && typeof body.error === "string" && body.error) || "Could not save." };
    }
    return { ok: true };
  } catch {
    return { error: "Could not save — check your connection." };
  }
}

/** A tile as the grid receives it. `title` is live (an artwork's current title). */
export interface GridItem {
  id: string;
  url: string;
  title: string;
  /** A second line under the title, set per picture. */
  subtitle?: string;
  /** For a listed artwork: "2021 · Mixed media". */
  meta?: string | null;
  /** For a listed artwork: "Price on request", "$800", "Sold". */
  price?: string | null;
  /** Its marketplace page, while it is for sale. */
  href?: string | null;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  /** How the picture sits in its square: focal point % and zoom. */
  fx?: number;
  fy?: number;
  zoom?: number;
  /** The layout she saved as "my layout". */
  saved?: { x: number; y: number; w: number; h: number };
  /** Another of her galleries this picture opens — see nested.ts. */
  opens?: string;
}

/** One gallery the slideshow is inside; the last in the stack is on show. */
interface Level {
  /** null for the grid's own gallery. */
  id: string | null;
  title: string;
  pics: NestedPicture[];
  index: number;
}

type Layout = Pick<GridItem, "x" | "y" | "w" | "h">;

const COLS = 12;

const has = (i: Layout) => i.x !== undefined && i.y !== undefined && !!i.w && !!i.h;

/** Reading order: row by row, left to right. */
function inOrder(items: GridItem[]): GridItem[] {
  return [...items].sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));
}

/** `perRow` equal squares, in the given order. */
function uniform(items: GridItem[], perRow: number): GridItem[] {
  const w = Math.max(1, Math.floor(COLS / perRow));
  return items.map((i, n) => ({ ...i, x: (n % perRow) * w, y: Math.floor(n / perRow) * w, w, h: w }));
}

/** Place anything never sized by hand, `perRow` across, below what has been. */
function place(items: GridItem[], perRow: number): GridItem[] {
  const w = Math.max(1, Math.floor(COLS / perRow));
  let y = items.filter(has).reduce((m, i) => Math.max(m, (i.y ?? 0) + (i.h ?? 0)), 0);
  let n = 0;
  return items.map((i) => {
    if (has(i)) return i;
    const col = n % perRow;
    if (n > 0 && col === 0) y += w;
    n += 1;
    return { ...i, x: col * w, y, w, h: w };
  });
}

/**
 * Shuffle, give each picture a shape — a small or large square, tall or wide
 * — and pack them tightly: each goes in the highest free spot it fits.
 */
function randomize(items: GridItem[], perRow: number): GridItem[] {
  const u = Math.max(1, Math.floor(COLS / perRow));
  const shapes: Array<[number, number, number]> = [
    // [w, h, weight] in units of one small square
    [1, 1, 6],
    [2, 2, 2],
    [1, 2, 2],
    [2, 1, 2],
  ];
  const total = shapes.reduce((s, x) => s + x[2], 0);
  const pick = () => {
    let r = Math.random() * total;
    for (const s of shapes) if ((r -= s[2]) < 0) return s;
    return shapes[0];
  };
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const colsU = Math.floor(COLS / u);
  const filled: boolean[][] = [];
  const free = (x: number, y: number, w: number, h: number) => {
    if (x + w > colsU) return false;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (filled[yy]?.[xx]) return false;
    return true;
  };
  return shuffled.map((item) => {
    let [w, h] = pick();
    if (w > colsU) w = 1;
    for (let y = 0; ; y++) {
      for (let x = 0; x < colsU; x++) {
        if (free(x, y, w, h)) {
          for (let yy = y; yy < y + h; yy++) {
            filled[yy] ??= [];
            for (let xx = x; xx < x + w; xx++) filled[yy][xx] = true;
          }
          return { ...item, x: x * u, y: y * u, w: w * u, h: h * u };
        }
      }
    }
  });
}

export function GalleryGridView({
  items,
  galleryId,
  editable,
  perRow,
  gap,
  captions,
  title,
  nested,
}: {
  items: GridItem[];
  galleryId: string | null;
  editable: boolean;
  perRow: number;
  gap: number;
  captions: "never" | "hover";
  /** The grid's own gallery, as the first step of the slideshow's trail. */
  title: string;
  /** Galleries its pictures open, and theirs. */
  nested: Nested;
}) {
  // The arrangement on show. ProfileGallery reads its items ONCE, so a Reset
  // or Randomize swaps in a new list and bumps `version` to re-mount it.
  const [current, setCurrent] = useState<GridItem[]>(() => place(items, perRow));
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // The grid reports its layout as soon as it mounts. Only a real change is
  // worth writing — saving on load would also freeze "tiles across".
  const fingerprint = (list: Array<Record<string, unknown>>) =>
    list.map((i) => [i.id, i.title, i.x, i.y, i.w, i.h, i.fx, i.fy, i.zoom].join(":")).join("|");
  const lastSaved = useRef<string>(fingerprint(current as never));

  // The pictures can ARRIVE after the grid mounts — in the editor they come
  // from a fetch that finishes a moment later — and `current` above only reads
  // them once. When the set of pictures changes, take it up and re-mount the
  // grid. (Skipped on the first render, where it would re-mount for nothing.)
  const idsKey = items.map((i) => i.id).join("|");
  const seenIds = useRef(idsKey);
  useEffect(() => {
    if (seenIds.current === idsKey) return;
    seenIds.current = idsKey;
    const next = place(items, perRow);
    setCurrent(next);
    lastSaved.current = fingerprint(next as never);
    setVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const persist = useCallback(
    (next: GridItem[], delay = 800) => {
      if (!editable || !galleryId) return;
      if (fingerprint(next as never) === lastSaved.current) return;
      if (timer.current) clearTimeout(timer.current);
      setStatus("Unsaved…");
      timer.current = setTimeout(async () => {
        setStatus("Saving…");
        const res = await saveGalleryItems(galleryId, next);
        if (!("error" in res)) lastSaved.current = fingerprint(next as never);
        setStatus("error" in res ? res.error : "Saved");
      }, delay);
    },
    [editable, galleryId]
  );

  const onGridChange = useCallback(
    (next: GalleryItem[]) => {
      // Keep what only this wrapper knows (listing, subtitle, saved layout).
      const merged = next.map((t) => ({ ...(byId.get(t.id) ?? {}), ...current.find((c) => c.id === t.id), ...t })) as GridItem[];
      setCurrent(merged);
      persist(merged);
    },
    [byId, current, persist]
  );

  const replace = (next: GridItem[], note: string) => {
    setCurrent(next);
    setVersion((v) => v + 1);
    persist(next, 0);
    setStatus(note);
  };

  // A listing's details go OVER the picture on hover — never beneath it, so
  // listed and unlisted pictures pack into the same tight grid.
  const caption = useCallback(
    (tile: GalleryItem) => {
      const i = byId.get(tile.id);
      const subtitle = (current.find((c) => c.id === tile.id)?.subtitle ?? i?.subtitle) || "";
      if (!i || (!i.title && !i.price && !subtitle)) return null;
      return (
        <>
          {i.title ? <cite className="dm-grid-cap-title">{i.title}</cite> : null}
          {subtitle ? <span className="dm-grid-cap-meta">{subtitle}</span> : null}
          {i.meta ? <span className="dm-grid-cap-meta">{i.meta}</span> : null}
          {i.price ? (
            <span className="dm-grid-cap-price">
              {i.price}
              {i.href ? (
                <>
                  {" · "}
                  <a href={i.href} target="_blank" rel="noopener noreferrer">
                    Enquire / buy<span className="dm-sr"> — {i.title} (opens in a new tab)</span>
                  </a>
                </>
              ) : null}
            </span>
          ) : null}
        </>
      );
    },
    [byId, current]
  );

  const slideCaption = useCallback(
    (tile: GalleryItem) => {
      const i = byId.get(tile.id);
      return [i?.title || tile.title, i?.subtitle, i?.meta].filter(Boolean).join(" — ");
    },
    [byId]
  );

  // The slideshow. ProfileGallery hands a click over (onOpenItem) instead of
  // opening its own, because this one can go INTO a gallery a picture opens:
  // a stack of levels, the arrows step through the top one, the trail and
  // Escape go back up to the picture the visitor came from.
  const [stack, setStack] = useState<Level[]>([]);
  const top = stack[stack.length - 1];
  const topPic = top?.pics[top.index];
  const openGrid = (index: number) =>
    setStack([
      {
        id: galleryId,
        title,
        index,
        pics: current.map((i) => ({
          id: i.id,
          url: i.url,
          title: i.title,
          caption: slideCaption(i as GalleryItem),
          href: i.href,
          opens: i.opens,
        })),
      },
    ]);
  const enter = (id: string, index = 0) => {
    const g = nested[id];
    if (!g || g.items.length === 0) return;
    setStack((s) => [...s, { id, title: g.title, pics: g.items, index }]);
  };
  const into =
    topPic?.opens && stack.length <= NEST_DEPTH && !stack.some((l) => l.id === topPic.opens)
      ? nested[topPic.opens]
      : undefined;

  if (items.length === 0) {
    return <p className="dm-works-empty">This gallery is empty, or no gallery is linked to this page yet.</p>;
  }

  const hasSaved = current.some((i) => i.saved);

  return (
    <div className="dm-grid-wrap" data-editable={editable ? "true" : "false"}>
      {editable ? (
        <div className="dm-grid-note" role="group" aria-label="Arrange this gallery">
          <p>
            Drag a picture to move it · drag its corner to resize · <strong>⤧</strong> frames the painting inside its
            square · click a title to rename.
            {status ? <strong className="dm-grid-status"> {status}</strong> : null}
          </p>
          <div className="dm-grid-tools">
            <button type="button" onClick={() => replace(uniform(inOrder(current), perRow), "Reset to squares.")}>
              Reset to squares
            </button>
            <button type="button" onClick={() => replace(randomize(current, perRow), "Randomized.")}>
              Randomize
            </button>
            <button
              type="button"
              onClick={() => {
                const next = current.map((i) => ({ ...i, saved: { x: i.x ?? 0, y: i.y ?? 0, w: i.w ?? 3, h: i.h ?? 3 } }));
                setCurrent(next);
                persist(next, 0);
                setStatus("Saved as my layout.");
              }}
            >
              Save as my layout
            </button>
            <button
              type="button"
              disabled={!hasSaved}
              title={hasSaved ? "Go back to the layout you saved" : "Save a layout first"}
              onClick={() => replace(current.map((i) => (i.saved ? { ...i, ...i.saved } : i)), "My layout restored.")}
            >
              Use my layout
            </button>
          </div>
        </div>
      ) : null}
      <ProfileGallery
        key={version}
        items={current as GalleryItem[]}
        editable={editable}
        onChange={onGridChange}
        squareTiles
        gap={gap}
        captions={captions}
        thumb={(url) => sized(url, 512)}
        renderCaption={caption}
        lightboxCaption={slideCaption}
        framing
        onOpenItem={openGrid}
      />
      <SimpleLightbox
        images={top ? top.pics.map((p) => ({ url: p.url, alt: p.caption })) : []}
        index={top ? top.index : null}
        onClose={() => setStack([])}
        onIndexChange={(index) => setStack((s) => s.map((l, n) => (n === s.length - 1 ? { ...l, index } : l)))}
        onEscape={() => setStack((s) => s.slice(0, -1))}
        trail={
          stack.length > 1 ? (
            <>
              {stack.slice(0, -1).map((l, n) => (
                <span key={n}>
                  <button type="button" onClick={() => setStack((s) => s.slice(0, n + 1))}>
                    {l.title || "Gallery"}
                  </button>
                  <span aria-hidden="true"> ›</span>
                </span>
              ))}
              <span aria-current="location">{top.title}</span>
            </>
          ) : undefined
        }
        extra={
          into && into.items.length > 0 ? (
            <div className="dm-set-into">
              <button type="button" className="dm-set-into-go" onClick={() => enter(into.id)}>
                Enter <em>{into.title}</em> ({into.items.length}) <span aria-hidden="true">→</span>
              </button>
              <ul className="dm-set-into-strip" aria-label={`In ${into.title}`}>
                {into.items.slice(0, 5).map((p, k) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => enter(into.id, k)}
                      aria-label={p.title || `Picture ${k + 1} of ${into.title}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={sized(p.url, 256)} alt="" loading="lazy" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : undefined
        }
      />
    </div>
  );
}

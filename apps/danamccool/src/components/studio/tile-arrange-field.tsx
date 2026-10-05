"use client";

import { FieldLabel, useGetPuck } from "@puckeditor/core";
import { useRef, useState } from "react";
import { ProfileGallery, type GalleryItem } from "@elkdonis/cms-ui/gallery";
import { sized } from "@/blocks/media";
import { parseLayout, placeTiles, squares, tileKeys, type Place, type TileRow } from "@/blocks/collection-nav-layout";

// ============================================================================
// "Arrange tiles" — the Collections navigator's layout, set by hand.
//
// A button in the right column opens a full-width window holding the Gallery
// grid's own editor (cms-ui ProfileGallery, editable): drag a tile to move it,
// drag its corner to resize, ⤧ to move and zoom the picture inside it. Every
// change is written to the block's `layout` prop at once, so the canvas
// behind shows it; Publish saves it with the page, like any other field.
//
// In a window rather than on the canvas because the canvas already has a
// drag — Puck's, which moves whole blocks — and the two would fight.
//
// The tiles come from the selected block (its Tile rows); this field stores
// only where each one sits. ProfileGallery's own remove and rename controls
// are hidden here (block-fields.css): a tile is added, named and removed in
// its row, where the page keeps it.
// ============================================================================

export function TileArrangeField({
  value,
  onChange,
  readOnly,
}: {
  value?: unknown;
  onChange: (v: string) => void;
  readOnly?: boolean;
}) {
  const getPuck = useGetPuck();
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [version, setVersion] = useState(0);
  const [keys, setKeys] = useState<string[]>([]);

  const selected = () => (getPuck().selectedItem?.props ?? {}) as { tiles?: TileRow[]; perRow?: string; gap?: string };

  const build = (layout: Record<string, Place>) => {
    const p = selected();
    const rows = (p.tiles ?? []).filter((t) => typeof t.image === "string" && t.image.trim());
    const k = tileKeys(rows);
    const places = placeTiles(k, layout, Number(p.perRow ?? 3));
    setKeys(k);
    setItems(
      rows.map((t, i) => ({
        id: k[i]!,
        url: String(t.image),
        title: String(t.label ?? ""),
        ...places[i]!,
      }))
    );
    setVersion((v) => v + 1);
  };

  const save = (next: GalleryItem[]) => {
    const layout: Record<string, Place> = {};
    for (const i of next) {
      if (typeof i.x !== "number" || typeof i.y !== "number" || !i.w || !i.h) continue;
      layout[i.id] = {
        x: i.x,
        y: i.y,
        w: i.w,
        h: i.h,
        ...(typeof i.fx === "number" ? { fx: i.fx } : {}),
        ...(typeof i.fy === "number" ? { fy: i.fy } : {}),
        ...(typeof i.zoom === "number" ? { zoom: i.zoom } : {}),
      };
    }
    onChange(JSON.stringify(layout));
  };

  const reset = (across: number) => {
    const layout = squares(keys, across);
    onChange(JSON.stringify(layout));
    build(layout);
  };

  const count = (selected().tiles ?? []).filter((t) => typeof t.image === "string" && t.image.trim()).length;
  const gap = Number(selected().gap ?? 12);

  return (
    <FieldLabel label="Arrangement" el="div">
      <div className="dm-arr">
        <button
          type="button"
          className="dm-arr-open"
          disabled={readOnly || count === 0}
          onClick={() => {
            build(parseLayout(value));
            dialog.current?.showModal();
          }}
        >
          Arrange tiles…
        </button>
        <p className="dm-arr-note">
          {count === 0
            ? "Add tiles with pictures first."
            : "Move, resize and frame the tiles in a larger window. Changes show on the page behind it."}
        </p>
      </div>
      <dialog ref={dialog} className="dm-arr-dialog" aria-labelledby="dm-arr-title">
        <div className="dm-arr-body">
          <div className="dm-arr-head">
            <h2 id="dm-arr-title">Arrange tiles</h2>
            <div className="dm-arr-tools" role="group" aria-label="Arrangement tools">
              {[2, 3, 4, 6].map((n) => (
                <button key={n} type="button" onClick={() => reset(n)}>
                  Squares, {n} across
                </button>
              ))}
              <button type="button" className="dm-arr-done" onClick={() => dialog.current?.close()}>
                Done
              </button>
            </div>
          </div>
          <p className="dm-arr-note">
            Drag a tile to move it · drag its bottom-right corner to resize · <strong>⤧</strong> moves and zooms the
            picture inside its tile.
          </p>
          <div className="dm-arr-canvas">
            {items.length ? (
              <ProfileGallery
                key={version}
                items={items}
                editable
                onChange={save}
                squareTiles
                gap={Number.isFinite(gap) ? gap : 12}
                framing
                thumb={(url) => sized(url, 512)}
              />
            ) : null}
          </div>
        </div>
      </dialog>
    </FieldLabel>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGetPuck, walkTree, type Data } from "@puckeditor/core";
import type { BlockDef } from "@elkdonis/blocks";

// ============================================================================
// Making a block taller by pulling its bottom edge down.
//
// The block declares `resize: { height: "<number prop>", target? }` (see
// BlockDef.resize). While it is selected, a bar sits across the bottom edge
// of the marked element (or of the whole block); dragging it writes the prop
// in pixels, rounded to 10. Double-clicking the bar sets it back to 0, which
// every such block reads as "as tall as its content".
//
// Same mechanics as the image handles in canvas-drag.tsx, for the same
// reasons: portalled to the canvas body so it changes nothing about the
// layout, positioned from a per-frame measurement, one history entry per
// gesture, and the selection re-asserted afterwards.
// ============================================================================

export function HeightHandle({ id, def }: { id: string; def: BlockDef }) {
  const resize = def.resize!;
  const getPuck = useGetPuck();
  const anchor = useRef<HTMLSpanElement | null>(null);
  const [doc, setDoc] = useState<Document | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const drag = useRef<{ pointerId: number; startY: number; startHeight: number } | null>(null);

  useEffect(() => {
    setDoc(anchor.current?.ownerDocument ?? null);
  }, []);

  const find = useCallback(() => {
    const block = doc?.querySelector<HTMLElement>(`[data-puck-component="${id}"]`) ?? null;
    if (!block || !resize.target) return block;
    return block.querySelector<HTMLElement>(`[data-resize-target="${resize.target}"]`);
  }, [doc, id, resize.target]);

  useEffect(() => {
    if (!doc) return;
    let frame = 0;
    let last = "";
    const tick = () => {
      const next = find()?.getBoundingClientRect() ?? null;
      const key = next ? `${next.left},${next.top},${next.width},${next.height}` : "";
      if (key !== last) {
        last = key;
        setRect(next);
      }
      frame = doc.defaultView!.requestAnimationFrame(tick);
    };
    tick();
    return () => doc.defaultView?.cancelAnimationFrame(frame);
  }, [doc, find]);

  const write = useCallback(
    (height: number, record: boolean) => {
      const { dispatch, config } = getPuck();
      dispatch({
        type: "setData",
        recordHistory: record,
        data: (previous: Data) =>
          walkTree(previous, config, (content) =>
            content.map((node) =>
              (node.props as { id?: string })?.id === id
                ? { ...node, props: { ...node.props, [resize.height]: height } }
                : node
            )
          ),
      });
    },
    [getPuck, id, resize.height]
  );

  const reselect = useCallback(() => {
    const { dispatch, getSelectorForId } = getPuck();
    const selector = getSelectorForId(id);
    if (selector) dispatch({ type: "setUi", recordHistory: false, ui: { itemSelector: selector } });
  }, [getPuck, id]);

  // The prop's own range, as the panel's slider uses it.
  const prop = def.props.find((p) => p.name === resize.height);
  const min = prop?.min ?? 0;
  const max = prop?.max ?? 2000;

  const onPointerDown = (e: React.PointerEvent) => {
    // Puck starts its own component drag on pointerdown; this one is ours.
    e.preventDefault();
    e.stopPropagation();
    const el = find();
    if (!el) return;
    drag.current = { pointerId: e.pointerId, startY: e.clientY, startHeight: el.getBoundingClientRect().height };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    e.preventDefault();
    const height = Math.min(max, Math.max(min, Math.round((d.startHeight + e.clientY - d.startY) / 10) * 10));
    setHint(`${height}px tall`);
    write(height, false);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    e.stopPropagation();
    drag.current = null;
    setHint(null);
    const item = getPuck().getItemById(id);
    const height = (item?.props as Record<string, unknown> | undefined)?.[resize.height];
    // Re-commit with history on, so one undo returns to before the drag.
    write(typeof height === "number" ? height : 0, true);
    reselect();
  };

  const marker = <span ref={anchor} style={{ display: "none" }} aria-hidden />;
  if (!rect || !doc) return marker;

  return (
    <>
      {marker}
      {createPortal(
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Drag down to make it taller; double-click to go back to its own height"
          title="Drag to change the height · double-click to reset"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => {
            e.stopPropagation();
            write(0, true);
            reselect();
          }}
          className="eac-height-handle"
          style={{
            position: "fixed",
            left: rect.left + rect.width / 2 - 28,
            top: rect.bottom - 6,
            width: 56,
            height: 12,
          }}
        >
          {hint ? <span className="eac-height-handle-hint">{hint}</span> : null}
        </div>,
        doc.body
      )}
    </>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useGetPuck, createUsePuck, walkTree, type Data } from "@puckeditor/core";
import type { BlockDef } from "@elkdonis/blocks";

// ============================================================================
// Moving a picture by picking it up.
//
// Position was a dropdown. That is a correct control and the wrong gesture:
// nobody places a picture in a document by choosing "Left — text wraps to the
// right" from a list. In a word processor you pick the thing up, put it where
// you want it, and the words get out of the way.
//
// ── What this actually does, and what it cannot ────────────────────────────
//
// The words getting out of the way is CSS `float`, and float has ONE rule that
// shapes everything here: a float is anchored in the text, and it pushes aside
// the lines that come AFTER it. So an image cannot be dropped at an arbitrary
// point with the text above it wrapping upward — there is no such layout on
// the web, and Word only appears to do it because it anchors to a paragraph
// too. What a drag CAN control, completely and continuously, is:
//
//   sideways  → which side of the column it sits on (and, past the ends,
//               whether it sits above or below the text entirely)
//   downward  → how far down the text it starts, which is a top margin. The
//               lines above it run full width; the lines beside it close in.
//   a corner  → how wide it is.
//
// Between them that is the whole of a word processor's Square and Tight wrap,
// and it reflows continuously while the pointer moves because the browser is
// doing the layout, not us.
//
// ── Why this lives here and not in the block ───────────────────────────────
//
// The block declares `manipulate` — "this element can be moved, and these
// props are its position and size" — and marks the element with
// `data-drag-target`. That is data and an attribute. Everything below (Puck's
// store, its dispatch, its component ids) is editor machinery, and putting it
// in @elkdonis/blocks would mean a block could not be rendered on a plain page
// without an editor in the bundle.
// ============================================================================

const usePuckSelector = createUsePuck();

/** Where a pointer inside the block means the image should go. */
type Place = "left" | "right" | "above" | "below";

interface DragState {
  pointerId: number;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  startSize: number;
  startOffset: number;
  /** The block's own box, measured once at pointerdown. */
  blockRect: { left: number; top: number; width: number; height: number };
}

export interface CanvasDragProps {
  id: string;
  def: BlockDef;
  /** Puck's per-component context. Absent outside the editor. */
  isEditing?: boolean;
  children?: ReactNode;
}

export function CanvasDrag({ id, def, isEditing, children }: CanvasDragProps) {
  const manipulate = def.manipulate;

  // Only the SELECTED block gets handles. Overlays on every image would sit in
  // front of Puck's own hover and click targets and make the canvas unusable.
  const selectedId = usePuckSelector((s) => s.selectedItem?.props?.id as string | undefined);
  const selected = isEditing && !!manipulate && selectedId === id;

  if (!selected) return <>{children}</>;
  return (
    <>
      {children}
      <DragHandles id={id} manipulate={manipulate!} />
    </>
  );
}

/**
 * The handles themselves, mounted only while the block is selected.
 *
 * Split from CanvasDrag so that every unselected block on the page costs one
 * store subscription and nothing else — no refs, no observers, no portal.
 */
function DragHandles({
  id,
  manipulate,
}: {
  id: string;
  manipulate: NonNullable<BlockDef["manipulate"]>;
}) {
  const getPuck = useGetPuck();
  const [rect, setRect] = useState<DOMRect | null>(null);
  /**
   * WHICH document the canvas is.
   *
   * Not `document`. Puck renders the canvas into an iframe through a React
   * PORTAL, so this component's markup lands in the iframe while its code
   * still runs in the top window — and the global `document` is therefore the
   * wrong one. `document.querySelector('[data-puck-component=...]')` finds
   * nothing, silently, and the handles never appear. That is not a detail that
   * announces itself: everything else about the component works.
   *
   * An invisible anchor rendered alongside the block is the reliable way to
   * ask "where did I actually end up" — `ownerDocument` on any node in the
   * subtree is the iframe's document, and every measurement, every listener
   * and the portal target all have to come from it.
   */
  const anchor = useRef<HTMLSpanElement | null>(null);
  const [doc, setDoc] = useState<Document | null>(null);

  /**
   * Which side the picture is on — which decides which side its handle is on.
   *
   * The handle belongs on the INNER edge, the one facing the text. Put it on
   * the outer edge and a right-placed image's handle sits past the end of the
   * column, half outside the canvas and awkward or impossible to hit; it also
   * asks you to drag away from the text to make the image bigger, which is
   * backwards.
   */
  const place = usePuckSelector((s) => {
    if (!manipulate.place) return "left";
    const item = s.getItemById(id) as { props?: Record<string, unknown> } | undefined;
    return String(item?.props?.[manipulate.place] ?? "left");
  });
  const handleOnLeft = place === "right";

  const [hint, setHint] = useState<string | null>(null);
  const drag = useRef<DragState | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const blockRef = useRef<HTMLElement | null>(null);

  /**
   * The element to be dragged is found by QUERY, not by a ref.
   *
   * This component renders as a SIBLING of the block rather than wrapping it —
   * a wrapper would be a box in the layout, and a box around a float is
   * exactly the thing that would stop the wrap working. Puck stamps
   * `data-puck-component` on the block's root in the canvas, so that plus the
   * block's own `data-drag-target` addresses the element precisely.
   */
  // The anchor lands in the canvas on first paint; everything else waits for
  // it, because until it exists we do not know which document we are in.
  useEffect(() => {
    setDoc(anchor.current?.ownerDocument ?? null);
  }, []);

  /**
   * Follow the image — however it moved.
   *
   * A frame loop rather than a ResizeObserver, which was the first version and
   * was wrong in a way that only showed up in use: an observer fires when a
   * box changes SIZE, and moving a picture from the left of the column to the
   * right changes only its position. The outline stayed behind on the left
   * while the image sat on the right, and the resize handle with it, so the
   * second gesture of any sequence grabbed empty space.
   *
   * Reflow has too many causes to enumerate — a prop change, a font arriving,
   * an image decoding, the canvas being zoomed, a block added above. Reading
   * the rect each frame and writing state only when it actually differs costs
   * one getBoundingClientRect per frame while a single block is selected, and
   * is right for all of them.
   */
  useEffect(() => {
    if (!doc) return;
    let frame = 0;
    let last = "";
    const tick = () => {
      const block = doc.querySelector<HTMLElement>(`[data-puck-component="${id}"]`);
      const target = block?.querySelector<HTMLElement>(`[data-drag-target="${manipulate.target}"]`);
      blockRef.current = block ?? null;
      targetRef.current = target ?? null;
      const next = target?.getBoundingClientRect() ?? null;
      const key = next ? `${next.left},${next.top},${next.width},${next.height}` : "";
      if (key !== last) {
        last = key;
        setRect(next);
      }
      frame = doc.defaultView!.requestAnimationFrame(tick);
    };
    tick();
    return () => doc.defaultView?.cancelAnimationFrame(frame);
  }, [doc, id, manipulate.target]);

  /** Write props back into the document. */
  const patch = useCallback(
    (props: Record<string, unknown>, record: boolean) => {
      const { dispatch, config } = getPuck();
      dispatch({
        type: "setData",
        // History gets ONE entry per gesture, not one per pointermove. Without
        // this, undo after dragging an image four pixels would take four
        // presses to get anywhere.
        recordHistory: record,
        data: (previous: Data) =>
          walkTree(previous, config, (content) =>
            content.map((node) =>
              (node.props as { id?: string })?.id === id
                ? { ...node, props: { ...node.props, ...props } }
                : node
            )
          ),
      });
    },
    [getPuck, id]
  );

  const currentProps = useCallback(() => {
    const item = getPuck().getItemById(id);
    return (item?.props ?? {}) as Record<string, unknown>;
  }, [getPuck, id]);

  const onPointerDown = (mode: DragState["mode"]) => (e: React.PointerEvent) => {
    // Puck listens for pointer events on the component to start its own
    // component drag. These handles are OURS; stop the event here or picking
    // up the image would also pick up the whole block.
    e.preventDefault();
    e.stopPropagation();
    // Queried fresh rather than trusted from the last measurement. Every drag
    // re-renders the block, which can leave the cached node detached — and a
    // stale ref here meant the resize handle silently did nothing at all,
    // while the move handle (which had been pressed before any re-render)
    // worked fine.
    const block =
      blockRef.current?.isConnected
        ? blockRef.current
        : doc?.querySelector<HTMLElement>(`[data-puck-component="${id}"]`) ?? null;
    if (!block) return;
    blockRef.current = block;
    const props = currentProps();
    const box = block.getBoundingClientRect();
    drag.current = {
      pointerId: e.pointerId,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startSize: typeof props[manipulate.size ?? ""] === "number" ? (props[manipulate.size!] as number) : 40,
      startOffset:
        typeof props[manipulate.offset ?? ""] === "number" ? (props[manipulate.offset!] as number) : 0,
      blockRect: { left: box.left, top: box.top, width: box.width, height: box.height },
    };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    e.preventDefault();

    const next: Record<string, unknown> = {};

    if (d.mode === "resize" && manipulate.size) {
      // Which way "wider" is depends on which side the picture is on: for a
      // left-placed image the handle is on its right, for a right-placed one
      // it is on its left and dragging left makes it bigger.
      const place = String(currentProps()[manipulate.place ?? ""] ?? "left");
      const direction = place === "right" ? -1 : 1;
      const deltaPercent = ((e.clientX - d.startX) * direction) / d.blockRect.width * 100;
      next[manipulate.size] = clamp(Math.round(d.startSize + deltaPercent), 15, 100);
      setHint(`${next[manipulate.size]}% wide`);
    } else {
      if (manipulate.place) {
        const place = placeFor(e.clientX, e.clientY, d.blockRect);
        if (place) next[manipulate.place] = place;
      }
      if (manipulate.offset) {
        const beside = next[manipulate.place ?? ""] ?? currentProps()[manipulate.place ?? ""];
        // Sliding down only means anything while the image is BESIDE the text.
        // Above and below have nothing to start lower than.
        next[manipulate.offset] =
          beside === "above" || beside === "below" || beside === "none"
            ? 0
            : clamp(Math.round((d.startOffset + (e.clientY - d.startY)) / 4) * 4, 0, 600);
      }
      const p = next[manipulate.place ?? ""] ?? currentProps()[manipulate.place ?? ""];
      const off = next[manipulate.offset ?? ""];
      setHint(`${String(p)}${off ? ` · ${off}px down` : ""}`);
    }

    patch(next, false);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    e.stopPropagation();
    drag.current = null;
    setHint(null);
    // One history entry for the whole gesture. The props are already correct;
    // this re-commits them with recordHistory on so undo returns to where the
    // picture was before it was picked up.
    patch(currentProps(), true);

    /**
     * Keep the block selected.
     *
     * The overlay is portalled to the canvas BODY, so it is not inside
     * `[data-puck-component]` as far as the DOM is concerned — and the click
     * that ends a drag therefore reads to Puck as a click on the background,
     * which deselects. Measured: after one drag the fields panel fell back to
     * "Page" and the handles vanished, so moving a picture twice meant
     * re-selecting it in between.
     *
     * Re-asserting the selection is better than trying to stop the event
     * reaching whatever listener does the deselecting: it does not depend on
     * where that listener happens to be attached this version.
     */
    const { dispatch, getSelectorForId } = getPuck();
    const selector = getSelectorForId(id);
    if (selector) {
      dispatch({ type: "setUi", recordHistory: false, ui: { itemSelector: selector } });
    }
  };

  // `display: none` — it is a place marker, not a box. Rendered unconditionally
  // because it is what tells us which document we are in.
  const marker = <span ref={anchor} style={{ display: "none" }} aria-hidden />;

  if (!rect || !doc) return marker;

  // Portalled to the canvas body rather than rendered in place: an element
  // inside the block would either be swallowed by the float or become a box in
  // the flow, and the whole point is to change nothing about the layout.
  return (
    <>
      {marker}
      {createPortal(
    <div
      style={{
        position: "fixed",
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        zIndex: 40,
        cursor: "move",
        outline: "2px solid var(--puck-color-interactive, #0670e0)",
        outlineOffset: 1,
        touchAction: "none",
      }}
      onPointerDown={onPointerDown("move")}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => e.stopPropagation()}
      role="application"
      aria-label="Drag to move the image; the text flows around it"
    >
      {hint ? (
        <div
          style={{
            position: "absolute",
            top: -26,
            left: 0,
            padding: "2px 8px",
            borderRadius: 4,
            background: "var(--puck-color-interactive, #0670e0)",
            color: "#fff",
            font: "500 12px/1.6 system-ui, sans-serif",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {hint}
        </div>
      ) : null}

      {manipulate.size ? (
        <span
          onPointerDown={onPointerDown("resize")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            position: "absolute",
            ...(handleOnLeft ? { left: -7 } : { right: -7 }),
            bottom: -7,
            width: 14,
            height: 14,
            borderRadius: 3,
            background: "#fff",
            border: "2px solid var(--puck-color-interactive, #0670e0)",
            cursor: "ew-resize",
            touchAction: "none",
          }}
          aria-label="Drag to resize the image"
        />
      ) : null}
    </div>,
        doc.body
      )}
    </>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Which side the pointer is asking for.
 *
 * Above and below are the ENDS of the gesture — drag the picture off the top
 * of the text and it stops floating and sits above it, which is what dragging
 * it "out of" the text should mean. Between the thresholds the side is left
 * alone, so a mostly-vertical drag does not keep flipping sides under the
 * hand.
 */
function placeFor(
  x: number,
  y: number,
  block: { left: number; top: number; width: number; height: number }
): Place | null {
  if (y < block.top - 24) return "above";
  if (y > block.top + block.height + 24) return "below";
  const ratio = (x - block.left) / block.width;
  if (ratio < 0.4) return "left";
  if (ratio > 0.6) return "right";
  return null;
}

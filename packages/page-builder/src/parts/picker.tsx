"use client";

import { useEffect, useReducer, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createUsePuck, useGetPuck } from "@puckeditor/core";
import { closeItemFocus } from "../drag/item-focus";
import { drawnParts, nextPart, partAround, partsIn, partsOf, ROOT_PART } from "./find";
import { endSpell, selectPart, setCanvasDocument, useHoveredPart, usePartSelection, partSelection } from "./store";
import type { PartsContract } from "./types";

// ============================================================================
// Canvas side of the parts plugin (2026-11-06), mounted from Puck's `iframe`
// override, so it has the canvas document.
//
//   first click     Puck selects the block, as always.
//   next clicks     inside the selected block, the canvas's click-through:
//                   the outermost declared part under the pointer, then one
//                   part deeper per click; a click on a cousin goes to the
//                   part inside the nearest part both share (find.ts
//                   `nextPart`). Alt+click goes straight to the deepest.
//                   Puck sets `pointer-events: none` inside a block, so
//                   every click arrives at the block's wrapper; parts are
//                   found by rectangle, in a capture-phase listener.
//   Escape          one part out; from an outermost part, back to the block
//                   (in the canvas and in the editor's document, where the
//                   panel is).
//   Enter           one part in (canvas only, never while typing).
//   double-click    the block in the host's popup (popup.tsx), when the host
//                   passes one; on a Puck inline field it stays Puck's typing.
//
// Outlines: every part of the selected block dashed, the selected part solid
// with its name. Drawn in a fixed layer in the canvas body, redrawn on scroll,
// resize and any change to the canvas.
// ============================================================================

const usePuck = createUsePuck();
type Selected = { type: string; props: { id: string } } | null;

export function PartPicker({ doc, contract, rootLabel, open, children }: { doc?: Document; contract: PartsContract; rootLabel?: string; open?: (getPuck: ReturnType<typeof useGetPuck>, id: string) => boolean; children: ReactNode }) {
  const getPuck = useGetPuck();
  const selected = usePuck((s) => s.selectedItem) as Selected;
  const sel = usePartSelection();
  const hovered = useHoveredPart();
  const [, redraw] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    setCanvasDocument(doc ?? null);
    return () => setCanvasDocument(null);
  }, [doc]);

  // Clicks and Escape.
  useEffect(() => {
    if (!doc) return;
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || getPuck().appState.ui.previewMode !== "edit") return;
      const item = getPuck().selectedItem as Selected;
      const target = (e.target as Element | null)?.closest?.("[data-puck-component]");
      if (!item || !target || target.getAttribute("data-puck-component") !== item.props.id || !partsOf(contract, item.type)) {
        // Another block (Puck selects it) or a block with no parts: no part.
        if (partSelection()) {
          endSpell();
          selectPart(null);
        }
        return;
      }
      const now = partSelection();
      const drawn = drawnParts(doc, item.props.id, item.type, contract, rootLabel);
      const part = nextPart(drawn, now?.id === item.props.id ? now.part : null, e.clientX, e.clientY, e.altKey);
      endSpell();
      if (!part) {
        // The block's own ground, outside every part: back to the block.
        selectPart(null);
        return;
      }
      closeItemFocus();
      selectPart({ id: item.props.id, part });
    };
    const onKey = (e: KeyboardEvent) => {
      const now = partSelection();
      const item = getPuck().selectedItem as Selected;
      if (e.key === "Escape" && now) {
        const drawn = item && item.props.id === now.id ? drawnParts(doc, now.id, item.type, contract, rootLabel) : [];
        const up = now.part === ROOT_PART ? null : partAround(drawn, now.part);
        endSpell();
        selectPart(up ? { id: now.id, part: up } : null);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key !== "Enter" || e.currentTarget !== doc || !item || !partsOf(contract, item.type)) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName))) return;
      const drawn = drawnParts(doc, item.props.id, item.type, contract, rootLabel);
      const inner = partsIn(drawn, now?.id === item.props.id && now.part !== ROOT_PART ? now.part : null)[0];
      if (!inner) return;
      endSpell();
      selectPart({ id: item.props.id, part: inner });
      e.preventDefault();
      e.stopPropagation();
    };
    // The innermost block under the pointer: Puck stops pointer events inside a block, except on its inline fields.
    const onDouble = (e: MouseEvent) => {
      if (!open || e.button !== 0 || getPuck().appState.ui.previewMode !== "edit") return;
      const t = e.target as Element | null;
      if (t?.closest?.("[data-puck-overlay-portal]")) return;
      const id = t?.closest?.("[data-puck-component]")?.getAttribute("data-puck-component");
      if (id && open(getPuck, id)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const host = typeof document === "undefined" ? null : document;
    doc.addEventListener("click", onClick, true);
    doc.addEventListener("dblclick", onDouble, true);
    doc.addEventListener("keydown", onKey, true);
    if (host && host !== doc) host.addEventListener("keydown", onKey, true);
    return () => {
      doc.removeEventListener("click", onClick, true);
      doc.removeEventListener("dblclick", onDouble, true);
      doc.removeEventListener("keydown", onKey, true);
      if (host && host !== doc) host.removeEventListener("keydown", onKey, true);
    };
  }, [doc, contract, rootLabel, getPuck, open]);

  // A part belongs to one block: selecting another block, or none, clears it.
  const selectedId = selected?.props.id;
  useEffect(() => {
    if (sel && selectedId !== sel.id) {
      endSpell();
      selectPart(null);
    }
  }, [selectedId, sel]);

  // Outlines follow the page.
  const hasParts = !!selected && !!partsOf(contract, selected.type);
  useEffect(() => {
    if (!doc || !hasParts) return;
    const win = doc.defaultView;
    if (!win) return;
    let frame = 0;
    const later = () => {
      if (!frame) frame = win.requestAnimationFrame(() => ((frame = 0), redraw()));
    };
    win.addEventListener("scroll", later, true);
    win.addEventListener("resize", later);
    const mo = new win.MutationObserver((records) => {
      // The outline layer's own redraws are not changes to the page.
      if (records.every((r) => (r.target as Element).closest?.("[data-eac-part-layer]"))) return;
      later();
    });
    mo.observe(doc.body, { subtree: true, childList: true, attributes: true, characterData: true });
    return () => {
      if (frame) win.cancelAnimationFrame(frame);
      win.removeEventListener("scroll", later, true);
      win.removeEventListener("resize", later);
      mo.disconnect();
    };
  }, [doc, hasParts, selectedId]);

  const marks: ReactNode[] = [];
  if (doc && selected && hasParts) {
    for (const p of drawnParts(doc, selected.props.id, selected.type, contract, rootLabel)) {
      const on = sel?.id === selected.props.id && sel.part === p.part;
      const over = !on && hovered === p.part;
      // The whole block is outlined by Puck already; its own mark only when selected or pointed at.
      if (p.part === ROOT_PART && !on && !over) continue;
      p.els.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) return;
        marks.push(
          <div
            key={`${p.part}-${i}`}
            className="eac-part-mark"
            data-eac-part-mark={p.part}
            data-on={on ? "" : undefined}
            data-over={over ? "" : undefined}
            style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
          >
            {on && i === 0 ? (
              <span className="eac-part-mark-label" data-below={r.top < 22 ? "" : undefined}>
                {p.label}
              </span>
            ) : null}
          </div>
        );
      });
    }
  }

  return (
    <>
      {children}
      {doc?.body ? createPortal(<div data-eac-part-layer="">{marks}</div>, doc.body) : null}
    </>
  );
}

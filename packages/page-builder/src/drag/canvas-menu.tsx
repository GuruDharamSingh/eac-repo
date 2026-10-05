"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGetPuck, type ComponentData } from "@puckeditor/core";

// ============================================================================
// Right-click and double-click on the canvas.
//
//   right-click a block    a menu for it: Duplicate, Delete, Move up/down;
//                          Add above / below / inside (for a block with
//                          columns or a box); Select the block it sits in.
//   right-click or         "Add here": a short list of common blocks
//   double-click empty     (Heading, Text, Image, Button), inserted where the
//   space in a column,     pointer is. A heading gets the cursor so it can be
//   box or the page        typed straight away; the others are selected so
//                          their fields open in the panel.
//
// Puck has no menu of its own; everything here is its public actions
// (insert, duplicate, reorder, remove, setUi) and its permissions, so a block
// that may not be deleted or dragged cannot be through the menu either.
//
// Mounted from the `iframe` override (editor.tsx) so it has the canvas
// document; the menu is portalled into the canvas body and styled in
// editor.css (Puck mirrors that sheet into the iframe).
// ============================================================================

const ROOT_ZONE = "root:default-zone";

/** What "Add" offers, in order. Only types the site's catalogue has, and the zone allows, are shown. */
const QUICK_ADD: Array<{ type: string; label: string; typeInto?: boolean }> = [
  { type: "section-heading", label: "Heading", typeInto: true },
  { type: "prose", label: "Text", typeInto: true },
  { type: "figure", label: "Image" },
  { type: "link-button", label: "Button" },
];

type GetPuck = ReturnType<typeof useGetPuck>;

type Menu =
  | { kind: "block"; x: number; y: number; id: string }
  | { kind: "zone"; x: number; y: number; zone: string; index: number };

/** Where an add goes, once chosen from a menu. */
interface Target {
  zone: string;
  index: number;
  title: string;
}

function zoneContent(getPuck: GetPuck, zone: string): ComponentData[] {
  const { appState, getItemById } = getPuck();
  const at = zone.indexOf(":");
  const parentId = zone.slice(0, at);
  const slot = zone.slice(at + 1);
  if (zone === ROOT_ZONE) return (appState.data.content ?? []) as ComponentData[];
  const value = (getItemById(parentId)?.props as Record<string, unknown> | undefined)?.[slot];
  return Array.isArray(value) ? (value as ComponentData[]) : [];
}

/** The quick-add blocks this zone accepts (slot allow/disallow, insert permission). */
function addable(getPuck: GetPuck, zone: string) {
  const { config, getItemById, getPermissions } = getPuck();
  let allow: string[] | undefined;
  let disallow: string[] | undefined;
  if (zone !== ROOT_ZONE) {
    const at = zone.indexOf(":");
    const parent = getItemById(zone.slice(0, at));
    const field = parent
      ? (config.components[parent.type as string]?.fields?.[zone.slice(at + 1)] as
          | { allow?: string[]; disallow?: string[] }
          | undefined)
      : undefined;
    allow = field?.allow;
    disallow = field?.disallow;
  }
  return QUICK_ADD.filter(
    (q) =>
      !!config.components[q.type] &&
      (!allow || allow.includes(q.type)) &&
      !disallow?.includes(q.type) &&
      getPermissions({ type: q.type }).insert !== false
  );
}

function select(getPuck: GetPuck, id: string | null) {
  const { dispatch, getSelectorForId } = getPuck();
  const itemSelector = id ? (getSelectorForId(id) ?? null) : null;
  dispatch({ type: "setUi", recordHistory: false, ui: { itemSelector } });
}

/** The zone element and the component element nearest `target`, whichever is closer. */
function nearest(
  target: EventTarget | null
): { kind: "component"; id: string } | { kind: "zone"; zone: string; el: Element } | null {
  const el = target as Element | null;
  if (typeof el?.closest !== "function") return null;
  if (el.closest("[data-eac-canvas-menu]")) return null;
  const hit = el.closest("[data-puck-dropzone], [data-puck-component]");
  if (!hit) return null;
  return hit.hasAttribute("data-puck-component")
    ? { kind: "component", id: hit.getAttribute("data-puck-component")! }
    : { kind: "zone", zone: hit.getAttribute("data-puck-dropzone")!, el: hit };
}

/** Where in `zoneEl` a drop at height `y` lands: after every block whose middle is above it. */
function indexAt(zoneEl: Element, y: number) {
  let index = 0;
  for (const child of zoneEl.querySelectorAll("[data-puck-component]")) {
    if (child.parentElement?.closest("[data-puck-dropzone]") !== zoneEl) continue;
    const r = child.getBoundingClientRect();
    if (r.top + r.height / 2 < y) index++;
  }
  return index;
}

export function CanvasMenu({ doc }: { doc?: Document }) {
  const getPuck = useGetPuck();
  const [menu, setMenu] = useState<Menu | null>(null);
  const canvas = doc ?? (typeof document === "undefined" ? undefined : document);

  useEffect(() => {
    if (!canvas) return;
    const editing = () => getPuck().appState.ui.previewMode === "edit";

    const onContextMenu = (e: MouseEvent) => {
      if (!editing()) return;
      const hit = nearest(e.target);
      if (!hit) return;
      e.preventDefault();
      if (hit.kind === "component") {
        select(getPuck, hit.id);
        setMenu({ kind: "block", x: e.clientX, y: e.clientY, id: hit.id });
      } else {
        setMenu({ kind: "zone", x: e.clientX, y: e.clientY, zone: hit.zone, index: indexAt(hit.el, e.clientY) });
      }
    };

    // Only EMPTY space: a double-click on a block is left to the block (and
    // to Puck's text editing).
    const onDoubleClick = (e: MouseEvent) => {
      if (!editing()) return;
      const hit = nearest(e.target);
      if (!hit || hit.kind === "component") return;
      e.preventDefault();
      setMenu({ kind: "zone", x: e.clientX, y: e.clientY, zone: hit.zone, index: indexAt(hit.el, e.clientY) });
    };

    canvas.addEventListener("contextmenu", onContextMenu, true);
    canvas.addEventListener("dblclick", onDoubleClick, true);
    return () => {
      canvas.removeEventListener("contextmenu", onContextMenu, true);
      canvas.removeEventListener("dblclick", onDoubleClick, true);
    };
  }, [canvas, getPuck]);

  if (!menu || !canvas) return null;
  return createPortal(<MenuPanel menu={menu} doc={canvas} onClose={() => setMenu(null)} />, canvas.body);
}

function MenuPanel({ menu, doc, onClose }: { menu: Menu; doc: Document; onClose: () => void }) {
  const getPuck = useGetPuck();
  const ref = useRef<HTMLDivElement | null>(null);
  const [adding, setAdding] = useState<Target | null>(
    menu.kind === "zone" ? { zone: menu.zone, index: menu.index, title: "Add here" } : null
  );
  const [at, setAt] = useState({ left: menu.x, top: menu.y });

  // Keep it on screen, and put the keyboard in it.
  useLayoutEffect(() => {
    const el = ref.current;
    const view = doc.defaultView;
    if (!el || !view) return;
    const r = el.getBoundingClientRect();
    setAt({
      left: Math.max(4, Math.min(menu.x, view.innerWidth - r.width - 4)),
      top: Math.max(4, Math.min(menu.y, view.innerHeight - r.height - 4)),
    });
    el.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [doc, menu.x, menu.y, adding]);

  // Close on a press elsewhere (in the canvas or the editor around it), Escape, scroll or leaving the window.
  useEffect(() => {
    const view = doc.defaultView;
    const outside = (e: Event) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    doc.addEventListener("pointerdown", outside, true);
    doc.addEventListener("keydown", key, true);
    doc.addEventListener("scroll", onClose, true);
    view?.addEventListener("blur", onClose);
    window.addEventListener("pointerdown", outside, true);
    window.addEventListener("keydown", key, true);
    return () => {
      doc.removeEventListener("pointerdown", outside, true);
      doc.removeEventListener("keydown", key, true);
      doc.removeEventListener("scroll", onClose, true);
      view?.removeEventListener("blur", onClose);
      window.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("keydown", key, true);
    };
  }, [doc, onClose]);

  /**
   * Run an action and set the selection it should leave behind — after the
   * click has finished, because a click in the canvas outside any block reads
   * to Puck as "select nothing" (see canvas-drag.tsx).
   */
  const run = useCallback(
    (action: () => string | null | undefined, after?: (id: string | null) => void) => {
      const keep = action();
      onClose();
      setTimeout(() => {
        if (keep !== undefined) select(getPuck, keep);
        after?.(keep ?? null);
      }, 0);
    },
    [getPuck, onClose]
  );

  const insert = useCallback(
    (target: Target, q: (typeof QUICK_ADD)[number]) =>
      run(
        () => {
          const id = `${q.type}-${crypto.randomUUID()}`;
          getPuck().dispatch({
            type: "insert",
            componentType: q.type,
            destinationIndex: target.index,
            destinationZone: target.zone,
            id,
            recordHistory: true,
          });
          getPuck().resolveDataById(id, "insert");
          return id;
        },
        (id) => {
          if (!id || !q.typeInto) return;
          // A rich-text body is a TipTap editor (.ProseMirror), editable as
          // soon as it mounts. Puck's plain inline text is only editable while
          // hovered or focused, so it is switched on to take the focus; Puck
          // keeps it on while focused.
          const view = doc.defaultView;
          view?.requestAnimationFrame(() =>
            view.requestAnimationFrame(() => {
              const block = doc.querySelector(`[data-puck-component="${id}"]`);
              const rich = block?.querySelector<HTMLElement>(".ProseMirror");
              if (rich) return rich.focus();
              const span = block?.querySelector<HTMLElement>("[data-puck-overlay-portal]");
              if (!span) return;
              span.contentEditable = "plaintext-only";
              span.focus();
            })
          );
        }
      ),
    [doc, getPuck, run]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
    const i = items.indexOf(doc.activeElement as HTMLButtonElement);
    items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
  };

  let body: React.ReactNode;
  if (adding) {
    const options = addable(getPuck, adding.zone);
    body = (
      <>
        {menu.kind === "block" ? (
          <button type="button" role="menuitem" className="eac-menu-back" onClick={() => setAdding(null)}>
            ‹ Back
          </button>
        ) : null}
        <p className="eac-menu-title">{adding.title}</p>
        {options.length === 0 ? (
          <p className="eac-menu-note">None of the common blocks can go here. Drag one from Blocks instead.</p>
        ) : (
          options.map((q) => (
            <button key={q.type} type="button" role="menuitem" onClick={() => insert(adding, q)}>
              {q.label}
            </button>
          ))
        )}
      </>
    );
  } else if (menu.kind === "block") {
    body = <BlockItems id={menu.id} run={run} onAdd={setAdding} />;
  }

  return (
    <div
      ref={ref}
      data-eac-canvas-menu=""
      className="eac-canvas-menu"
      role="menu"
      style={{ left: at.left, top: at.top }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {body}
    </div>
  );
}

function BlockItems({
  id,
  run,
  onAdd,
}: {
  id: string;
  run: (action: () => string | null | undefined, after?: (id: string | null) => void) => void;
  onAdd: (target: Target) => void;
}) {
  const getPuck = useGetPuck();
  const { config, getItemById, getSelectorForId, getParentById, getPermissions } = getPuck();
  const item = getItemById(id);
  const selector = getSelectorForId(id);
  if (!item || !selector) return <p className="eac-menu-note">This block is no longer on the page.</p>;

  const type = item.type as string;
  const label = config.components[type]?.label ?? type;
  const can = getPermissions({ item });
  const siblings = zoneContent(getPuck, selector.zone).length;
  const parent = getParentById(id);
  const parentLabel = parent ? (config.components[parent.type as string]?.label ?? String(parent.type)) : null;
  const slots = Object.entries(config.components[type]?.fields ?? {}).filter(
    ([, f]) => (f as { type?: string }).type === "slot"
  ) as Array<[string, { label?: string }]>;

  const move = (to: number) =>
    run(() => {
      getPuck().dispatch({
        type: "reorder",
        sourceIndex: selector.index,
        destinationIndex: to,
        destinationZone: selector.zone,
      });
      return id;
    });

  return (
    <>
      <p className="eac-menu-title">{label}</p>
      <button
        type="button"
        role="menuitem"
        disabled={!can.duplicate}
        onClick={() =>
          run(() => {
            getPuck().dispatch({ type: "duplicate", sourceIndex: selector.index, sourceZone: selector.zone });
            // Puck selects the copy itself.
            return undefined;
          })
        }
      >
        Duplicate
      </button>
      <button type="button" role="menuitem" disabled={!can.drag || selector.index === 0} onClick={() => move(selector.index - 1)}>
        Move up
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!can.drag || selector.index >= siblings - 1}
        onClick={() => move(selector.index + 1)}
      >
        Move down
      </button>
      <button
        type="button"
        role="menuitem"
        className="eac-menu-danger"
        disabled={!can.delete}
        onClick={() =>
          run(() => {
            getPuck().dispatch({ type: "remove", index: selector.index, zone: selector.zone });
            return null;
          })
        }
      >
        Delete
      </button>

      <hr />
      <button
        type="button"
        role="menuitem"
        onClick={() => onAdd({ zone: selector.zone, index: selector.index, title: `Add above ${label}` })}
      >
        Add above…
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => onAdd({ zone: selector.zone, index: selector.index + 1, title: `Add below ${label}` })}
      >
        Add below…
      </button>
      {slots.map(([slot, f]) => {
        const zone = `${id}:${slot}`;
        const name = slots.length === 1 ? "inside" : `to ${f.label ?? slot}`;
        return (
          <button
            key={slot}
            type="button"
            role="menuitem"
            onClick={() => onAdd({ zone, index: zoneContent(getPuck, zone).length, title: `Add ${name}` })}
          >
            Add {name}…
          </button>
        );
      })}

      {parent ? (
        <>
          <hr />
          <button type="button" role="menuitem" onClick={() => run(() => parent.props.id as string)}>
            Select {parentLabel}
          </button>
        </>
      ) : null}
    </>
  );
}

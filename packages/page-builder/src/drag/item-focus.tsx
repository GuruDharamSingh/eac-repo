"use client";

import { useCallback, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { AutoField, FieldLabel, createUsePuck, useGetPuck } from "@puckeditor/core";
import { EDIT_ITEM_ATTR, parseEditItem } from "@elkdonis/blocks/edit-item";

// ============================================================================
// Clicking one picture in a many-picture block edits that picture.
//
// Puck selects BLOCKS. A picture wall is one block whose pictures are rows of
// one array field, so a click on the third picture selected the wall and the
// panel showed every field it has, the pictures folded away in a list. This
// adds one level below the block:
//
//   canvas   A block marks the element that draws each row with
//            `editItem(prop, row)` (@elkdonis/blocks edit-item.ts). A click
//            inside a marked element selects the block as before, then opens
//            that row.
//   panel    While a row is open, the fields panel shows only that row's
//            fields, under a bar with "← <block>" (back to all its fields,
//            with the row left unfolded in its list) and ‹ › to step through
//            the rows. A click elsewhere on the block goes back to the block.
//
// Hit-testing is by rectangle, not by event target: Puck sets
// `pointer-events: none` on everything inside a component, so every click on
// the canvas arrives at the component element itself.
//
// Row fields are drawn with Puck's public AutoField, the same controls (and
// the same custom pickers) the list would show. A change is written the way
// Puck's own panel writes one: replace the block, then run its resolver.
//
// A marked prop that is NOT a rows list — the Gallery grid's "Pictures",
// whose pictures live in the gallery rather than the block — is shown alone,
// its control drawn as usual; the control reads `useFocusedItem()` and shows
// just that item (the key is whatever the block wrote, e.g. an item id).
// ============================================================================

const usePuckSelector = createUsePuck();

export interface ItemFocus {
  componentId: string;
  /** The prop the item belongs to. */
  prop: string;
  /** For a rows prop, the index in the stored array; otherwise the block's own key. */
  key: string;
}

// One editor per page, so one focus. Module state rather than Puck's `ui`:
// Puck's UiState is a closed type and it records ui in undo history.
let focus: ItemFocus | null = null;
const listeners = new Set<() => void>();

function setFocus(next: ItemFocus | null) {
  if (
    next === focus ||
    (next && focus && next.componentId === focus.componentId && next.prop === focus.prop && next.key === focus.key)
  ) {
    return;
  }
  focus = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The item currently open in the panel, if any. */
export function useItemFocus(): ItemFocus | null {
  return useSyncExternalStore(subscribe, () => focus, () => null);
}

/**
 * For a block's own control (a custom field) that lists items: the item open
 * in the panel, if it is in the selected block, with a way to step to
 * another of its items or go back to the whole block.
 */
export function useFocusedItem(): { key: string; open: (key: string) => void; close: () => void } | null {
  const current = useItemFocus();
  const getPuck = useGetPuck();
  const selectedId = usePuckSelector((s) => s.selectedItem?.props?.id as string | undefined);
  if (!current || current.componentId !== selectedId) return null;
  return {
    key: current.key,
    open: (key: string) => openItem(getPuck, current.componentId, current.prop, key),
    close: () => setFocus(null),
  };
}

type GetPuck = ReturnType<typeof useGetPuck>;
type ArrayFieldLike = {
  type: "array";
  label?: string;
  arrayFields: Record<string, { type: string; label?: string }>;
  getItemSummary?: (item: Record<string, unknown>, index?: number) => string;
};

function fieldOf(getPuck: GetPuck, componentId: string, prop: string) {
  const { config, getItemById } = getPuck();
  const item = getItemById(componentId);
  if (!item) return null;
  const field = config.components[item.type as string]?.fields?.[prop] as { type: string } | undefined;
  return field ? { item, field, value: (item.props as Record<string, unknown>)[prop] } : null;
}

/**
 * Select the block and open item `key` of `prop`. For a rows prop that is
 * row `key` — opened in our panel and in Puck's own list (its
 * `ui.arrayState`), so "back" lands on the same row.
 */
function openItem(getPuck: GetPuck, componentId: string, prop: string, key: string) {
  const found = fieldOf(getPuck, componentId, prop);
  if (!found) return;
  const { appState, dispatch, getSelectorForId } = getPuck();
  const selector = getSelectorForId(componentId);
  if (!selector) return;
  if (found.field.type !== "array") {
    dispatch({ type: "setUi", recordHistory: false, ui: { itemSelector: selector } });
    setFocus({ componentId, prop, key });
    return;
  }
  const index = Number(key);
  const rows = Array.isArray(found.value) ? found.value : [];
  if (!Number.isInteger(index) || index < 0 || index >= rows.length) return;
  // Puck keys a list's state by `<component id>_<field type>_<field name>`
  // and names a row `<that key>-<n>` until the list is reordered, after which
  // it keeps its own ids — so use its ids when it has them for every row.
  const listKey = `${componentId}_array_${prop}`;
  const existing = appState.ui.arrayState[listKey];
  const items =
    existing?.items?.length === rows.length
      ? existing.items
      : rows.map((_, i) => ({ _originalIndex: i, _currentIndex: i, _arrayId: `${listKey}-${i}` }));
  dispatch({
    type: "setUi",
    recordHistory: false,
    ui: {
      itemSelector: selector,
      arrayState: { ...appState.ui.arrayState, [listKey]: { items, openId: items[index]!._arrayId } },
    },
  });
  setFocus({ componentId, prop, key: String(index) });
}

/** The smallest marked element of `component` (not of a block nested in it) under the point. */
function rowAt(component: Element, x: number, y: number) {
  let best: Element | null = null;
  let bestArea = Infinity;
  for (const el of component.querySelectorAll(`[${EDIT_ITEM_ATTR}]`)) {
    if (el.closest("[data-puck-component]") !== component) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
    const area = r.width * r.height;
    if (area < bestArea) {
      best = el;
      bestArea = area;
    }
  }
  return best ? { el: best, ...parseEditItem(best.getAttribute(EDIT_ITEM_ATTR))! } : null;
}

/**
 * Mounted as Puck's `iframe` override, so it has the canvas document: listens
 * for clicks on marked rows, and outlines the open row (and, in the selected
 * block, the row under the pointer).
 */
export function ItemPicker({ children, doc }: { children: ReactNode; doc?: Document }) {
  const getPuck = useGetPuck();
  const selectedId = usePuckSelector((s) => s.selectedItem?.props?.id as string | undefined);

  // Selecting another block, or nothing, closes the row.
  useEffect(() => {
    if (focus && focus.componentId !== selectedId) setFocus(null);
  }, [selectedId]);

  useEffect(() => {
    const canvas = doc ?? (typeof document === "undefined" ? undefined : document);
    if (!canvas) return;

    const onClick = (e: MouseEvent) => {
      if (getPuck().appState.ui.previewMode !== "edit") return;
      const target = e.target as Element | null;
      const component = typeof target?.closest === "function" ? target.closest("[data-puck-component]") : null;
      if (!component) return;
      const componentId = component.getAttribute("data-puck-component");
      if (!componentId) return;
      const hit = rowAt(component, e.clientX, e.clientY);
      // After Puck's own click handler (on the component, bubbling) has
      // selected the block; this only adds the row.
      setTimeout(() => {
        if (hit) openItem(getPuck, componentId, hit.prop, hit.key);
        else if (focus?.componentId === componentId) setFocus(null);
      }, 0);
    };

    // The pointer's row, outlined only inside the selected block: elsewhere
    // Puck's own hover outline already says what a click would select.
    let hovered: string | null = null;
    let frame = 0;
    const style = canvas.createElement("style");
    style.setAttribute("data-eac-item-focus", "");
    canvas.head?.appendChild(style);
    const esc = (s: string) => (canvas.defaultView?.CSS?.escape ?? ((v: string) => v.replace(/["\\]/g, "\\$&")))(s);
    const rule = (componentId: string, value: string, css: string) =>
      `[data-puck-component="${esc(componentId)}"] [${EDIT_ITEM_ATTR}="${esc(value)}"] { ${css} }`;
    const paint = () => {
      const rules: string[] = [];
      if (focus) {
        rules.push(
          rule(
            focus.componentId,
            `${focus.prop}:${focus.key}`,
            "outline: 3px solid var(--puck-color-azure-04, #0158ad) !important; outline-offset: -3px;"
          )
        );
      }
      if (hovered) rules.push(hovered);
      style.textContent = rules.join("\n");
    };
    paint();
    const unsubscribe = subscribe(paint);

    const onMove = (e: MouseEvent) => {
      if (frame) return;
      const x = e.clientX;
      const y = e.clientY;
      const target = e.target as Element | null;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const component = typeof target?.closest === "function" ? target.closest("[data-puck-component]") : null;
        const id = component?.getAttribute("data-puck-component");
        const selected = getPuck().selectedItem?.props?.id;
        const hit = component && id && id === selected ? rowAt(component, x, y) : null;
        const next = hit
          ? rule(id!, `${hit.prop}:${hit.key}`, "outline: 2px dashed var(--puck-color-azure-06, #6499cf); outline-offset: -2px;")
          : null;
        if (next !== hovered) {
          hovered = next;
          paint();
        }
      });
    };

    canvas.addEventListener("click", onClick, true);
    canvas.addEventListener("mousemove", onMove, true);
    return () => {
      canvas.removeEventListener("click", onClick, true);
      canvas.removeEventListener("mousemove", onMove, true);
      if (frame) cancelAnimationFrame(frame);
      unsubscribe();
      style.remove();
    };
  }, [doc, getPuck]);

  return <>{children}</>;
}

/**
 * Mounted as Puck's `fields` override: the open item's fields in place of the
 * block's, or Puck's own panel when nothing is open.
 */
export function FocusedFields({ children }: { children: ReactNode }) {
  const current = useItemFocus();
  const selected = usePuckSelector((s) => s.selectedItem);
  const config = usePuckSelector((s) => s.config);

  const id = selected?.props?.id as string | undefined;
  const mine = !!current && !!selected && id === current.componentId;
  const field = mine
    ? (config.components[selected!.type as string]?.fields?.[current!.prop] as
        | ArrayFieldLike
        | { type: string; label?: string }
        | undefined)
    : undefined;
  const value = mine ? (selected!.props as Record<string, unknown>)[current!.prop] : undefined;
  const index = Number(current?.key);
  const isRows = field?.type === "array";
  const valid =
    mine &&
    !!field &&
    (isRows ? Array.isArray(value) && Number.isInteger(index) && index >= 0 && index < value.length : field.type === "custom");

  // The row was removed (undo, or deleted from the list): back to the block.
  useEffect(() => {
    if (mine && !valid) setFocus(null);
  }, [mine, valid]);

  if (!valid || !current || !selected || !field) return <>{children}</>;
  const blockLabel = config.components[selected.type as string]?.label ?? String(selected.type);
  const readOnly = !!(selected.readOnly as Record<string, boolean> | undefined)?.[current.prop];
  if (!isRows) {
    return (
      <PropPanel
        componentId={current.componentId}
        prop={current.prop}
        value={value}
        field={field}
        blockLabel={blockLabel}
        readOnly={readOnly}
      />
    );
  }
  return (
    <RowPanel
      componentId={current.componentId}
      prop={current.prop}
      index={index}
      rows={value as Record<string, unknown>[]}
      field={field as ArrayFieldLike}
      blockLabel={blockLabel}
      readOnly={readOnly}
    />
  );
}

/** Replace one prop of a block the way Puck's own panel does, then re-resolve it. */
function writeProp(getPuck: GetPuck, componentId: string, update: (props: Record<string, unknown>) => Record<string, unknown> | null) {
  const { dispatch, getItemById, getSelectorForId, resolveDataById } = getPuck();
  const item = getItemById(componentId);
  const selector = getSelectorForId(componentId);
  if (!item || !selector) return;
  const props = item.props as Record<string, unknown> & { id: string };
  const patch = update(props);
  if (!patch) return;
  dispatch({
    type: "replace",
    destinationIndex: selector.index,
    destinationZone: selector.zone,
    data: { ...item, props: { ...props, ...patch } },
  });
  // Bound values (an artwork) are filled by the block's resolver.
  resolveDataById(componentId, "replace");
}

function BackButton({ blockLabel }: { blockLabel: string }) {
  return (
    <button type="button" className="eac-row-focus-back" onClick={() => setFocus(null)} title="Show all of this block's fields">
      ← {blockLabel}
    </button>
  );
}

/** One non-rows prop alone; its control shows only the open item (useFocusedItem). */
function PropPanel({
  componentId,
  prop,
  value,
  field,
  blockLabel,
  readOnly,
}: {
  componentId: string;
  prop: string;
  value: unknown;
  field: { type: string; label?: string };
  blockLabel: string;
  readOnly: boolean;
}) {
  const getPuck = useGetPuck();
  const change = useCallback(
    (next: unknown) => writeProp(getPuck, componentId, () => ({ [prop]: next })),
    [getPuck, componentId, prop]
  );
  return (
    <div className="eac-row-focus">
      <div className="eac-row-focus-bar">
        <BackButton blockLabel={blockLabel} />
      </div>
      <div className="eac-row-focus-field">
        <AutoField field={field as never} value={value} onChange={change} readOnly={readOnly} />
      </div>
    </div>
  );
}

function RowPanel({
  componentId,
  prop,
  index,
  rows,
  field,
  blockLabel,
  readOnly,
}: {
  componentId: string;
  prop: string;
  index: number;
  rows: Record<string, unknown>[];
  field: ArrayFieldLike;
  blockLabel: string;
  readOnly: boolean;
}) {
  const getPuck = useGetPuck();
  const row = rows[index] ?? {};
  const noun = field.label || "Item";
  const summary = field.getItemSummary?.(row, index) || `${noun} ${index + 1}`;

  const change = useCallback(
    (column: string, value: unknown) =>
      writeProp(getPuck, componentId, (props) => {
        const list = Array.isArray(props[prop]) ? [...(props[prop] as Record<string, unknown>[])] : [];
        if (index >= list.length) return null;
        list[index] = { ...list[index], [column]: value };
        return { [prop]: list };
      }),
    [getPuck, componentId, prop, index]
  );

  return (
    <div className="eac-row-focus">
      <div className="eac-row-focus-bar">
        <BackButton blockLabel={blockLabel} />
        <span className="eac-row-focus-step">
          <button
            type="button"
            aria-label={`Previous ${noun.toLowerCase()}`}
            disabled={index === 0}
            onClick={() => openItem(getPuck, componentId, prop, String(index - 1))}
          >
            ‹
          </button>
          <span>
            {noun} {index + 1} of {rows.length}
          </span>
          <button
            type="button"
            aria-label={`Next ${noun.toLowerCase()}`}
            disabled={index >= rows.length - 1}
            onClick={() => openItem(getPuck, componentId, prop, String(index + 1))}
          >
            ›
          </button>
        </span>
      </div>
      <p className="eac-row-focus-title">{summary}</p>
      {Object.entries(field.arrayFields).map(([column, sub]) => {
        const control = (
          <AutoField
            field={sub as never}
            value={row[column]}
            onChange={(value: unknown) => change(column, value)}
            readOnly={readOnly}
          />
        );
        return (
          // Keyed by row, so stepping to the next row remounts the controls
          // rather than carrying one row's half-typed state into another.
          <div className="eac-row-focus-field" key={`${componentId}:${prop}:${index}:${column}`}>
            {/* A custom control draws its own label; Puck's public AutoField
                draws none for the built-in ones. */}
            {sub.type === "custom" ? control : <FieldLabel label={sub.label ?? column}>{control}</FieldLabel>}
          </div>
        );
      })}
    </div>
  );
}

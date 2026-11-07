"use client";

// ============================================================================
// Experiment (2026-11-06): direct-edit's "click into a block" as a plugin for
// Puck's own editor, instead of a second editor beside it.
//
// Puck keeps selection of blocks, history, drag and drop, viewports and save.
// This plugin adds one thing Puck has no idea of: a selected PART inside the
// selected block (a block's contract names its parts as selectors over markup
// it already draws). The part's look is written into `props.morph` with Puck's
// own `replace` action, so it lands in Puck's history and the stored shape is
// the one direct-edit writes (setPartLook) and the published page draws
// (MorphMark).
//
// Hooks used, all public: overrides.iframe (clicks and outlines inside the
// canvas), overrides.fields (the part panel), useGetPuck / createUsePuck.
// Nothing patches Puck internals.
// ============================================================================

import { createElement as h, Fragment, useEffect, useReducer, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createUsePuck, useGetPuck, type Plugin } from "@puckeditor/core";
import { partLookOf, setPartLook } from "../../src/block/morph";
import { contractFor, GENERIC_ROOT_SEL, ROOT_PART, type EditorContract } from "../../src/block/contract";
import type { PartStyle } from "../../src/block/style";

// ── The selected part: outside Puck's store, like page-builder's item focus ──

export type PartSel = { id: string; part: string } | null;
let current: PartSel = null;
const subs = new Set<() => void>();
export function setPart(next: PartSel) {
  if (next?.id === current?.id && next?.part === current?.part) return;
  current = next;
  subs.forEach((f) => f());
}
export const partSel = () => current;
const subscribe = (f: () => void) => (subs.add(f), () => void subs.delete(f));
const usePart = () => useSyncExternalStore(subscribe, () => current, () => null);
const usePuck = createUsePuck();

// ── Finding parts in the canvas ─────────────────────────────────────────────

const NOT_A_BOX = new Set(["STYLE", "SCRIPT", "LINK", "TEMPLATE"]);
const wrapperOf = (doc: Document, id: string) => doc.querySelector<HTMLElement>(`[data-puck-component="${CSS.escape(id)}"]`);
/** An element belongs to this block, not to a block nested in one of its slots. */
const ownedBy = (el: Element, wrapper: Element) => el.closest("[data-puck-component]") === wrapper;

function firstBox(el: Element): HTMLElement | null {
  let k = Array.from(el.children).find((c) => !NOT_A_BOX.has(c.tagName)) as HTMLElement | undefined;
  while (k && getComputedStyle(k).display === "contents") {
    const next = Array.from(k.children).find((c) => !NOT_A_BOX.has(c.tagName)) as HTMLElement | undefined;
    if (!next) break;
    k = next;
  }
  return k ?? null;
}

/** The block's root element: the declared root selector's first match, or its first drawn box. */
function rootOf(wrapper: HTMLElement, rootSel: string | undefined): HTMLElement | null {
  const tail = (rootSel ?? GENERIC_ROOT_SEL).replace(/^>\s*/, "");
  if (rootSel) {
    const hit = Array.from(wrapper.querySelectorAll<HTMLElement>(tail)).find((e) => ownedBy(e, wrapper));
    if (hit) return hit;
  }
  return firstBox(wrapper);
}

/** Each declared part's elements in this block, by the same grammar morphCss compiles. */
export function partElements(doc: Document, id: string, type: string, contract: EditorContract): Array<{ part: string; label: string; els: HTMLElement[] }> {
  const wrapper = wrapperOf(doc, id);
  const parts = contractFor(contract, type)?.parts ?? {};
  if (!wrapper) return [];
  const root = rootOf(wrapper, parts[ROOT_PART]?.sel);
  if (!root) return [];
  const out: Array<{ part: string; label: string; els: HTMLElement[] }> = [{ part: ROOT_PART, label: parts[ROOT_PART]?.label ?? "Whole block", els: [root] }];
  for (const [name, p] of Object.entries(parts)) {
    if (name === ROOT_PART) continue;
    let els: HTMLElement[] = [];
    try {
      els = p.sel.startsWith(">")
        ? Array.from(root.parentElement!.querySelectorAll<HTMLElement>(`:scope ${p.sel}`)).filter((e) => e === root || root.contains(e))
        : Array.from(root.querySelectorAll<HTMLElement>(p.sel));
    } catch { /* a selector this browser refuses selects nothing */ }
    els = els.filter((e) => ownedBy(e, wrapper));
    if (els.length) out.push({ part: name, label: p.label, els });
  }
  return out;
}

const inRect = (r: DOMRect, x: number, y: number) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

// ── Canvas side: second click inside the selected block picks a part ───────

function PartPicker({ doc, contract, children }: { doc?: Document; contract: EditorContract; children: ReactNode }) {
  const getPuck = useGetPuck();
  const selected = usePuck((s) => s.selectedItem) as { type: string; props: { id: string } } | null;
  const sel = usePart();
  const [, tick] = useReducer((n: number) => n + 1, 0);

  // Clicks: capture phase, before Puck's own handler on the block's wrapper.
  useEffect(() => {
    if (!doc) return;
    const onClick = (e: MouseEvent) => {
      const item = getPuck().selectedItem as { type: string; props: { id: string } } | null;
      const target = (e.target as Element | null)?.closest?.("[data-puck-component]");
      if (!item || !target || target.getAttribute("data-puck-component") !== item.props.id) {
        setPart(null); // another block: Puck selects it, the part goes
        return;
      }
      const hits = partElements(doc, item.props.id, item.type, contract)
        .flatMap((p) => p.els.map((el) => ({ part: p.part, r: el.getBoundingClientRect() })))
        .filter((x) => inRect(x.r, e.clientX, e.clientY))
        .sort((a, b) => a.r.width * a.r.height - b.r.width * b.r.height);
      if (hits.length) setPart({ id: item.props.id, part: hits[0]!.part });
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPart(null); };
    doc.addEventListener("click", onClick, true);
    doc.addEventListener("keydown", onKey);
    return () => { doc.removeEventListener("click", onClick, true); doc.removeEventListener("keydown", onKey); };
  }, [doc, contract, getPuck]);

  // A part belongs to one block: selecting another block clears it.
  useEffect(() => { if (sel && selected?.props.id !== sel.id) setPart(null); }, [selected, sel]);

  // Outlines follow the page: redraw on scroll, resize and edits.
  useEffect(() => {
    if (!doc || !selected) return;
    const win = doc.defaultView!;
    win.addEventListener("scroll", tick, true);
    win.addEventListener("resize", tick);
    const mo = new win.MutationObserver(tick);
    mo.observe(doc.body, { subtree: true, childList: true, attributes: true, characterData: true });
    return () => { win.removeEventListener("scroll", tick, true); win.removeEventListener("resize", tick); mo.disconnect(); };
  }, [doc, selected]);

  const marks: ReactNode[] = [];
  if (doc && selected && contractFor(contract, selected.type)?.parts) {
    for (const p of partElements(doc, selected.props.id, selected.type, contract)) {
      p.els.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const on = sel?.part === p.part;
        marks.push(h("div", {
          key: `${p.part}-${i}`, "data-fk-mark": p.part, "data-fk-on": on ? "" : undefined,
          style: { position: "fixed", left: r.left, top: r.top, width: r.width, height: r.height, pointerEvents: "none", zIndex: 2147483000,
            outline: on ? "2px solid #2f6fed" : "1px dashed rgba(47,111,237,.55)", outlineOffset: on ? 0 : -1 },
        }, on && i === 0 ? h("span", { style: { position: "absolute", top: -18, left: 0, font: "11px/16px system-ui", background: "#2f6fed", color: "#fff", padding: "0 5px", borderRadius: 3 } }, p.label) : null));
      });
    }
  }
  return h(Fragment, null, children, doc ? createPortal(h("div", { "data-fk-layer": "" }, marks), doc.body) : null);
}

// ── Panel side: the selected part's look, written as Puck data ──────────────

type Ctl = { key: keyof PartStyle; label: string; kind: "color" | "number" | "select" | "bool"; options?: string[]; min?: number; max?: number };
const CONTROLS: Ctl[] = [
  { key: "fill", label: "Fill", kind: "color" },
  { key: "color", label: "Text colour", kind: "color" },
  { key: "size", label: "Text size", kind: "number", min: 6, max: 240 },
  { key: "weight", label: "Weight", kind: "select", options: ["", "300", "400", "500", "600", "700", "800"] },
  { key: "padding", label: "Space inside", kind: "number", min: 0, max: 320 },
  { key: "radius", label: "Corners", kind: "number", min: 0, max: 200 },
  { key: "hide", label: "Hide", kind: "bool" },
];

function PartPanel({ contract, children }: { contract: EditorContract; children: ReactNode }) {
  const getPuck = useGetPuck();
  const selected = usePuck((s) => s.selectedItem) as { type: string; props: Record<string, unknown> & { id: string } } | null;
  const sel = usePart();
  if (!selected || !sel || sel.id !== selected.props.id) return h(Fragment, null, children);

  const parts = contractFor(contract, selected.type)?.parts ?? {};
  const label = sel.part === ROOT_PART ? parts[ROOT_PART]?.label ?? "Whole block" : parts[sel.part]?.label ?? sel.part;
  const look = partLookOf(selected.props, sel.part);

  const write = (next: PartStyle) => {
    const { dispatch, getSelectorForId, getItemById } = getPuck();
    const item = getItemById(sel.id);
    const where = getSelectorForId(sel.id);
    if (!item || !where) return;
    const props = { ...(item.props as Record<string, unknown>) };
    setPartLook(props, sel.part, next);
    dispatch({ type: "replace", destinationIndex: where.index, destinationZone: where.zone!, data: { ...item, props } as never });
  };
  const change = (key: keyof PartStyle, raw: string | boolean) => {
    const next: Record<string, unknown> = { ...look };
    const ctl = CONTROLS.find((c) => c.key === key)!;
    const value = ctl.kind === "number" || (ctl.kind === "select" && key === "weight") ? (raw === "" ? undefined : Number(raw)) : raw === "" || raw === false ? undefined : raw;
    if (value === undefined || Number.isNaN(value)) delete next[key]; else next[key] = value;
    write(next as PartStyle);
  };

  return h("div", { className: "fk-part-panel", style: { padding: 16, font: "13px/1.4 system-ui" } },
    h("button", { type: "button", "data-fk-back": "", onClick: () => setPart(null), style: { marginBottom: 10 } }, "← Block settings"),
    h("div", { style: { fontWeight: 600, marginBottom: 2 } }, label),
    h("div", { style: { color: "#666", marginBottom: 12 } }, `Part of ${(getPuck().config.components[selected.type] as { label?: string })?.label ?? selected.type}, this page only`),
    h("div", { style: { display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 } },
      Object.entries(parts).map(([name, p]) => h("button", { key: name, type: "button", "data-fk-part": name, onClick: () => setPart({ id: sel.id, part: name }),
        style: { fontWeight: name === sel.part ? 700 : 400 } }, p.label))),
    CONTROLS.map((c) => h("label", { key: c.key, style: { display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: 8, marginBottom: 6 } },
      h("span", null, c.label),
      c.kind === "bool"
        ? h("input", { type: "checkbox", "data-fk-ctl": c.key, checked: !!look[c.key], onChange: (e: { target: HTMLInputElement }) => change(c.key, e.target.checked) })
        : c.kind === "select"
          ? h("select", { "data-fk-ctl": c.key, value: String(look[c.key] ?? ""), onChange: (e: { target: HTMLSelectElement }) => change(c.key, e.target.value) },
              c.options!.map((o) => h("option", { key: o, value: o }, o || "As designed")))
          : h("input", { "data-fk-ctl": c.key, type: c.kind === "color" ? "text" : "number", min: c.min, max: c.max, placeholder: c.kind === "color" ? "#rrggbb" : "",
              // Keyed by the stored value so undo redraws the field.
              key: `${c.key}:${String(look[c.key] ?? "")}`, defaultValue: String(look[c.key] ?? ""),
              onChange: (e: { target: HTMLInputElement }) => { if (c.kind === "number") change(c.key, e.target.value); },
              onBlur: (e: { target: HTMLInputElement }) => { if (c.kind === "color") change(c.key, e.target.value.trim()); },
              onKeyDown: (e: { key: string; target: EventTarget }) => { if (e.key === "Enter" && c.kind === "color") change(c.key, (e.target as HTMLInputElement).value.trim()); } }))),
    h("button", { type: "button", "data-fk-reset": "", onClick: () => write({}) }, "Reset this part"));
}

// ── The plugin ──────────────────────────────────────────────────────────────

export function partsPlugin(contract: EditorContract): Plugin {
  return {
    name: "parts",
    overrides: {
      iframe: ({ children, document }: { children: ReactNode; document?: Document }) => h(PartPicker, { doc: document, contract }, children),
      fields: ({ children }: { children: ReactNode }) => h(PartPanel, { contract }, children),
    },
  } as Plugin;
}

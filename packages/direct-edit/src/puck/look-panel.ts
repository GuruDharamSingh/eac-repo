// ============================================================================
// The canvas's right-hand panel for a part of a block, inside Puck's editor
// (2026-11-06). page-builder's parts plugin mounts it in Puck's right column
// (its `panel` option) and hands it the selection and two ways to write; this
// file never imports @puckeditor/core, and page-builder never imports this
// package: the host passes `mountLookPanel` to `partsPlugin`.
//
// Everything shown is the canvas's own code: `Panel` (panel/panel.ts), the
// fields a box gets from its parent and itself (canvas/box-panel.ts), and the
// Code tab's helpers (canvas/tree-editor.ts). It is the part panel of the tree
// editor (`partContext` there) with Puck in place of the tree editor's
// document: the block's layer tree (block > parts) at the top, Properties,
// Tweaks when the block declares tokens, and the Code tab for developers only.
// ============================================================================

import { loadFont } from "@elkdonis/fonts";
import { Panel, type LayerRow, type PanelContext } from "../panel/panel";
import { applyKey, backgroundOf, boxSlots, inheritedFrom, readBox, resetKey, rgbHex, styleOverridden, styleValues, usedColoursIn } from "../canvas/box-panel";
import { codeText, dropCss, FONT_GROUPS, firstFamily, kindOfRole, quoted, setCodeText, settleCss, srgbHex } from "../canvas/tree-editor";
import { layerRole } from "../canvas/layers";
import { partKind } from "../canvas/parts";
import { partLookOf, partSafeDecls, setPartLook, setToken, tokenOf } from "../block/morph";
import { ROOT_PART, tokenKey, tokenNameOf, tokenSlotId } from "../block/contract";
import type { PartStyle } from "../block/style";

type Props = Record<string, unknown>;

/** What page-builder's parts plugin passes (`PartPanelContext` there). Structural: neither package imports the other. */
export interface LookPanelContext {
  id: string;
  type: string;
  part: string;
  block: { label?: string; tokens?: readonly { name: string; label: string; type: "color" | "font" | "length" }[] };
  blockLabel: string;
  props: Props;
  parts: Array<{ part: string; label: string; els: HTMLElement[] }>;
  developer: boolean;
  live(edit: (props: Props) => void): void;
  commit(edit: (props: Props) => void): void;
  endSpell(): void;
  revert(): boolean;
  select(part: string | null): void;
  hover(part: string | null): void;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v ?? {}));

/** Which part each part element is; the root's element is the block. Two parts on one element: the first declared wins. */
function ownersOf(ctx: LookPanelContext): Map<HTMLElement, string> {
  const root = ctx.parts.find((p) => p.part === ROOT_PART)?.els[0];
  const out = new Map<HTMLElement, string>();
  for (const p of ctx.parts) if (p.part !== ROOT_PART) for (const el of p.els) if (el !== root && !out.has(el)) out.set(el, p.part);
  return out;
}

/** The block, then its parts nested as the page draws them. A repeated part is one row. */
function layerRows(ctx: LookPanelContext): LayerRow[] {
  const owners = ownersOf(ctx);
  const root = ctx.parts.find((p) => p.part === ROOT_PART);
  const around = (el: HTMLElement): string => {
    for (let e = el.parentElement; e && e !== root?.els[0]; e = e.parentElement) {
      const hit = owners.get(e);
      if (hit) return hit;
    }
    return ROOT_PART;
  };
  const under = new Map<string, Array<{ part: string; label: string; els: HTMLElement[] }>>();
  for (const p of ctx.parts) {
    if (p.part === ROOT_PART || !p.els[0]) continue;
    const key = around(p.els[0]);
    under.set(key, [...(under.get(key) ?? []), p]);
  }
  const rootLook = partLookOf(ctx.props, ROOT_PART);
  const out: LayerRow[] = [{
    ref: ROOT_PART, kind: "frame", name: ctx.blockLabel, depth: 0, open: true,
    selected: ctx.part === ROOT_PART, canHide: true, hidden: !!rootLook.hide,
  }];
  const emit = (key: string, depth: number) => {
    const kids = (under.get(key) ?? []).sort((a, b) => (a.els[0]!.compareDocumentPosition(b.els[0]!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    for (const p of kids) {
      const el = p.els[0]!;
      out.push({
        ref: p.part, parent: key, depth, kind: partKind(el), name: p.label,
        note: p.els.length > 1 ? `×${p.els.length}` : undefined,
        text: p.els.length > 1 ? undefined : quoted(el),
        selected: ctx.part === p.part, canHide: true, hidden: !!partLookOf(ctx.props, p.part).hide, open: true,
      });
      emit(p.part, depth + 1);
    }
  };
  emit(ROOT_PART, 1);
  return out;
}

/** The panel's view of the selection. */
function contextOf(ctx: LookPanelContext, probeHost: HTMLElement): PanelContext | null {
  const drawn = ctx.parts.find((p) => p.part === ctx.part);
  const el = drawn?.els[0];
  if (!drawn || !el) return null;
  const look = partLookOf(ctx.props, ctx.part);
  const computed = readBox(el);
  const tokens = ctx.block.tokens ?? [];
  const groups = new Map<Element, { kind: string; tag: string; rows: Array<{ prop: string; value: string }> }>();
  if (ctx.developer) {
    for (const r of inheritedFrom(el)) {
      if (r.source === el.ownerDocument.body || r.source === el.ownerDocument.documentElement) continue;
      if (!groups.has(r.source)) groups.set(r.source, { kind: kindOfRole(layerRole(r.source), "frame"), tag: r.source.tagName.toLowerCase(), rows: [] });
      groups.get(r.source)!.rows.push({ prop: r.prop, value: rgbHex(r.value) ?? r.value });
    }
  }
  const count = drawn.els.length;
  const words = partKind(el) === "text";
  return {
    tabs: ["props", ...(ctx.developer ? (["code"] as const) : []), ...(tokens.length ? (["tweaks"] as const) : [])],
    layersOnCode: true,
    key: `${ctx.id}~p:${ctx.part}`,
    heading: drawn.label,
    sub: ctx.part === ROOT_PART ? "The whole block, this page only" : `Part of ${ctx.blockLabel}, this page only`,
    stickHead: true,
    freedom: 2,
    slots: boxSlots(el, look).map((s) =>
      // Puck wraps inline-editable words in a span of its own, so boxSlots reads a title as a box holding a box and puts
      // its Text fields behind "+". A part that reads as words (partKind) gets them open, as on the canvas.
      s.section === "text" && s.optional && words && s.key !== "case" && s.key !== "italic" ? { ...s, optional: false } : s
    ),
    values: styleValues(look),
    overridden: styleOverridden(look),
    outside: [],
    theme: [],
    used: usedColoursIn(el.ownerDocument.body),
    computed,
    fonts: FONT_GROUPS,
    contrast: { fg: (look.color ?? computed.color) as string | undefined, bg: backgroundOf(el), size: computed.size as number, weight: computed.weight as number },
    layers: layerRows(ctx),
    tweaks: tokens.length ? tweaksOf(ctx, probeHost) : undefined,
    notice: count > 1 ? `All ${count} change together.` : undefined,
    code: ctx.developer
      ? { written: [], css: codeText(look), editable: true, sanitize: partSafeDecls, sheet: { tag: el.tagName.toLowerCase(), hint: quoted(el), from: [...groups.values()] } }
      : undefined,
  };
}

/** "This block" in Tweaks: each token as stored, else what the page gives it now (tree-editor's `tweaksOf`). */
function tweaksOf(ctx: LookPanelContext, probeHost: HTMLElement): PanelContext["tweaks"] {
  const at = ctx.parts.find((p) => p.part === ROOT_PART)?.els[0];
  const page = at ? at.ownerDocument.defaultView?.getComputedStyle(at) : null;
  const probe = probeHost.appendChild(document.createElement("div"));
  const read = (prop: "color" | "width", raw: string) => { probe.style[prop] = ""; probe.style[prop] = raw; return getComputedStyle(probe)[prop]; };
  const slots: PanelContext["slots"] = [], values: Record<string, unknown> = {}, overridden: Record<string, boolean> = {};
  for (const t of ctx.block.tokens ?? []) {
    const key = tokenKey(t.name), stored = tokenOf(ctx.props, t.name);
    const raw = stored ?? page?.getPropertyValue(t.name).trim() ?? "";
    overridden[key] = stored !== undefined;
    if (t.type === "color") {
      slots.push({ key, id: tokenSlotId(t.name), section: "appearance", label: t.label, control: "color", allowed: {} });
      const c = raw ? read("color", raw) : "";
      values[key] = rgbHex(c) ?? srgbHex(c);
    } else if (t.type === "font") {
      slots.push({ key, id: tokenSlotId(t.name), section: "text", label: t.label, control: "font", allowed: {} });
      values[key] = firstFamily(raw) || undefined;
    } else {
      slots.push({ key, id: tokenSlotId(t.name), section: "appearance", label: t.label, control: "number", allowed: {}, unit: "px", bounds: [0, 999] });
      const n = raw ? parseFloat(read("width", raw)) : NaN;
      values[key] = Number.isFinite(n) ? Math.round(n * 100) / 100 : undefined;
    }
  }
  probe.remove();
  return { title: "This block", slots, values, overridden, fonts: FONT_GROUPS };
}

/**
 * Mount the panel into `host` (an element of Puck's right column). The returned
 * `render` is called by the plugin after every change of the selection or the
 * block's props; it redraws softly while a field has focus (panel.ts).
 */
/**
 * The tab open for each block part (`id~p:part`), across mounts. Puck remounts
 * the fields column, and with it this panel, when a block's props change (a
 * Tweaks token is a prop change), so a panel's own tab state alone fell back to
 * Properties after every token (found 2026-11-06, katie-the-potter).
 */
const openTab = new Map<string, string>();
const shownTab = (host: HTMLElement) => host.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.dataset.tab;

export function mountLookPanel(host: HTMLElement): { render(ctx: LookPanelContext): void; destroy(): void } {
  let ctx: LookPanelContext | null = null;
  const elOf = (part: string) => ctx?.parts.find((p) => p.part === part)?.els[0];
  /** Write one part's look: while typing (live) or as a finished step. */
  const writeLook = (part: string, live: boolean, fn: (s: PartStyle, el: HTMLElement) => void) => {
    const el = elOf(part);
    if (!ctx || !el) return;
    (live ? ctx.live : ctx.commit)((props) => {
      const s = clone(partLookOf(props, part)) as PartStyle;
      fn(s, el);
      setPartLook(props, part, s);
    });
  };
  const changeToken = (name: string, value: unknown, live: boolean) => {
    const t = ctx?.block.tokens?.find((x) => x.name === name);
    if (!ctx || !t) return;
    if (t.type === "font" && value) loadFont(String(value));
    const stored = value === undefined || value === null || value === "" ? undefined : t.type === "length" ? `${value as number}px` : String(value);
    (live ? ctx.live : ctx.commit)((props) => setToken(props, name, stored));
  };

  const panel = new Panel(host, {
    change(key, value, live) {
      if (!ctx) return;
      const part = ctx.part;
      const token = tokenNameOf(key);
      if (token) return changeToken(token, value, live);
      if (key === "css") {
        if (!ctx.developer) return;
        return writeLook(part, live, (s) => setCodeText(s, String(value ?? ""), partSafeDecls));
      }
      writeLook(part, live, (s, el) => {
        applyKey(s, key, value, el);
        // As in the tree editor: columns draw only on a grid; leaving a layout drops what the Code tab wrote for it.
        if (key === "gcols" && !s.layout) s.layout = "grid";
        if (key === "layout" && value === "block") dropCss(s, ["display", "flex-direction", "flex-wrap", "grid-template-columns"]);
        settleCss(s);
      });
    },
    reset(key) {
      if (!ctx) return;
      const token = tokenNameOf(key);
      if (token) return changeToken(token, undefined, false);
      writeLook(ctx.part, false, (s) => resetKey(s, key));
    },
    select(ref) { ctx?.select(ref); },
    hover(ref) { ctx?.hover(ref); },
    toggleHidden(ref) { writeLook(ref, false, (s) => { if (s.hide) delete s.hide; else s.hide = true; }); },
  });

  // A spell of typing ends when the field is left; Ctrl+Z inside a field while typing puts back only the spell.
  const onFocusOut = () => ctx?.endSpell();
  const onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z" && ctx?.revert()) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  // After the panel has handled a tab click, remember which tab is open for this part.
  const onTabClick = (e: MouseEvent) => {
    if (!ctx || !(e.target as HTMLElement | null)?.closest?.('[role="tab"]')) return;
    const t = shownTab(host);
    if (t) openTab.set(`${ctx.id}~p:${ctx.part}`, t);
  };
  host.addEventListener("focusout", onFocusOut);
  host.addEventListener("keydown", onKey, true);
  host.addEventListener("click", onTabClick);

  return {
    render(next) {
      const fresh = !ctx || ctx.id !== next.id || ctx.part !== next.part;
      ctx = next;
      const view = contextOf(next, host);
      if (!view) return;
      panel.render(view, fresh);
      const want = openTab.get(view.key);
      if (want && want !== shownTab(host) && view.tabs?.includes(want as never)) panel.setTab(want as never);
    },
    destroy() {
      host.removeEventListener("focusout", onFocusOut);
      host.removeEventListener("keydown", onKey, true);
      host.removeEventListener("click", onTabClick);
      panel.destroy();
      ctx = null;
    },
  };
}

// ============================================================================
// The right-hand panel: canvas-grade sections over a part's slot schema.
//
// Plain DOM (string templates + event delegation), mounted outside any React
// tree. Tabs Properties · Code · Tweaks · Saved. Properties lists, in the
// canvas's order, Layers (the whole page as a tree), Content, Align, Size, Layout,
// Link, Text, Appearance, Behaviour, Effects and Advanced, each showing only the
// slots the selected part declares at the current freedom level. Every field shows a
// value: the stored one, or the computed one the host read from the page (set
// in a lighter tone). A "+" beside a section reveals its optional fields, so
// the default panel is short. A reset arrow sits beside every overridden
// field; values outside the level are flagged amber and kept until "Snap".
//
// Re-rendering: while a text field, number field or colour input in the panel
// has focus, render() replaces every row except the focused one ("soft"), so
// typing and dragging are never interrupted; otherwise the panel is redrawn
// and focus and scroll are restored.
// ============================================================================

import { FONT_CATEGORIES, fontStack, fontsIn, previewFont, loadFont } from "@elkdonis/fonts";
import { SECTION_ORDER, SECTION_TITLE, FREEDOM_LABEL, fits, type Freedom, type ResolvedSlot, type Scalar, type SectionId } from "../model/schema";
import { getDecl, setDecl, droppedDecls, type Decl } from "../model/css";
import { contrastVerdict, normHex } from "../model/color";
import { icon } from "./icons";

export interface Swatch { value: string; label?: string }
export interface TextStylePreset { id: string; label: string; group?: string; style: Record<string, Scalar | undefined> }
export interface LayerRow {
  ref: string; kind: string; name: string; text?: string; depth: number;
  /** The row this one sits under (collapsing it hides this row). */
  parent?: string;
  /** A given name or anchor, shown plain, where `text` (first words) is shown in quotes. */
  note?: string;
  /** Starts open. Only the first time the row is seen: after that the person decides. */
  open?: boolean;
  selected?: boolean; hidden?: boolean; canHide?: boolean; link?: boolean;
  /** Can be dragged to reorder among rows of the same kind. */
  draggable?: boolean;
}
export interface FontGroups { inPage: string[]; family: string[]; borrow?: string[]; library?: boolean }
export type TabId = "props" | "code" | "tweaks" | "saved";

export interface PanelContext {
  /** Tabs to offer. Default: all four. */
  tabs?: readonly TabId[];
  /** Keep the layer tree above the Code tab too, so moving through the page and reading its code go together. */
  layersOnCode?: boolean;
  /** Identity of the selection; popovers close when it changes. */
  key: string;
  heading: string;
  sub?: string;
  freedom: Freedom;
  /** Every slot of the part (hidden ones have allowed = null). */
  slots: ResolvedSlot<any>[];
  /** Effective values by key (virtual keys included). */
  values: Record<string, unknown>;
  /**
   * Values read from the page (getComputedStyle) for keys the part does not set:
   * shown in every field so none is blank. `css:<property>` for Advanced fields.
   */
  computed?: Record<string, unknown>;
  /** Keys holding an override (they get a reset arrow). */
  overridden: Record<string, boolean>;
  /** Override keys outside the current level. */
  outside: string[];
  /** Theme swatches (family inks, org colours) and colours in use on the page. */
  theme: Swatch[];
  used: string[];
  /**
   * Pass 3: the colour popover's groups, in order (family, tints and shades,
   * other families, more colours). Swatches outside the slot's level are still
   * offered, marked amber; the panel adds "On this page" and "Recent".
   */
  palette?: Array<{ label: string; colors: string[] }>;
  fonts?: FontGroups;
  textStyles?: TextStylePreset[];
  /** Text colour against its resolved background. */
  contrast?: { fg?: string; bg?: string; size?: number; weight?: number };
  /** The whole page as a flat tree (see LayerRow.parent). */
  layers?: LayerRow[];
  /** Host HTML appended to a section (the section is shown even without slots). */
  extra?: Partial<Record<SectionId, string>>;
  /** Host HTML after the sections (actions). */
  bottom?: string;
  /** This section comes right after the tree. */
  leadSection?: SectionId;
  /** Host HTML before a section's rows (the section is shown even without slots). */
  sectionTop?: Partial<Record<SectionId, string>>;
  code?: {
    written: Decl[]; css: string; editable: boolean; sanitize(css: string): Decl[];
    /** Values the part inherits: `From frame color {{ink}}`. */
    inherited?: Array<{ from: string; prop: string; value: string; token?: string }>;
    /** Lower-case value → shared variable name, so written declarations can show `{{ink}}`. */
    tokens?: Record<string, string>;
    /** No "Your CSS" block (pages edited visually). */
    readOnly?: boolean;
    /**
     * One editable sheet of declarations, then what the box inherits grouped by
     * where it comes from, each with "+" to set it on this box. `css` is the
     * sheet's text.
     */
    sheet?: { tag: string; hint?: string; attrs?: string[]; from?: Array<{ kind: string; tag: string; rows: Array<{ prop: string; value: string }> }> };
    /** The sentence above the written declarations. */
    intro?: string;
    /** A sealed block's stored settings, read-only: a tag line, then the JSON. */
    config?: { tag: string; hint?: string; json: string };
  };
  /** The Tweaks tab: the sheet's shared variables, edited in one place. */
  tweaks?: { title?: string; slots: ResolvedSlot<any>[]; values: Record<string, unknown>; overridden: Record<string, boolean>; fonts?: FontGroups; note?: string; palette?: Array<{ label: string; colors: string[] }> };
  /** HTML for the Saved tab. */
  saved?: string;
  /** Shown instead of sections when nothing is selected. */
  empty?: string;
  /** One line under the heading: something true of this selection that its fields do not show. */
  notice?: string;
  /** Heading and notice stay in view while the panel scrolls: a part is named nowhere else once the tree has scrolled away. */
  stickHead?: boolean;
}

export interface PanelHandlers {
  change(key: string, value: unknown, live: boolean): void;
  reset(key: string): void;
  /** A text-style preset: several keys in one step. */
  textStyle?(style: Record<string, Scalar | undefined>): void;
  select?(ref: string): void;
  toggleHidden?(ref: string): void;
  snap?(): void;
  /** The pointer is over a layer row (null: left the tree). */
  hover?(ref: string | null): void;
  /** A draggable layer row was pulled: start the drag (the host draws the line and drops). */
  dragLayer?(ref: string, ev: PointerEvent): void;
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const enc = (v: unknown) => esc(JSON.stringify(v));
const same = (a: unknown, b: unknown) => a === b || (typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase()) || (typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 1e-9);
const fmt = (v: unknown) => (typeof v === "number" ? String(Math.round(v * 1000) / 1000) : v == null ? "" : String(v));
const TEXTLIKE = 'input[type="text"], input:not([type]), input[type="color"], input[type="search"], textarea';
const COLLAPSIBLE: SectionId[] = ["effects", "advanced"];
/** Layer-row icons by kind (pass 3 adds containers, pictures, dividers). */
const KIND_ICON: Record<string, string> = { frame: "stack", text: "text", row: "dir-row", column: "dir-col", grid: "k-grid", image: "k-image", rule: "k-rule" };
const TAB_LABEL: Record<TabId, string> = { props: "Properties", code: "Code", tweaks: "Tweaks", saved: "Saved" };

type Pop = { kind: "color" | "font"; id: string; key: string; tab?: "theme" | "custom"; q?: string } | null;
const RECENT_KEY = "de-recent-colours";
/** Storage may be missing or throw (sandboxed frames, private modes): never let that break the panel. */
const loadRecent = (): string[] => { try { if (typeof localStorage === "undefined") return []; const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string" && /^#[0-9a-f]{6}$/.test(x)).slice(0, 12) : []; } catch { return []; } };
type EyeDropperCtor = new () => { open(): Promise<{ sRGBHex: string }> };

export class Panel {
  private ctx: PanelContext | null = null;
  private tab: TabId = "props";
  private open = new Set<SectionId>();
  /** Sections whose "+" is pressed (optional fields shown). */
  private more = new Set<SectionId>();
  private split = new Set<string>();
  private pop: Pop = null;
  /** Layer rows that are open (children shown); the page row starts open. */
  private expanded = new Set<string>([""]);
  /** Rows whose `open` has been honoured. */
  private opened = new Set<string>();
  /** The selection moved: bring its row into view in the tree. */
  private scrollToRow = false;
  private lastSelRef: string | null = null;
  private suppressClick = false;
  /** What the member typed in the Code tab (the host stores only what survives sanitising). */
  private rawCss: { key: string; text: string } | null = null;
  private io: IntersectionObserver | null = null;
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Colours picked recently (this browser), newest first. */
  private recent: string[] = loadRecent();
  /** A popover was just opened: bring it into view once (a field near the panel's bottom opens below the fold). */
  private popOpened = false;
  private offs: Array<() => void> = [];

  constructor(private el: HTMLElement, private h: PanelHandlers) {
    el.classList.add("de-panel");
    const on = (t: EventTarget, type: string, fn: (e: any) => void, o?: AddEventListenerOptions) => { t.addEventListener(type, fn, o); this.offs.push(() => t.removeEventListener(type, fn, o)); };
    on(el, "click", (e: MouseEvent) => this.onClick(e));
    on(el, "input", (e: Event) => this.onInput(e));
    on(el, "change", (e: Event) => this.onChange(e));
    on(el, "keydown", (e: KeyboardEvent) => this.onKey(e));
    on(el, "mouseover", (e: MouseEvent) => {
      const r = (e.target as HTMLElement).closest?.("[data-layer]") as HTMLElement | null;
      if (r) this.h.hover?.(r.dataset.layer!);
    });
    on(el, "mouseleave", () => this.h.hover?.(null));
    on(el, "pointerdown", (e: PointerEvent) => this.onPointerDown(e));
    on(document, "pointerdown", (e: PointerEvent) => {
      if (!this.pop) return;
      const t = e.target as HTMLElement;
      if (t.closest?.(".de-pop") || t.closest?.("[data-pop]")) return;
      this.pop = null; this.redraw();
    });
  }

  destroy(): void { for (const off of this.offs) off(); this.io?.disconnect(); this.el.innerHTML = ""; }

  get currentTab(): TabId { return this.tab; }
  setTab(t: TabId): void { this.tab = t; this.pop = null; this.redraw(); }

  render(ctx: PanelContext, force = false): void {
    if (this.ctx && this.ctx.key !== ctx.key) { this.pop = null; this.split.clear(); this.rawCss = null; }
    this.ctx = ctx;
    for (const r of ctx.layers ?? []) if (r.open && !this.opened.has(r.ref)) { this.opened.add(r.ref); this.expanded.add(r.ref); }
    this.revealSelected(ctx);
    const active = document.activeElement as HTMLElement | null;
    const popInSync = !!this.pop === !!this.el.querySelector(".de-pop");
    const soft = !force && popInSync && !!active && this.el.contains(active) && active.matches(TEXTLIKE) && !!this.el.querySelector("[data-sync]");
    const html = this.html(ctx);
    if (soft) {
      const tpl = document.createElement("template");
      tpl.innerHTML = html;
      // Names in the tree change while a field is typed in; its scroll position must not.
      const keepTop = this.el.querySelector(".de-layers ul")?.scrollTop ?? 0;
      tpl.content.querySelectorAll<HTMLElement>("[data-sync]").forEach((fresh) => {
        const old = this.el.querySelector(`[data-sync="${CSS.escape(fresh.dataset.sync!)}"]`);
        if (old && old !== fresh && !old.contains(active)) old.replaceWith(fresh);
      });
      const tree = this.el.querySelector(".de-layers ul");
      if (tree) tree.scrollTop = keepTop;
      return;
    }
    const scroller = this.el.querySelector(".de-body");
    const top = scroller ? scroller.scrollTop : 0;
    const listTop = this.el.querySelector(".de-fontlist")?.scrollTop ?? 0;
    const treeTop = this.el.querySelector(".de-layers ul")?.scrollTop ?? 0;
    const focus = active && this.el.contains(active) ? active.dataset.f : undefined;
    this.el.innerHTML = html;
    const body = this.el.querySelector(".de-body");
    if (body) body.scrollTop = top;
    const list = this.el.querySelector(".de-fontlist");
    if (list) list.scrollTop = listTop;
    const tree = this.el.querySelector(".de-layers ul");
    if (tree) {
      tree.scrollTop = treeTop;
      const row = this.scrollToRow ? tree.querySelector<HTMLElement>("li.on") : null;
      if (row) {
        const t = tree.getBoundingClientRect(), r = row.getBoundingClientRect();
        if (r.top < t.top || r.bottom > t.bottom) tree.scrollTop += r.top - t.top - t.height / 3;
      }
      this.scrollToRow = false;
    }
    if (focus) (this.el.querySelector(`[data-f="${CSS.escape(focus)}"]`) as HTMLElement | null)?.focus({ preventScroll: true });
    this.afterDraw();
  }

  /** Panel-state changes (tabs, sections, popovers) always redraw fully. */
  private redraw() { if (this.ctx) this.render(this.ctx, true); }

  /** Open the tree down to the selected row when the selection changes. */
  private revealSelected(c: PanelContext) {
    const sel = c.layers?.find((r) => r.selected);
    const ref = sel ? sel.ref : null;
    if (ref === this.lastSelRef) return;
    this.lastSelRef = ref;
    this.scrollToRow = true;
    if (sel) this.expanded.add(sel.ref);
    let p = sel?.parent;
    while (p !== undefined) { this.expanded.add(p); p = c.layers!.find((r) => r.ref === p)?.parent; }
  }

  // ----------------------------------------------------------------- markup
  private html(c: PanelContext): string {
    // The selection moved to something without this tab.
    if (c.tabs && !c.tabs.includes(this.tab)) { this.tab = "props"; this.pop = null; }
    const tabs = `<div class="de-tabs" role="tablist">` +
      (c.tabs ?? (["props", "code", "tweaks", "saved"] as const)).map((t) => `<button role="tab" data-tab="${t}" aria-selected="${this.tab === t}" data-f="tab-${t}">${TAB_LABEL[t]}</button>`).join("") + "</div>";
    let body = "";
    if (this.tab === "code") body = (c.layersOnCode && c.layers?.length ? this.layers(c.layers) : "") + this.codeTab(c);
    else if (this.tab === "tweaks") body = this.tweaksTab(c);
    else if (this.tab === "saved") body = c.saved ?? "";
    else body = this.propsTab(c);
    return `${tabs}<div class="de-body">${body}</div>`;
  }

  private propsTab(c: PanelContext): string {
    if (c.empty !== undefined) return (c.layers?.length ? this.layers(c.layers) : "") + c.empty;
    let h = `${c.stickHead ? '<div class="de-stick">' : ""}<div class="de-head"><b>${esc(c.heading)}</b>${c.sub ? `<span>${esc(c.sub)}</span>` : ""}</div>`;
    if (c.outside.length) {
      h += `<div class="de-outside" data-sync="outside" role="status">${c.outside.length} setting${c.outside.length > 1 ? "s" : ""} outside ${FREEDOM_LABEL[c.freedom]}` +
        `<button data-act="snap" data-f="snap">Snap to family</button></div>`;
    } else h += `<div data-sync="outside" hidden></div>`;
    h += c.notice ? `<p class="de-note de-notice" data-f="notice" data-sync="notice">${esc(c.notice)}</p>` : `<div data-sync="notice" hidden></div>`;
    if (c.stickHead) h += "</div>";
    const order = c.leadSection ? ["layers" as SectionId, c.leadSection, ...SECTION_ORDER.filter((s) => s !== "layers" && s !== c.leadSection)] : SECTION_ORDER;
    for (const sec of order) h += this.section(sec, c);
    if (c.bottom) h += `<div class="de-bottom">${c.bottom}</div>`;
    return h;
  }

  private isSet(s: ResolvedSlot<any>, c: PanelContext): boolean {
    return s.control === "css-prop" ? !!getDecl(c.values.css as string, s.prop!) : !!c.overridden[s.key];
  }

  private section(sec: SectionId, c: PanelContext): string {
    if (sec === "layers") return c.layers?.length ? this.layers(c.layers) : "";
    const slots = c.slots.filter((s) => s.section === sec && s.allowed);
    const extra = c.extra?.[sec];
    const top = c.sectionTop?.[sec];
    if (!slots.length && !extra && !top) return "";
    if (sec === "align") {
      return `<section class="de-sec de-align" aria-label="Align">${slots.map((s) => this.row(s, c, true)).join("")}</section>`;
    }
    const collapsible = COLLAPSIBLE.includes(sec);
    const main = slots.filter((s) => !s.optional), opt = slots.filter((s) => s.optional);
    const optSet = opt.some((s) => this.isSet(s, c));
    const moreOpen = this.more.has(sec) || optSet;
    const anySet = slots.some((s) => this.isSet(s, c));
    const isOpen = !collapsible || this.open.has(sec) || anySet;
    let head = `<h3 class="de-sec-title">${SECTION_TITLE[sec]}`;
    if (collapsible) head += `<button class="de-icon" data-sec="${sec}" aria-expanded="${isOpen}" title="${isOpen ? "Hide" : "Show"} ${SECTION_TITLE[sec].toLowerCase()}" data-f="sec-${sec}">${icon(isOpen ? (sec === "effects" ? "minus" : "down") : sec === "effects" ? "plus" : "chev")}</button>`;
    else if (opt.length && !optSet) head += `<button class="de-icon de-more" data-more="${sec}" aria-expanded="${moreOpen}" title="${moreOpen ? "Fewer" : "More"} ${SECTION_TITLE[sec].toLowerCase()} fields" aria-label="${moreOpen ? "Fewer" : "More"} ${SECTION_TITLE[sec].toLowerCase()} fields" data-f="more-${sec}">${icon(moreOpen ? "minus" : "plus")}</button>`;
    head += "</h3>";
    const rows = (isOpen ? main.map((s) => this.row(s, c)).join("") : "") + (isOpen && moreOpen ? opt.map((s) => this.row(s, c)).join("") : "");
    return `<section class="de-sec" data-section="${sec}">${head}${top ?? ""}${rows}${isOpen ? (extra ?? "") : ""}</section>`;
  }

  private layers(rows: LayerRow[]): string {
    const vis = new Map<string, boolean>();
    const items: string[] = [];
    for (const r of rows) {
      const shown = r.parent === undefined ? true : !!vis.get(r.parent) && this.expanded.has(r.parent);
      vis.set(r.ref, shown);
      if (!shown) continue;
      const kids = rows.some((x) => x.parent === r.ref);
      const open = this.expanded.has(r.ref);
      items.push(`<li class="${r.selected ? "on" : ""}${r.hidden ? " off" : ""}" style="--d:${r.depth}" data-row="${esc(r.ref)}"${r.draggable ? ` data-drag="${esc(r.ref)}"` : ""}>` +
        (kids ? `<button class="de-icon de-twist" data-expand="${esc(r.ref)}" aria-expanded="${open}" title="${open ? "Collapse" : "Expand"}" aria-label="${open ? "Collapse" : "Expand"} ${esc(r.name)}" data-f="twist-${esc(r.ref)}">${icon(open ? "down" : "chev")}</button>` : '<span class="de-twist-gap"></span>') +
        `<button class="de-layer" data-layer="${esc(r.ref)}" data-f="layer-${esc(r.ref)}"><span class="de-kind">${icon(KIND_ICON[r.kind] ?? "text")}</span><b>${esc(r.name)}</b>${r.note ? ` <span>${esc(r.note)}</span>` : r.text ? ` <span>“${esc(r.text.length > 22 ? r.text.slice(0, 22) + "…" : r.text)}”</span>` : ""}</button>` +
        (r.link ? `<span class="de-linkmark" title="Links somewhere">${icon("link")}</span>` : "") +
        (r.canHide ? `<button class="de-icon de-eye" data-hide="${esc(r.ref)}" aria-pressed="${!!r.hidden}" title="${r.hidden ? "Show" : "Hide"} on the page" data-f="eye-${esc(r.ref)}">${icon(r.hidden ? "eye-off" : "eye")}</button>` : "") +
        "</li>");
    }
    return `<section class="de-sec de-layers" aria-label="Layers" data-sync="layers"><ul>${items.join("")}</ul></section>`;
  }

  private aux(s: ResolvedSlot<any>, c: PanelContext): string {
    const k = s.key;
    const isOut = c.outside.includes(k) && (s.control !== "css-prop");
    const changed = s.control === "css-prop" ? !!getDecl(c.values.css as string, s.prop!) : !!c.overridden[k];
    return `<span class="de-aux" data-sync="aux-${esc(s.id)}">${isOut ? `<span class="de-flag" title="Outside ${FREEDOM_LABEL[c.freedom]}">outside</span>` : ""}` +
      (changed ? `<button class="de-icon de-reset" data-reset="${esc(k)}"${s.prop ? ` data-prop="${esc(s.prop)}"` : ""} title="Reset to the template" aria-label="Reset ${esc(s.label)}" data-f="reset-${esc(s.id)}">${icon("reset")}</button>` : "") + "</span>";
  }

  private row(s: ResolvedSlot<any>, c: PanelContext, bare = false): string {
    const own = s.control === "css-prop" ? getDecl(c.values.css as string, s.prop!) : c.values[s.key];
    const comp = s.control === "css-prop" ? c.computed?.["css:" + s.prop] : c.computed?.[s.key];
    const v = own !== undefined ? own : comp;
    const ctl = this.control(s, v, c, own === undefined && comp !== undefined);
    const tip = s.hint ? ` title="${esc(s.hint)}"` : "";
    // A readout is not a field, so there is nothing for a label to point at.
    const lab = bare ? "" : s.control === "readout" ? `<span class="de-label"${tip}>${esc(s.label)}</span>` : `<label class="de-label" for="de-${esc(s.id)}"${tip}>${esc(s.label)}</label>`;
    let after = "";
    if (s.control === "color" && s.key === "color" && c.contrast) {
      const ver = contrastVerdict(c.contrast.fg, c.contrast.bg, c.contrast.size, c.contrast.weight);
      after = ver ? `<div class="de-contrast ${ver.good ? "good" : "poor"}" data-sync="contrast-${esc(s.id)}" title="Against ${esc(c.contrast.bg)} (WCAG AA ${ver.large ? "3" : "4.5"}:1)">${icon("text")}${esc(ver.text)}</div>` : "";
    }
    return `<div class="de-row${bare ? " bare" : ""}${s.key.startsWith("p:") ? " de-prop" : ""} c-${s.control}" data-sync="row-${esc(s.id)}">${lab}<div class="de-ctl">${ctl}</div>${this.aux(s, c)}${after}</div>`;
  }

  private control(s: ResolvedSlot<any>, v: unknown, c: PanelContext, isComp = false): string {
    const a = s.allowed!;
    const id = `de-${s.id}`;
    const label = (x: Scalar) => esc(s.labels?.[String(x)] ?? (typeof x === "boolean" ? (x ? "On" : "Off") : String(x)));
    switch (s.control) {
      case "chips":
      case "icons": {
        const list = (a.list ?? []) as Scalar[];
        const shown = s.map ? Object.keys(s.map) : list;
        const cur = s.map ? Object.keys(s.map).find((cv) => same(s.map![cv], v)) : v;
        // An off-list value is shown (amber) only when it is really outside; a value another
        // control of the same key offers (align "stretch" = width Fill) is not.
        const all = cur !== undefined && !shown.some((x) => same(x, cur)) && !s.map && c.outside.includes(s.key) ? [...shown, cur as Scalar] : shown;
        return `<div class="de-seg ${s.control}" role="group" aria-label="${esc(s.label)}">` + all.map((x) => {
          const allowed = s.map ? fits(a, x) : list.some((y) => same(y, x));
          if (s.map && !allowed) return "";
          return `<button data-set="${esc(s.key)}" data-val="${enc(s.map ? s.map[String(x)] : x)}" aria-pressed="${same(x, cur)}" class="${allowed ? "" : "out"}" title="${label(x)}" data-f="${esc(s.id)}=${esc(String(x))}">${s.icons?.[String(x)] ? icon(s.icons[String(x)]!) : label(x)}</button>`;
        }).join("") + "</div>";
      }
      case "select": {
        const list = (a.list ?? []) as Scalar[];
        const all = v !== undefined && !list.some((x) => same(x, v)) ? [v as Scalar, ...list] : list;
        // A block's setting with nothing stored and no default: its first option would read as chosen, and picking it would fire no change.
        const none = v === undefined && s.key.startsWith("p:") ? `<option value="" selected disabled>Choose…</option>` : "";
        return `<select id="${id}" data-k="${esc(s.key)}" data-f="${esc(s.id)}"${isComp ? ' class="computed"' : ""}>` + none + all.map((x) => `<option value="${enc(x)}" ${same(x, v) ? "selected" : ""}>${label(x)}${list.some((y) => same(y, x)) ? "" : " (outside)"}</option>`).join("") + "</select>";
      }
      case "number":
        return this.num(s, s.key, v, id, s.id, isComp);
      case "dim": {
        const modes = (a.list ?? []) as Scalar[];
        const mode = v === undefined ? modes[0] : v;
        const n = c.values[s.numKey!] ?? c.computed?.[s.numKey!];
        const editable = modes.some((m) => m === "fixed");
        return `<div class="de-dim"><div class="de-num${editable ? "" : " ro"}${c.values[s.numKey!] === undefined ? " computed" : ""}"><input type="text" inputmode="decimal" id="${id}" data-k="${esc(s.numKey!)}" data-num value="${esc(fmt(n))}"${editable ? "" : " readonly"} data-step="1" data-f="${esc(s.id)}" aria-label="${esc(s.label)} in pixels"><span class="de-unit">px</span></div>` +
          `<select data-k="${esc(s.key)}" data-sync="mode-${esc(s.id)}" data-f="${esc(s.id)}-mode" aria-label="${esc(s.label)} mode">` + modes.map((m) => `<option value="${enc(m)}" ${same(m, mode) ? "selected" : ""}>${label(m)}</option>`).join("") + "</select></div>";
      }
      case "sides":
      case "corners": {
        const arr = Array.isArray(v);
        const split = arr || this.split.has(s.id);
        const btn = `<button class="de-icon de-split" data-split="${esc(s.id)}" aria-pressed="${split}" title="${split ? "One value" : s.control === "sides" ? "Per side" : "Per corner"}" data-f="split-${esc(s.id)}">${icon(s.control)}</button>`;
        if (!split) return this.num(s, s.key, v, id, s.id, isComp) + btn;
        const vals = arr ? (v as number[]) : [v, v, v, v];
        const pre = s.control === "sides" ? "side" : "corner";
        return `<div class="de-quad">${[0, 1, 2, 3].map((i) => `<div class="de-num q${isComp ? " computed" : ""}"><span class="de-qicon">${icon(pre + i)}</span><input type="text" inputmode="decimal" data-k="${esc(s.key)}" data-side="${i}" value="${esc(fmt(vals[i]))}" aria-label="${esc(s.label)} ${["top", "right", "bottom", "left"][i]}" data-f="${esc(s.id)}-${i}"></div>`).join("")}</div>` + btn;
      }
      case "color":
        return this.color(s, v as string | undefined, c, isComp);
      case "font":
        return this.font(s, v as string | undefined, c);
      case "textstyle":
        return this.textStyle(s, c);
      case "css-prop": {
        const list = a.list as Scalar[] | undefined;
        const comp = isComp ? String(v ?? "") : "";
        if (list) {
          const cur = v == null || isComp ? undefined : String(v);
          const all: Scalar[] = cur && !list.includes(cur) ? [cur, ...list] : list;
          return `<select id="${id}" data-cssprop="${esc(s.prop!)}" data-f="${esc(s.id)}"${isComp ? ' class="computed"' : ""}><option value="">${esc(comp || s.placeholder || "auto")}</option>` + all.map((x) => `<option value="${esc(x)}" ${x === cur ? "selected" : ""}>${esc(x)}</option>`).join("") + "</select>";
        }
        return `<input type="text" id="${id}" data-cssprop="${esc(s.prop!)}" value="${esc(v ?? "")}"${isComp ? ' class="computed"' : ""} placeholder="${esc(s.placeholder ?? "auto")}" spellcheck="false" data-f="${esc(s.id)}">`;
      }
      case "text":
        return `<input type="text" id="${id}" data-k="${esc(s.key)}" data-text value="${esc(v ?? "")}" placeholder="${esc(s.placeholder ?? "")}" spellcheck="false" data-f="${esc(s.id)}">`;
      case "textarea":
        return `<textarea id="${id}" data-k="${esc(s.key)}" data-text rows="3" placeholder="${esc(s.placeholder ?? "")}" spellcheck="false" data-f="${esc(s.id)}">${esc(v ?? "")}</textarea>`;
      case "readout":
        return `<span class="de-readout" data-f="${esc(s.id)}">${esc(s.readout ?? "")}</span>`;
      default:
        return "";
    }
  }

  private num(s: ResolvedSlot<any>, key: string, v: unknown, id: string, f: string, isComp = false): string {
    const a = s.allowed!;
    const r = a.range ? `${a.range[0]} to ${a.range[1]}` : "";
    return `<div class="de-num${isComp ? " computed" : ""}"><input type="text" inputmode="decimal" id="${id}" data-k="${esc(key)}" data-num value="${esc(fmt(v))}" placeholder="${esc(s.placeholder ?? "")}" title="${esc(r ? `${FREEDOM_LABEL[this.ctx?.freedom ?? 0]}: ${r}${s.unit ? " " + s.unit : ""}. Arrow keys step, Shift ×10` : "")}" data-step="${a.step ?? 1}" data-f="${esc(f)}">${s.unit ? `<span class="de-unit">${esc(s.unit)}</span>` : ""}</div>`;
  }

  private color(s: ResolvedSlot<any>, v: string | undefined, c: PanelContext, isComp = false): string {
    const hex = normHex(v);
    const open = this.pop?.kind === "color" && this.pop.id === s.id;
    let h = `<button class="de-swatchbtn" data-pop="color:${esc(s.id)}" aria-expanded="${open}" aria-label="Choose ${esc(s.label)}" data-f="pop-${esc(s.id)}"><span class="de-sw${hex ? "" : " none"}" style="${hex ? `--sw:${hex}` : ""}"></span></button>` +
      `<input type="text" class="de-hex${isComp ? " computed" : ""}" id="de-${esc(s.id)}" data-k="${esc(s.key)}" data-hex value="${esc(hex ? hex.toUpperCase() : "")}" placeholder="None" spellcheck="false" data-f="${esc(s.id)}">`;
    if (open) {
      const tab = this.pop!.tab ?? "theme";
      const allowed = s.allowed!;
      const list = allowed.list as string[] | undefined;
      const canDrop = typeof window !== "undefined" && "EyeDropper" in window;
      h += `<div class="de-pop de-colorpop" role="dialog" aria-label="${esc(s.label)}"><div class="de-poptabs"><button data-ctab="theme" aria-selected="${tab === "theme"}" data-f="ctab-theme">Palette</button><button data-ctab="custom" aria-selected="${tab === "custom"}" data-f="ctab-custom">Custom</button>` +
        (canDrop ? `<button class="de-icon" data-eyedrop="${esc(s.key)}" title="Pick a colour from the screen" aria-label="Eyedropper" data-f="eyedrop">${icon("eyedrop")}</button>` : "") +
        `<button class="de-icon" data-popclose title="Close" data-f="popclose">${icon("close")}</button></div>`;
      if (tab === "theme") {
        // Groups in order; a colour shows once (its first group). Outside the level = amber mark, still choosable.
        const groups = (c.palette?.length ? c.palette : [{ label: "Theme", colors: list ? list.map(String) : c.theme.map((t) => t.value) }])
          .concat(list ? [{ label: "Allowed here", colors: list.map(String) }] : [])
          .concat([{ label: "On this page", colors: c.used }, { label: "Recent", colors: this.recent }]);
        const seen = new Set<string>();
        h += '<div class="de-swgroups">';
        for (const g of groups) {
          const colours = g.colors.map((x) => normHex(x) ?? "").filter((x) => x && !seen.has(x) && seen.add(x));
          if (!colours.length) continue;
          h += `<p class="de-swhead">${esc(g.label)}</p><div class="de-swgrid" role="group" aria-label="${esc(g.label)}">` + colours.map((v) => {
            const ok = fits(allowed, v);
            return `<button class="de-swbtn${ok ? "" : " out"}" data-set="${esc(s.key)}" data-val="${enc(v)}" aria-pressed="${v === hex}" title="${esc(v.toUpperCase())}${ok ? "" : " (outside " + FREEDOM_LABEL[c.freedom] + ": kept, flagged)"}" data-f="sw-${v}"><span class="de-sw" style="--sw:${v}"></span></button>`;
          }).join("") + "</div>";
        }
        h += "</div>";
        h += `<p class="de-swfoot">${hex ? `<span class="de-sw" style="--sw:${hex}"></span>${esc(hex.toUpperCase())}${fits(allowed, hex) ? "" : ' <span class="de-flag">outside</span>'}` : "No colour"}</p>`;
      } else {
        h += `<div class="de-custom"><input type="color" data-k="${esc(s.key)}" data-colorinput value="${esc(hex ?? "#000000")}" aria-label="Pick a colour" data-f="cinput"><input type="text" class="de-hex" data-k="${esc(s.key)}" data-hex value="${esc(hex ? hex.toUpperCase() : "")}" placeholder="#RRGGBB" data-f="chex"></div>` +
          (list ? `<p class="de-note">Any colour is kept. Outside ${FREEDOM_LABEL[c.freedom]}'s palette it is flagged amber, and Snap to family puts it back.</p>` : "");
      }
      h += "</div>";
    }
    return h;
  }

  private font(s: ResolvedSlot<any>, v: string | undefined, c: PanelContext): string {
    const open = this.pop?.kind === "font" && this.pop.id === s.id;
    if (v) loadFont(v);
    let h = `<button class="de-fontbtn" id="de-${esc(s.id)}" data-pop="font:${esc(s.id)}" aria-expanded="${open}" aria-haspopup="listbox" style="font-family:${esc(v ? fontStack(v) : "inherit")}" data-f="pop-${esc(s.id)}"><span>${esc(v ?? "Default")}</span>${icon("down")}</button>`;
    if (!open) return h;
    const g = c.fonts ?? { inPage: [], family: [] };
    const allowed = s.allowed!;
    const listed = new Set<string>();
    const group = (title: string, names: string[]) => {
      const fresh = names.filter((n) => !listed.has(n));
      fresh.forEach((n) => listed.add(n));
      if (!fresh.length) return "";
      return `<li class="de-fontgroup" role="presentation">${esc(title)}</li>` + fresh.map((n) => {
        const ok = fits(allowed, n);
        return `<li role="presentation"><button role="option" class="de-fontitem${ok ? "" : " out"}" data-font="${esc(n)}" aria-selected="${n === v}" style="font-family:${esc(fontStack(n))}" data-f="font-${esc(n)}">${esc(n)}${ok ? "" : '<small>outside</small>'}${n === v ? icon("check") : ""}</button></li>`;
      }).join("");
    };
    let items = group("In this page", g.inPage) + group("Family", g.family);
    if (g.borrow) items += group("Other families", g.borrow);
    if (g.library) for (const cat of FONT_CATEGORIES) items += group(cat.label, fontsIn(cat.id).map((f) => f.family));
    const q = this.pop!.q ?? "";
    h += `<div class="de-pop de-fontpop"><div class="de-search">${icon("search")}<input type="search" data-fontq value="${esc(q)}" placeholder="Search fonts" aria-label="Search fonts" data-f="fontq"></div>` +
      `<ul class="de-fontlist" role="listbox" aria-label="Fonts">${items}</ul>` +
      `<p class="de-note">${listed.size} fonts listed at ${FREEDOM_LABEL[c.freedom]}${g.library ? "" : g.borrow ? ". The whole library comes with Free" : ". More with Borrow and Free"}.</p></div>`;
    return h;
  }

  private textStyle(s: ResolvedSlot<any>, c: PanelContext): string {
    const presets = c.textStyles ?? [];
    const match = presets.find((p) => Object.entries(p.style).every(([k, val]) => val === undefined || same(c.values[k], val)));
    const groups = new Map<string, TextStylePreset[]>();
    for (const p of presets) { const gname = p.group ?? "Styles"; groups.set(gname, [...(groups.get(gname) ?? []), p]); }
    let opts = `<option value="" ${match ? "" : "selected"} disabled>Custom</option>`;
    for (const [gname, ps] of groups) opts += `<optgroup label="${esc(gname)}">` + ps.map((p) => `<option value="${esc(p.id)}" ${p === match ? "selected" : ""}>${esc(p.label)}</option>`).join("") + "</optgroup>";
    return `<select id="de-${esc(s.id)}" data-textstyle data-f="${esc(s.id)}">${opts}</select>`;
  }

  private codeTab(c: PanelContext): string {
    if (c.empty !== undefined || !c.code) return `<p class="de-note de-pad">Select a part to see its CSS.</p>`;
    const code = c.code;
    if (code.config) return `<div class="de-sheet"><p class="de-sheet-tag"><code>&lt;${esc(code.config.tag)}&gt;</code>${code.config.hint ? ` <span>${esc(code.config.hint)}</span>` : ""}</p><pre class="de-sheet-json" data-sync="sheet-json">${esc(code.config.json)}</pre></div>`;
    if (code.sheet) return this.sheet(c, code, code.sheet);
    const written = code.written.map(([k, v]) => {
      const tk = code.tokens?.[v.trim().toLowerCase()] ?? (k === "font-family" ? code.tokens?.[v.replace(/^"([^"]+)".*$/, "$1").toLowerCase()] : undefined);
      return `<div><span class="p">${esc(k)}</span>: <span class="v">${esc(v)}</span>;${tk ? ` <span class="tok">{{${esc(tk)}}}</span>` : ""}</div>`;
    }).join("");
    const inherited = (code.inherited ?? []).map((i) =>
      `<div><span class="from">From ${esc(i.from)}</span> <span class="p">${esc(i.prop)}</span>${i.token ? ` <span class="tok">{{${esc(i.token)}}}</span>` : ""} <span class="v">${esc(i.value)}</span></div>`).join("");
    const raw = this.rawCss && this.rawCss.key === c.key ? this.rawCss.text : code.css;
    const dropped = droppedDecls(raw, code.sanitize);
    return `<div class="de-code"><h3 class="de-sec-title">${esc(c.heading)}</h3><p class="de-note">${esc(code.intro ?? "What this part is drawn with, from the family, the template and its changes:")}</p><pre class="de-decls" data-r="written">${written || "<i>nothing</i>"}</pre>` +
      `<h3 class="de-sec-title">Inherited</h3><pre class="de-decls" data-r="inherited">${inherited || "<i>nothing</i>"}</pre>` +
      (code.readOnly ? "</div>" : `<h3 class="de-sec-title">Your CSS</h3>` +
      (code.editable
        ? `<textarea class="de-css" data-cssall spellcheck="false" rows="7" placeholder="letter-spacing: .2em; transform: rotate(-2deg);" data-f="cssall">${esc(raw)}</textarea><p class="de-note">Typographic and decorative properties only; nothing that loads a URL.</p>`
        : `<pre class="de-decls">${esc(code.css) || "<i>none</i>"}</pre><p class="de-note">Editing CSS comes with the Free level.</p>`) +
      `<div data-sync="dropped">${dropped.length ? `<p class="de-flagline">Not kept: ${dropped.map(([k]) => esc(k)).join(", ")}</p>` : ""}</div></div>`);
  }

  private sheet(c: PanelContext, code: NonNullable<PanelContext["code"]>, s: NonNullable<NonNullable<PanelContext["code"]>["sheet"]>): string {
    const typing = (document.activeElement as HTMLElement | null)?.dataset?.cssall !== undefined;
    const raw = typing && this.rawCss?.key === c.key ? this.rawCss.text : code.css;
    const dropped = droppedDecls(raw, code.sanitize);
    const groups = (s.from ?? []).map((g) =>
      `<div class="de-from"><p class="de-from-head">From <span class="de-kind">${icon(KIND_ICON[g.kind] ?? "text")}</span> <code>&lt;${esc(g.tag)}&gt;</code></p>` +
      g.rows.map((r) => {
        const hex = normHex(r.value);
        return `<div class="de-from-row"><code class="p">${esc(r.prop)}</code><span class="v">${hex ? `<span class="de-sw" style="--sw:${hex}"></span>` : ""}${esc(r.value)}</span><button class="de-icon" data-adopt-prop="${esc(r.prop)}" data-adopt-value="${esc(r.value)}" title="Set ${esc(r.prop)} on this box" aria-label="Set ${esc(r.prop)} on this box" data-f="adopt-${esc(r.prop)}">${icon("plus")}</button></div>`;
      }).join("") + "</div>").join("");
    return `<div class="de-sheet"><p class="de-sheet-tag"><code>&lt;${esc(s.tag)}&gt;</code>${s.hint ? ` <span>${esc(s.hint)}</span>` : ""}</p>` +
      `<textarea class="de-sheet-css" data-cssall spellcheck="false" rows="${Math.max(3, raw.split("\n").length + 1)}" placeholder="Nothing set on this element yet.&#10;Type  color: red;  to style it." aria-label="This box's styles" data-f="cssall">${esc(raw)}</textarea>` +
      `<div data-sync="dropped">${dropped.length ? `<p class="de-flagline">Not kept: ${dropped.map(([k]) => esc(k)).join(", ")}</p>` : ""}</div>` +
      `<div data-sync="sheet-attrs">${s.attrs?.length ? `<pre class="de-sheet-attrs">${s.attrs.map(esc).join("\n")}</pre>` : ""}</div>` +
      `<div data-sync="sheet-from">${groups}</div></div>`;
  }

  private tweaksTab(c: PanelContext): string {
    const t = c.tweaks;
    if (!t) return `<p class="de-note de-pad">Nothing to tweak here.</p>`;
    const outside = t.slots.filter((s) => s.allowed && s.control === "color" && t.overridden[s.key] && !fits(s.allowed, t.values[s.key])).map((s) => s.key);
    const sub: PanelContext = { ...c, slots: t.slots, values: t.values, overridden: t.overridden, outside, contrast: undefined, computed: undefined, fonts: t.fonts, layers: undefined, palette: t.palette ?? c.palette };
    return `<div class="de-tweaks"><section class="de-sec"><h3 class="de-sec-title">${esc(t.title ?? "Shared variables")}</h3>` +
      (t.note ? `<p class="de-note">${esc(t.note)}</p>` : "") +
      t.slots.filter((s) => s.allowed).map((s) => this.row(s, sub)).join("") + "</section></div>";
  }

  // ----------------------------------------------------------------- events
  private slotById(id: string) { return this.ctx?.slots.find((s) => s.id === id) ?? this.ctx?.tweaks?.slots.find((s) => s.id === id); }
  private slotByKey(k: string) {
    const all = [...(this.ctx?.slots ?? []), ...(this.ctx?.tweaks?.slots ?? [])];
    return all.find((x) => x.key === k || x.numKey === k);
  }

  private onClick(e: MouseEvent) {
    if (this.suppressClick) { this.suppressClick = false; return; }
    const t = (e.target as HTMLElement).closest("button") as HTMLButtonElement | null;
    if (!t || !this.ctx) return;
    const d = t.dataset;
    if (d.tab) { this.tab = d.tab as TabId; this.pop = null; this.redraw(); return; }
    if (d.sec) { const s = d.sec as SectionId; this.open.has(s) ? this.open.delete(s) : this.open.add(s); this.redraw(); return; }
    if (d.more) { const s = d.more as SectionId; this.more.has(s) ? this.more.delete(s) : this.more.add(s); this.redraw(); return; }
    if (d.expand !== undefined) { this.expanded.has(d.expand) ? this.expanded.delete(d.expand) : this.expanded.add(d.expand); this.redraw(); return; }
    if (d.layer !== undefined) { this.h.select?.(d.layer); return; }
    if (d.adoptProp) { this.h.change("css", setDecl(this.ctx.code?.css, d.adoptProp, d.adoptValue), false); return; }
    if (d.hide !== undefined) { this.h.toggleHidden?.(d.hide); return; }
    if (d.act === "snap") { this.h.snap?.(); return; }
    if (d.reset !== undefined) {
      if (d.prop) this.h.change("css", setDecl(this.ctx.values.css as string, d.prop, null), false);
      else this.h.reset(d.reset);
      return;
    }
    if (d.split !== undefined) {
      const s = this.slotById(d.split); if (!s) return;
      const v = this.ctx.values[s.key];
      if (this.split.has(d.split) || Array.isArray(v)) {
        this.split.delete(d.split);
        if (Array.isArray(v)) this.h.change(s.key, v[0], false); else this.redraw();
      } else { this.split.add(d.split); this.redraw(); }
      return;
    }
    if (d.pop) {
      // At the first colon: the id is a slot's, and a block's prop name may hold one.
      const colon = d.pop.indexOf(":");
      const kind = d.pop.slice(0, colon) as "color" | "font", id = d.pop.slice(colon + 1);
      const s = this.slotById(id);
      this.pop = this.pop && this.pop.id === id ? null : { kind, id, key: s?.key ?? id, tab: "theme", q: "" };
      this.popOpened = !!this.pop;
      this.redraw();
      if (this.pop?.kind === "font") (this.el.querySelector("[data-fontq]") as HTMLInputElement | null)?.focus();
      return;
    }
    if (d.ctab) { if (this.pop) this.pop.tab = d.ctab as "theme" | "custom"; this.redraw(); return; }
    if (d.popclose !== undefined) { this.pop = null; this.redraw(); return; }
    if (d.font) { const key = this.pop?.key ?? "font"; this.pop = null; loadFont(d.font); this.h.change(key, d.font, false); return; }
    if (d.eyedrop) {
      const key = d.eyedrop, Ctor = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
      if (Ctor) new Ctor().open().then((r) => { const hx = normHex(r.sRGBHex); if (hx) { this.remember(hx); this.h.change(key, hx, false); } }).catch(() => { /* cancelled */ });
      return;
    }
    if (d.set) { const v = JSON.parse(d.val!); if (t.classList.contains("de-swbtn") && typeof v === "string") this.remember(v); this.h.change(d.set, v, false); return; }
  }

  /** A pull on a draggable layer row starts a drag (a plain click still selects). */
  private onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    const li = (e.target as HTMLElement).closest?.("li[data-drag]") as HTMLElement | null;
    if (!li || (e.target as HTMLElement).closest("button.de-eye, button.de-twist")) return;
    const ref = li.dataset.drag!, x0 = e.clientX, y0 = e.clientY;
    const move = (m: PointerEvent) => {
      if (Math.hypot(m.clientX - x0, m.clientY - y0) < 5) return;
      cleanup();
      this.suppressClick = true;
      setTimeout(() => { this.suppressClick = false; }, 0);
      this.h.dragLayer?.(ref, m);
    };
    const cleanup = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", cleanup); };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", cleanup);
  }

  private onInput(e: Event) {
    const t = e.target as HTMLInputElement;
    if (!this.ctx) return;
    const d = t.dataset;
    if (d.fontq !== undefined) { if (this.pop) this.pop.q = t.value; this.filterFonts(t.value); return; }
    if (d.cssall !== undefined) { this.rawCss = { key: this.ctx.key, text: t.value }; this.debounce("cssall", () => this.h.change("css", t.value, true), 300); return; }
    if (d.cssprop) { if (t.tagName === "SELECT") return; this.debounce("p" + d.cssprop, () => this.h.change("css", setDecl(this.ctx!.values.css as string, d.cssprop!, t.value), true), 250); return; }
    if (d.colorinput !== undefined) { this.debounce("recent", () => this.remember(t.value.toLowerCase()), 600); this.h.change(d.k!, t.value.toLowerCase(), true); return; }
    if (d.hex !== undefined) { const hx = normHex(t.value); if (hx) { this.debounce("recent", () => this.remember(hx), 600); this.h.change(d.k!, hx, true); } return; }
    if (d.side !== undefined) {
      const n = parseNum(t.value); if (n === null) return;
      const s = this.slotByKey(d.k!);
      const cur = this.ctx.values[d.k!] ?? this.ctx.computed?.[d.k!];
      const arr = Array.isArray(cur) ? [...cur] : [cur, cur, cur, cur].map((x) => (typeof x === "number" ? x : 0));
      arr[Number(d.side)] = clampTo(s, n);
      this.h.change(d.k!, arr, true);
      return;
    }
    if (d.text !== undefined) { this.h.change(d.k!, t.value, true); return; }
    if (d.num !== undefined) {
      if (t.readOnly) return;
      const n = parseNum(t.value); if (n === null) return;
      this.h.change(d.k!, clampTo(this.slotByKey(d.k!), n), true);
    }
  }

  private onChange(e: Event) {
    const t = e.target as HTMLInputElement & HTMLSelectElement;
    if (!this.ctx) return;
    const d = t.dataset;
    if (d.textstyle !== undefined) {
      const p = this.ctx.textStyles?.find((x) => x.id === t.value);
      if (p) this.h.textStyle?.(p.style);
      return;
    }
    if (t.tagName === "SELECT" && d.cssprop) { this.h.change("css", setDecl(this.ctx.values.css as string, d.cssprop, t.value), false); return; }
    if (t.tagName === "SELECT" && d.k) { this.h.change(d.k, JSON.parse(t.value), false); return; }
    // An emptied number or colour field returns to the template value.
    if ((d.num !== undefined || d.hex !== undefined) && d.k && !t.value.trim() && (this.ctx.overridden[d.k] || this.ctx.tweaks?.overridden[d.k])) this.h.reset(d.k);
  }

  private onKey(e: KeyboardEvent) {
    const t = e.target as HTMLInputElement;
    if (e.key === "Escape" && this.pop) { e.stopPropagation(); this.pop = null; this.redraw(); return; }
    if (t.dataset?.fontq !== undefined) {
      if (e.key === "Enter" || e.key === "ArrowDown") {
        e.preventDefault();
        const first = [...this.el.querySelectorAll<HTMLButtonElement>(".de-fontitem")].find((b) => !b.closest("li")!.hidden);
        if (first) e.key === "Enter" ? first.click() : first.focus();
      }
      return;
    }
    if (t.classList?.contains("de-fontitem") && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const items = [...this.el.querySelectorAll<HTMLButtonElement>(".de-fontitem")].filter((b) => !b.closest("li")!.hidden);
      const i = items.indexOf(t as unknown as HTMLButtonElement);
      items[Math.max(0, Math.min(items.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
      return;
    }
    if ((t.dataset?.num !== undefined || t.dataset?.side !== undefined) && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      if (t.readOnly) return;
      e.preventDefault();
      const s = this.slotByKey(t.dataset.k!);
      const step = (s?.allowed?.step ?? 1) * (e.shiftKey ? 10 : 1);
      const n = (parseNum(t.value) ?? 0) + (e.key === "ArrowUp" ? step : -step);
      const v = clampTo(s, Math.round(n * 1000) / 1000);
      t.value = fmt(v);
      t.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  /** Keep a picked colour in "Recent" (this browser). */
  private remember(hex: string) {
    const v = normHex(hex); if (!v) return;
    this.recent = [v, ...this.recent.filter((x) => x !== v)].slice(0, 12);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(this.recent)); } catch { /* private mode */ }
  }

  private debounce(id: string, fn: () => void, ms: number) {
    clearTimeout(this.timers.get(id));
    this.timers.set(id, setTimeout(fn, ms));
  }

  private filterFonts(q: string) {
    const needle = q.trim().toLowerCase();
    const list = this.el.querySelector(".de-fontlist");
    if (!list) return;
    let group: HTMLElement | null = null, any = false;
    const closeGroup = () => { if (group) group.hidden = !any; };
    list.querySelectorAll<HTMLElement>(":scope > li").forEach((li) => {
      if (li.classList.contains("de-fontgroup")) { closeGroup(); group = li; any = false; return; }
      const name = li.querySelector<HTMLElement>("[data-font]")?.dataset.font ?? "";
      li.hidden = !!needle && !name.toLowerCase().includes(needle);
      if (!li.hidden) any = true;
    });
    closeGroup();
  }

  private afterDraw() {
    if (this.popOpened) { this.popOpened = false; this.el.querySelector(".de-pop")?.scrollIntoView({ block: "nearest" }); }
    this.io?.disconnect();
    const list = this.el.querySelector(".de-fontlist");
    if (!list) return;
    if (this.pop?.q) this.filterFonts(this.pop.q);
    if (typeof IntersectionObserver === "undefined") return;
    this.io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { previewFont((en.target as HTMLElement).dataset.font!); this.io?.unobserve(en.target); }
    }, { root: list, rootMargin: "120px 0px" });
    list.querySelectorAll("[data-font]").forEach((b) => this.io!.observe(b));
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }
}

function parseNum(s: string): number | null {
  const m = /^\s*(-?\d*\.?\d+)/.exec(s);
  return m ? Number(m[1]) : null;
}

/** Clamp only to a slot's hard bounds (what the server accepts), never to the level's range. */
function clampTo(s: ResolvedSlot<any> | undefined, n: number): number {
  const b = (s as { bounds?: [number, number] } | undefined)?.bounds;
  return b ? Math.max(b[0], Math.min(b[1], n)) : n;
}

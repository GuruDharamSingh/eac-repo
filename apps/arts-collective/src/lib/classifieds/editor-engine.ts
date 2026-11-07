// ============================================================================
// The block editor: direct editing over blocks (2026-11-01; pass 3 2026-11-02).
//
// A thin host over @elkdonis/direct-edit, mounted by ClassifiedsEditor.tsx
// (a sheet of ads) and CardsEditor.tsx (one card design drawn for every item
// of a live feed: "pattern" mode). The package brings the panel (Properties ·
// Code · Tweaks · Saved), the overlay, click-deeper selection, inline text,
// the floating text toolbar, the right-click menu, the viewport, history, the
// slot-schema machinery, smooth grid resize and node drags; this file brings
// the block data: how a block renders (catalog.ts planAd), what each kind of
// node declares (./schema.ts), and how an edit lands as { template, overrides,
// link } through catalog.ts, the same data the public page renders.
//
// Pass 3, in Justin's words: parts are no longer fixed slots ("it doesn't
// move when I click and drag it"): every part is a node that can be dragged,
// reordered, grouped into rows / columns / grids, moved into another ad and
// pulled back out. Resizing follows the pointer and lands on the sheet's own
// grid (6 / 12 / 24 columns, chosen per sheet). And the same editor designs a
// card over live data ("the layout of the card on a feed that is serving live
// data"): edit any card, every card follows.
//
// Every edit is block data validated by cleanDoc on the server; nothing here
// stores free HTML or free CSS.
// ============================================================================

import {
  History, Listeners, MiniBar, Overlay, Panel, ROOT, Viewport, bindCanvas, clearGridGuides, copyToClipboard, deeperIn, drawGridGuides, elementToPng, findDropSpot, hitChain, mixHex, normHex,
  openMenu, outsideKeys, parseRef, refKey, resolveSlots, sanitizeRich, sheetGeometry, startGhostDrag, startInlineText, startNodeDrag, startSmoothResize, toggleList, toggleWhole, wholeHas,
  FREEDOM_HINT, FREEDOM_LABEL, icon,
  type DropRules, type Freedom, type InlineSession, type LayerRow, type MenuItem, type MiniBarContext, type MiniBarHandlers, type NodeRef, type PanelContext, type ResolvedSlot, type TextStylePreset, type Tri,
} from "@elkdonis/direct-edit";
import {
  GRID_DEFAULT, canPlace, cloneTree, countNodes, depthOfKids, findNode, insertNode, maxRows, moveNode, removeNode, sameGrid, scaleSpan, soleToken, subtreeDepth, tokenFor, treeIds, unwrapNode, walk, within, wrapNode,
  type FieldSpec, type GridSpec, type Item, type TreeNode,
} from "@elkdonis/direct-edit/block";
import { loadFont, loadFonts } from "@elkdonis/fonts";
import {
  BASE_TEMPLATES, FAMILIES, KIND_LABEL, RICH, TEXT_KINDS, TREE_RULES,
  baseParts, cleanCopyText, declsToString, effective, fontsUsed, frameDecls, gridOfDoc, isCardTemplate, isTextKind, paperOf, partDecls, planAd, planHTML, plainCopy, safeDecls, sheetDecls, templateOf, templateTree, treeOf,
  type Ad, type ClassifiedsDoc, type Effective, type Kind, type PartStyle, type TextKind, type Theme,
} from "./catalog";
import { EVERY_FAMILY_FONT, LIST_SLOTS, PAGE_SCHEMA, PART_SCHEMA, STRUCTURE, TWEAK_SCHEMA, paletteGroups, themeColours, tweakGroups, type Env } from "./schema";

export interface EditorThread { id: string; title: string }

/** Pattern mode: one design (doc.ads[0]) drawn for every item of a feed. */
export interface PatternOptions {
  /** The data rows, formatted for display, each with its `href`. */
  items: Item[];
  /** The fields a node may show. */
  fields: FieldSpec[];
  /** Which kind of node a field becomes when it is added (title → title, cover → image). */
  fieldKinds?: Record<string, Exclude<Kind, "frame" | "box" | "rule">>;
  /** Names of the kinds on this surface ("Kicker" for header, "Meta" for contact). */
  labels?: Partial<Record<Kind, string>>;
  /** The editor's title ("Feed cards"). */
  title?: string;
  /** Where the items come from (the left rail says it). */
  source?: string;
  /** Designs to start from (card template ids). */
  templates?: string[];
}

export interface MountOptions {
  doc: ClassifiedsDoc;
  orgName: string;
  threads: EditorThread[];
  viewUrl: string;
  onSave: (doc: ClassifiedsDoc) => Promise<{ ok: boolean; error?: string }>;
  /** Starting freedom level (0 Family, 1 Borrow, 2 Free). */
  freedom?: Freedom;
  pattern?: PatternOptions;
}

const DESKTOP_W = 980, PHONE_W = 390;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
type Sel = NodeRef;
type Tool = "select" | "hand" | "text";
type Clip =
  | { kind: "ad"; ad: Ad }
  | { kind: "node"; tree: TreeNode; parts: Record<string, PartStyle>; copy: Record<string, string>; style: PartStyle; nodeKind: Kind };
/** What an unset key already means, so choosing it stores nothing. */
const IMPLICIT: Record<string, unknown> = { italic: false, case: "none", pos: "inline", push: "start", hide: false, weight: 400, layout: "stack", dir: "column" };
const THEME_FONT = new Set(["title", "body"]);
const richOf = (k: Kind) => (isTextKind(k) ? RICH[k] : undefined);
const CONTAINER_SEL = "[data-node], [data-kind='box']";

const rgbHex = (v: string): string | undefined => {
  const m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+%?))?\s*\)/.exec(v);
  if (!m || (m[4] !== undefined && parseFloat(m[4]) === 0)) return undefined;
  return "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("");
};
const r2 = (n: number) => Math.round(n * 100) / 100;

/** What the insert palette offers: [kind, label, style for the new node]. */
type Insertable = { id: string; kind: Exclude<Kind, "frame">; label: string; style?: PartStyle; minLevel: Freedom; pattern?: boolean };
const INSERTS: Insertable[] = [
  { id: "title", kind: "title", label: "Heading", minLevel: 0 },
  { id: "body", kind: "body", label: "Paragraph", minLevel: 0 },
  { id: "header", kind: "header", label: "Label", minLevel: 0 },
  { id: "price", kind: "price", label: "Price", minLevel: 0 },
  { id: "contact", kind: "contact", label: "Small print", minLevel: 0 },
  { id: "rule", kind: "rule", label: "Divider", minLevel: 0 },
  { id: "row", kind: "box", label: "Row", minLevel: 0 },
  { id: "column", kind: "box", label: "Column", style: { dir: "column", gap: 4, items: "stretch", wrap: false }, minLevel: 0 },
  { id: "grid", kind: "box", label: "Grid", style: { layout: "grid", gcols: 2, gap: 8, items: "start" }, minLevel: 1 },
  { id: "image", kind: "image", label: "Picture", minLevel: 0, pattern: true },
];

export function mountClassifiedsEditor(root: HTMLElement, opts: MountOptions): () => void {
  const P = opts.pattern;
  let doc: ClassifiedsDoc = clone(opts.doc);
  // Nothing selected at load: hover outlines the outermost box first (click-through, 2026-11-02).
  let sel: Sel | null = null;
  let hover: NodeRef | null = null;
  /** Pattern mode: which drawn instance (card) the selection and the hover are in. */
  let selInst = 0, hoverInst = 0;
  let freedom: Freedom = opts.freedom ?? 0;
  let tool: Tool = "select";
  let panelOpen = true;
  let showGrid = false, snapOn = true;
  let clip: Clip | null = null;
  let saving = false, busy = false;
  let inline: InlineSession | null = null;
  let styleChoices: TextStylePreset[] = [];
  /** A grid edit in progress: spans are rescaled from where it started (no rounding drift while typing). */
  let gridEdit: { key: string; at: number; base: GridSpec; spans: Record<string, [number, number]> } | null = null;
  const L = new Listeners();
  const history = new History<ClassifiedsDoc>(() => doc, (d) => { doc = d; });
  const LABEL = (k: Kind) => P?.labels?.[k] ?? KIND_LABEL[k];
  const thing = P ? "card" : "ad";

  root.className = "cle" + (P ? " cle-pattern" : "");
  root.dataset.tool = tool;
  root.innerHTML = `
    <header class="cle-top">
      <h1>${esc(P?.title ?? "Classifieds")} · ${esc(opts.orgName)}<span class="cle-dot" data-r="dot" title="Unsaved changes" hidden></span></h1>
      <nav class="cle-crumbs" data-r="crumbs" aria-label="Selection path"></nav>
      <span class="cle-label" id="cle-fl">Freedom</span>
      <div class="cle-seg" data-r="freedom" role="group" aria-labelledby="cle-fl">
        ${FREEDOM_LABEL.map((l, i) => `<button data-level="${i}" aria-pressed="${i === freedom}" title="${FREEDOM_HINT[i]}">${l}</button>`).join("")}
      </div>
      <button class="cle-btn" data-r="undo" title="Undo (Ctrl+Z)">Undo</button>
      <button class="cle-btn" data-r="redo" title="Redo (Ctrl+Shift+Z)">Redo</button>
      <span class="cle-status" data-r="status" role="status" aria-live="polite"></span>
      <button class="cle-btn cle-iconbtn" data-r="paneltoggle" aria-pressed="true" title="Show or hide the panel (P)">${icon("panel")}<span>Panel</span></button>
      <a class="cle-btn" href="${esc(opts.viewUrl)}">View page</a>
      <button class="cle-btn primary" data-r="save">Save</button>
    </header>
    <div class="cle-help">
      <span><b>Click</b> ${P ? "a card" : "an ad"}, <b>click again</b> to go inside, <b>Esc</b> goes up</span>
      <span><b>Drag</b> any part: into a row, another ${thing}, or out</span>
      <span><b>Double-click</b> text to type</span>
      <span><b>Right-click</b> for more</span>
      <span><b>G</b> grid <b>Ctrl+G</b> group in a row <b>V H T P</b> tools</span>
      ${P ? "<span>Edit any card: <b>every card follows</b></span>" : ""}
    </div>
    <div class="cle-main" data-r="main">
      <aside class="cle-pane cle-left" aria-label="Add" data-r="rail"></aside>
      <main class="cle-canvas" data-r="canvas">
        <div class="cle-tools" data-r="tools" role="toolbar" aria-label="Tools and view">
          <button data-tool="select" aria-pressed="true" title="Select (V)" aria-label="Select">${icon("tool-select")}</button>
          <button data-tool="hand" aria-pressed="false" title="Hand: drag to pan (H)" aria-label="Hand">${icon("tool-hand")}</button>
          <button data-tool="text" aria-pressed="false" title="Text: click where words should go (T)" aria-label="Text">${icon("tool-text")}</button>
          <span class="cle-tsep"></span>
          <button data-r="gridlines" aria-pressed="false" title="Show the grid (G)" aria-label="Show the grid">${icon("gridlines")}</button>
          <button data-r="snap" aria-pressed="true" title="Snap sizes to the grid" aria-label="Snap to the grid">${icon("magnet")}</button>
          <span class="cle-tsep"></span>
          <button data-r="zoomout" title="Zoom out (-)" aria-label="Zoom out">${icon("zoom-out")}</button>
          <button data-r="zoomlabel" class="cle-zoomlabel" title="Back to 100%" aria-label="Zoom level">100%</button>
          <button data-r="zoomin" title="Zoom in (+)" aria-label="Zoom in">${icon("zoom-in")}</button>
          <button data-r="zoomfit" title="Fit to width (Shift+0)" aria-label="Fit to width">${icon("fit")}</button>
          <span class="cle-tsep"></span>
          <button data-r="phone" aria-pressed="false" title="Phone-width preview" aria-label="Phone-width preview">${icon("phone")}</button>
        </div>
        <div class="cle-wrap" data-r="wrap">
          <div class="cle-page" data-r="page"><div class="cl-sheet cle-editing" data-r="sheet"></div></div>
          <div class="de-guides" data-r="guides"></div>
          <div class="cle-overlay" data-r="overlay"></div>
        </div>
      </main>
      <aside class="cle-pane cle-right" aria-label="Inspector" data-r="panel"></aside>
    </div>
    <div class="cle-hud" data-r="hud"></div>`;
  const R = (n: string) => root.querySelector(`[data-r="${n}"]`) as HTMLElement;
  const $sheet = R("sheet"), $wrap = R("wrap"), $panel = R("panel"), $canvas = R("canvas"), $guides = R("guides");

  // ------------------------------------------------------------ state helpers
  const adById = (id: string) => doc.ads.find((a) => a.id === id) as Ad;
  const eff = (ad: Ad) => effective(doc, ad);
  const tpl = (id: string) => templateOf(doc, id);
  const grid = () => gridOfDoc(doc);
  const limit = () => Math.max(1, Math.min(24, doc.limit ?? 6));
  const items = (): Item[] => (P ? P.items.slice(0, limit()) : []);
  const kindOf = (ad: Ad, id: string): Kind => (id === ROOT ? "frame" : (eff(ad).kinds[id] ?? "body"));
  const isBox = (ad: Ad, id: string) => kindOf(ad, id) === "box";
  const exists = (r: Sel | null) => !!r && !!adById(r.node) && (r.part === ROOT || !!eff(adById(r.node)).kinds[r.part]);
  const fixSel = () => { if (sel && !exists(sel)) sel = sel && adById(sel.node) ? { node: sel.node, part: ROOT } : null; };
  /** The container a node sits in: ROOT (the ad) or a box id. */
  function parentOf(ad: Ad, id: string): string {
    const f = findNode(treeOf(doc, ad), id);
    return f?.parent ? f.parent.id : ROOT;
  }
  const upOf = (r: Sel | null): Sel | null => (!r ? null : r.part === ROOT ? null : { node: r.node, part: parentOf(adById(r.node), r.part) });
  function envFor(ad: Ad, e: Effective, id: string): Env {
    const kind: Kind = id === ROOT ? "frame" : (e.kinds[id] ?? "body");
    const pid = id === ROOT ? null : parentOf(ad, id);
    const pst = pid === null ? undefined : e.parts[pid] ?? {};
    return {
      fam: e.fam, part: kind, st: e.parts[id] ?? {},
      parent: pid === null ? undefined : { kind: pid === ROOT ? "frame" : "box", layout: pst?.layout, cols: pst?.gcols ?? 2, dir: pst?.dir },
      grid: { cols: grid().cols, maxRows: maxRows(grid()) },
      paper: paperNow(),
    };
  }
  /** The paper the blocks are drawn on: the sheet's, or white behind feed cards. */
  const paperNow = () => (P ? "#ffffff" : paperOf(doc));
  const slotsFor = (ad: Ad, id: string, level: Freedom = freedom) => { const e = eff(ad); return resolveSlots(PART_SCHEMA[kindOf(ad, id)], level, envFor(ad, e, id)); };
  const offers = (slots: ResolvedSlot<any>[], key: string) => slots.find((s) => s.key === key && s.allowed);
  /** Template value of one node: family / kind defaults, the sheet's shared fonts, then the template (unless the family was swapped). */
  const baseOf = (ad: Ad, id: string): PartStyle => baseParts(doc, ad).base[id] ?? {};
  const overridesOf = (ad: Ad, id: string): PartStyle => (ad.o.parts && ad.o.parts[id]) || {};
  function outsideOf(ad: Ad, id: string): string[] {
    const e = eff(ad), st = (e.parts[id] ?? {}) as Record<string, unknown>;
    return outsideKeys(slotsFor(ad, id), Object.keys(overridesOf(ad, id)), (k) => st[k]);
  }
  const allIds = (ad: Ad) => [ROOT, ...treeIds(treeOf(doc, ad))];
  const copyOf = (ad: Ad, id: string) => eff(ad).copy[id] ?? "";
  /** A node id no ad uses yet. */
  function newId(): string {
    const used = new Set(doc.ads.flatMap((a) => treeIds(treeOf(doc, a))));
    let id: string;
    do { id = "n" + doc.next++; } while (used.has(id));
    return id;
  }

  // ------------------------------------------------------------------ edits
  /** Drop overrides that say nothing: empty, for nodes no longer in the tree, or a tree equal to the template's. */
  function tidy(ad: Ad) {
    if (ad.o.tree && JSON.stringify(cloneTree(ad.o.tree)) === JSON.stringify(cloneTree(templateTree(tpl(ad.template))))) delete ad.o.tree;
    const ids = new Set(allIds(ad));
    if (ad.o.parts) {
      for (const p of Object.keys(ad.o.parts)) if (!ids.has(p) || !Object.keys(ad.o.parts[p] || {}).length) delete ad.o.parts[p];
      if (!Object.keys(ad.o.parts).length) delete ad.o.parts;
    }
    if (ad.o.copy) {
      for (const k of Object.keys(ad.o.copy)) if (!ids.has(k) || k === ROOT) delete ad.o.copy[k];
      if (!Object.keys(ad.o.copy).length) delete ad.o.copy;
    }
  }
  /** Write one key; equal to the template value (or "off") means no override. */
  function writeKey(ad: Ad, id: string, key: string, value: unknown) {
    ad.o.parts = ad.o.parts || {};
    const o: Record<string, unknown> = { ...(ad.o.parts[id] || {}) };
    const base = baseOf(ad, id) as Record<string, unknown>;
    if (typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value)) value = normHex(value) ?? value;
    // Raw CSS is stored exactly as the server will keep it (catalog.ts safeDecls).
    if (key === "css") value = declsToString(safeDecls(typeof value === "string" ? value.slice(0, 600) : "")) || undefined;
    const implicit = base[key] === undefined && IMPLICIT[key] === value;
    if (value === undefined || value === null || implicit || JSON.stringify(base[key]) === JSON.stringify(value)) delete o[key];
    else o[key] = value;
    ad.o.parts[id] = o as PartStyle;
  }
  function setPart(adId: string, id: string, key: string, value: unknown, coalesce?: boolean) {
    const ad = adById(adId); if (!ad) return;
    history.remember(coalesce ? adId + id + key : null);
    writeKey(ad, id, key, value);
    if (key === "font" && typeof value === "string") loadFont(value);
    tidy(ad); renderAll();
  }
  /** Several keys in one step; null removes a key. */
  function setStyle(adId: string, id: string, style: Record<string, unknown>) {
    const ad = adById(adId); if (!ad) return;
    history.remember(null);
    for (const [k, v] of Object.entries(style)) if (v !== undefined) writeKey(ad, id, k, v);
    tidy(ad); renderAll();
  }
  /** Words of a node (or a picture's source) as the server will keep them; equal to the template's means no override. */
  function putCopy(ad: Ad, id: string, text: string) {
    ad.o.copy = ad.o.copy || {};
    const clean = cleanCopyText(kindOf(ad, id), text) ?? "";
    if ((tpl(ad.template).copy[id] ?? "") === clean && id in tpl(ad.template).copy) delete ad.o.copy[id]; else ad.o.copy[id] = clean;
  }
  function setCopy(adId: string, id: string, text: string, quiet?: boolean) {
    const ad = adById(adId); history.remember(quiet ? adId + id + "copy" : null);
    putCopy(ad, id, text);
    tidy(ad);
    if (quiet) { renderSheet(); renderPanel(); renderOverlay(); renderStatus(); } else renderAll();
  }
  function setSpan(adId: string, span: [number, number] | null, keep = false) {
    const ad = adById(adId); history.remember("span" + adId);
    const t = spanOfTemplate(ad);
    if (!span || (!keep && t[0] === span[0] && t[1] === span[1])) delete ad.o.span; else ad.o.span = [Math.max(1, Math.min(grid().cols, span[0])), Math.max(1, Math.min(maxRows(grid()), span[1]))];
    renderAll();
  }
  /** The template's span on this sheet's grid. */
  const spanOfTemplate = (ad: Ad): [number, number] => { const t = tpl(ad.template), g = grid(); return sameGrid(g, GRID_DEFAULT) ? [...t.span] as [number, number] : scaleSpan(t.span, GRID_DEFAULT, g); };
  function setFamily(adId: string, famId: string | null) {
    const ad = adById(adId); history.remember(null);
    if (!famId || famId === tpl(ad.template).family) delete ad.o.family; else ad.o.family = famId;
    renderAll();
  }
  function setLink(adId: string, link: Ad["link"], coalesce?: boolean) { const ad = adById(adId); history.remember(coalesce ? adId + "link" : null); ad.link = link; renderAll(); }
  /** One of the sheet's shared variables (the Tweaks tab); undefined returns it to the family's. */
  function setTheme(key: string, value: unknown, coalesce = false) {
    if (!["paper", "ink", "spot", "title", "body"].includes(key)) return;
    history.remember(coalesce ? "theme" + key : null);
    const t: Record<string, unknown> = { ...(doc.theme || {}) };
    if (typeof value === "string" && value) t[key] = THEME_FONT.has(key) ? value : (normHex(value) ?? value); else delete t[key];
    if (Object.keys(t).length) doc.theme = t as Theme; else delete doc.theme;
    if (THEME_FONT.has(key) && typeof value === "string") loadFont(value);
    renderAll();
  }
  /**
   * The sheet's grid (pass 3). Stored spans are rescaled so every ad keeps its
   * size on the new grid; a run of edits to one field rescales from where the
   * run started, so typing a row height does not drift.
   */
  function setGrid(key: "cols" | "gap" | "row", value: number | undefined, coalesce = false) {
    const now = Date.now();
    if (!gridEdit || gridEdit.key !== key || now - gridEdit.at > 1200 || !coalesce) {
      gridEdit = { key, at: now, base: grid(), spans: Object.fromEntries(doc.ads.filter((a) => a.o.span).map((a) => [a.id, [...a.o.span!] as [number, number]])) };
    }
    gridEdit.at = now;
    history.remember(coalesce ? "grid" + key : null);
    const next: GridSpec = { ...gridEdit.base, [key]: value ?? GRID_DEFAULT[key] };
    for (const ad of doc.ads) {
      const from = gridEdit.spans[ad.id];
      if (from) ad.o.span = scaleSpan(from, gridEdit.base, next);
    }
    if (sameGrid(next, GRID_DEFAULT)) delete doc.grid; else doc.grid = next;
    renderAll();
    flashGrid();
  }
  function setLimit(n: number | undefined, coalesce = false) {
    history.remember(coalesce ? "limit" : null);
    if (n === undefined) delete doc.limit; else doc.limit = Math.max(1, Math.min(24, Math.round(n)));
    if (selInst >= limit()) selInst = 0;
    renderAll();
  }
  function snap(adId: string, id: string) {
    const ad = adById(adId); if (!ad) return;
    const ids = id === ROOT ? allIds(ad) : [id];
    const bad = ids.flatMap((p) => outsideOf(ad, p).map((k) => [p, k] as const));
    if (!bad.length) return;
    history.remember(null);
    for (const [p, k] of bad) delete (ad.o.parts![p] as Record<string, unknown>)[k];
    tidy(ad); renderAll();
    hud(`Snapped ${bad.length} setting${bad.length > 1 ? "s" : ""} back to the family`);
  }

  // ----------------------------------------------------------- structure (pass 3)
  /** May a node of `kind` (its subtree `levels` deep) go into this container at the current level? */
  function mayPlace(kind: Kind, levels: number, toAd: Ad, parentId: string, moving?: { ad: string; id: string }): boolean {
    const tree = treeOf(doc, toAd);
    if (moving && moving.ad === toAd.id && parentId !== ROOT && within(tree, moving.id, parentId)) return false;
    const parentKind = parentId === ROOT ? "frame" : kindOf(toAd, parentId);
    if (parentId !== ROOT && parentKind !== "box") return false;
    const depth = depthOfKids(tree, parentId === ROOT ? null : parentId);
    if (!canPlace(TREE_RULES, kind, parentKind, depth, levels, STRUCTURE[freedom].maxDepth)) return false;
    const adding = moving && moving.ad === toAd.id ? 0 : moving ? countNodes([findNode(treeOf(doc, adById(moving.ad)), moving.id)!.node]) : 1;
    return countNodes(tree) + adding <= TREE_RULES.maxNodes;
  }
  /** Commit a new tree for an ad (callers remember history first). */
  function commitTree(ad: Ad, tree: TreeNode[]) { ad.o.tree = tree; tidy(ad); }
  const toParent = (id: string) => (id === ROOT ? null : id);

  /** Move a node to a container (in the same ad or another), at an index among that container's kids without it. */
  function moveNodeTo(from: { ad: string; id: string }, toAdId: string, parentId: string, index: number) {
    const src = adById(from.ad), dst = adById(toAdId);
    if (!src || !dst) return;
    if (src === dst) {
      const t = cloneTree(treeOf(doc, src));
      const before = JSON.stringify(t);
      if (!moveNode(t, from.id, toParent(parentId), index)) return;
      if (JSON.stringify(t) === before) { hud("Same place"); return; }
      history.remember(null);
      commitTree(src, t);
      sel = { node: src.id, part: from.id };
      renderAll(); hud(parentId === ROOT ? `Moved in the ${thing}` : "Moved into the box");
      return;
    }
    // Across ads: the node keeps its words and its own settings, and takes the destination's family.
    const se = eff(src);
    const st = cloneTree(treeOf(doc, src));
    const moved = removeNode(st, from.id);
    if (!moved) return;
    history.remember(null);
    const dt = cloneTree(treeOf(doc, dst));
    const taken = new Set([...treeIds(dt), ...doc.ads.filter((a) => a !== src && a !== dst).flatMap((a) => treeIds(treeOf(doc, a)))]);
    const carried: Array<[string, string]> = [];
    walk([moved], (n) => {
      const old = n.id;
      if (taken.has(n.id)) n.id = newId();
      taken.add(n.id);
      carried.push([old, n.id]);
    });
    for (const [old, nid] of carried) {
      const style = src.o.parts?.[old];
      if (style) { dst.o.parts = dst.o.parts || {}; dst.o.parts[nid] = clone(style); }
      const words = se.copy[old];
      if (words !== undefined && kindOf(src, old) !== "box" && kindOf(src, old) !== "rule") { dst.o.copy = dst.o.copy || {}; dst.o.copy[nid] = words; }
    }
    insertNode(dt, toParent(parentId), index, moved);
    commitTree(src, st);
    commitTree(dst, dt);
    // A copied value equal to the destination template's is no override.
    for (const [, nid] of carried) if (dst.o.copy && dst.o.copy[nid] !== undefined && tpl(dst.template).copy[nid] === dst.o.copy[nid]) delete dst.o.copy[nid];
    tidy(dst);
    sel = { node: dst.id, part: moved.id };
    renderAll(); hud(`Moved into "${plainCopy(eff(dst).copy.title) || "the other " + thing}"`);
  }
  /** Insert a new node (from the palette, a field, the Text tool). */
  function insertNew(adId: string, parentId: string, index: number, ins: { kind: Exclude<Kind, "frame">; style?: PartStyle; words?: string }): string | null {
    const ad = adById(adId); if (!ad) return null;
    if (!mayPlace(ins.kind, 1, ad, parentId)) { hud(`No room for that here at ${FREEDOM_LABEL[freedom]} (${STRUCTURE[freedom].label})`); return null; }
    history.remember(null);
    const id = newId();
    const t = cloneTree(treeOf(doc, ad));
    insertNode(t, toParent(parentId), index, ins.kind === "box" ? { id, kind: "box", kids: [] } : { id, kind: ins.kind });
    commitTree(ad, t);
    if (ins.style) for (const [k, v] of Object.entries(ins.style)) writeKey(ad, id, k, v);
    if (ins.words !== undefined) putCopy(ad, id, ins.words);
    tidy(ad);
    sel = { node: ad.id, part: id };
    renderAll();
    return id;
  }
  /** Where a new node goes when added by a click: into the selected box, after the selected part, or at the end of the selected ad. */
  function insertionPoint(kind: Kind): { ad: string; parent: string; index: number } | null {
    const ad = sel ? adById(sel.node) : P ? doc.ads[0] : null;
    if (!ad) return null;
    const id = sel && sel.node === ad.id ? sel.part : ROOT;
    if (id === ROOT || isBox(ad, id)) {
      const kids = id === ROOT ? treeOf(doc, ad) : findNode(treeOf(doc, ad), id)!.node.kids ?? [];
      if (mayPlace(kind, 1, ad, id)) return { ad: ad.id, parent: id, index: kids.length };
    }
    const pid = id === ROOT ? ROOT : parentOf(ad, id);
    const f = id === ROOT ? null : findNode(treeOf(doc, ad), id);
    return { ad: ad.id, parent: pid, index: f ? f.index + 1 : treeOf(doc, ad).length };
  }
  function insertByClick(ins: Insertable | { kind: Exclude<Kind, "frame">; label: string; words?: string; style?: PartStyle }) {
    const at = insertionPoint(ins.kind);
    if (!at) { hud(`Select ${P ? "the card" : "an ad"} first`); return; }
    const id = insertNew(at.ad, at.parent, at.index, { kind: ins.kind, style: ins.style, words: "words" in ins ? ins.words : isTextKind(ins.kind) && !P ? "Your text here" : undefined });
    if (id) hud(`Added ${ins.label.toLowerCase()}`);
  }
  function deleteNode(adId: string, id: string) {
    const ad = adById(adId); if (!ad || id === ROOT) return;
    const pid = parentOf(ad, id);
    const t = cloneTree(treeOf(doc, ad));
    if (!removeNode(t, id)) return;
    history.remember(null);
    commitTree(ad, t);
    sel = { node: ad.id, part: pid };
    renderAll(); hud("Deleted. Undo brings it back.");
  }
  function duplicateNode(adId: string, id: string) {
    const ad = adById(adId); if (!ad || id === ROOT) return;
    const f = findNode(treeOf(doc, ad), id); if (!f) return;
    // A copy sits beside the original (same depth), so only the size of the tree can refuse it.
    if (countNodes(treeOf(doc, ad)) + countNodes([f.node]) > TREE_RULES.maxNodes) { hud("This " + thing + " is full"); return; }
    history.remember(null);
    const e = eff(ad);
    const copy = cloneTree([f.node])[0]!;
    const map: Array<[string, string]> = [];
    walk([copy], (n) => { const nid = newId(); map.push([n.id, nid]); n.id = nid; });
    const t = cloneTree(treeOf(doc, ad));
    insertNode(t, toParent(parentOf(ad, id)), f.index + 1, copy);
    commitTree(ad, t);
    for (const [old, nid] of map) {
      const s = e.parts[old];
      if (s && old !== ROOT) { const own = overridesOf(ad, old); ad.o.parts = ad.o.parts || {}; ad.o.parts[nid] = { ...((tpl(ad.template).parts?.[old]) ?? {}), ...clone(own) }; }
      const w = e.copy[old];
      if (w !== undefined && kindOf(ad, old) !== "box" && kindOf(ad, old) !== "rule") putCopy(ad, nid, w);
    }
    tidy(ad);
    sel = { node: ad.id, part: copy.id };
    renderAll(); hud("Duplicated");
  }
  function wrapInBox(adId: string, id: string, which: "row" | "column" | "grid" = "row") {
    const ad = adById(adId); if (!ad || id === ROOT) return;
    const f = findNode(treeOf(doc, ad), id); if (!f) return;
    if (f.depth + subtreeDepth(f.node) > STRUCTURE[freedom].maxDepth || (which === "grid" && freedom < 1)) { hud(`Too deep to group at ${FREEDOM_LABEL[freedom]} (${STRUCTURE[freedom].label})`); return; }
    if (countNodes(treeOf(doc, ad)) >= TREE_RULES.maxNodes) { hud("This " + thing + " is full"); return; }
    history.remember(null);
    const bid = newId();
    const t = cloneTree(treeOf(doc, ad));
    wrapNode(t, id, { id: bid, kind: "box", kids: [] });
    commitTree(ad, t);
    const style = INSERTS.find((x) => x.id === which)?.style;
    if (style) for (const [k, v] of Object.entries(style)) writeKey(ad, bid, k, v);
    tidy(ad);
    sel = { node: ad.id, part: bid };
    renderAll(); hud(`Grouped in a ${which}. Drag other parts into it.`);
  }
  function unwrapBox(adId: string, id: string) {
    const ad = adById(adId); if (!ad || !isBox(ad, id)) return;
    const f = findNode(treeOf(doc, ad), id)!;
    const first = f.node.kids?.[0]?.id;
    const t = cloneTree(treeOf(doc, ad));
    unwrapNode(t, id);
    history.remember(null);
    commitTree(ad, t);
    sel = { node: ad.id, part: first ?? parentOf(ad, id) };
    renderAll(); hud("Ungrouped");
  }
  function moveWithin(adId: string, id: string, where: "first" | "last" | "earlier" | "later") {
    const ad = adById(adId); const f = findNode(treeOf(doc, ad), id); if (!f) return;
    const n = f.siblings.length;
    const j = where === "first" ? 0 : where === "last" ? n - 1 : where === "earlier" ? f.index - 1 : f.index + 1;
    if (j < 0 || j >= n || j === f.index) return;
    const t = cloneTree(treeOf(doc, ad));
    moveNode(t, id, toParent(parentOf(ad, id)), j);
    history.remember(null);
    commitTree(ad, t);
    renderAll(); hud(where === "first" ? "Moved to first" : where === "last" ? "Moved to last" : "Moved");
  }

  // ----------------------------------------------------------------- render
  /** The element of a ref: in pattern mode, inside the card it was picked in. */
  function instanceEl(i: number): HTMLElement | null {
    const all = $sheet.querySelectorAll<HTMLElement>("[data-node]");
    return all[Math.min(i, all.length - 1)] ?? null;
  }
  function find(r: NodeRef | null, which: "sel" | "hover" = "sel"): HTMLElement | null {
    if (!r) return null;
    const rootEl = P ? instanceEl(which === "sel" ? selInst : hoverInst) : ($sheet.querySelector(`[data-node="${CSS.escape(r.node)}"]`) as HTMLElement | null);
    if (!rootEl || r.part === ROOT) return rootEl;
    return rootEl.querySelector(`[data-part="${CSS.escape(r.part)}"]`) as HTMLElement | null;
  }
  /**
   * One block's markup. The editor version carries the markers the canvas needs
   * and dims empty or hidden parts; `pub` is what the public page draws (Copy
   * as HTML, Copy as PNG). Both come from the same render plan as the page.
   */
  function adHTML(ad: Ad, pub = false, item?: Item | null, inst?: number) {
    const plan = planAd(doc, ad, { editor: !pub, item: item ?? null, labels: P?.labels, cols: grid().cols });
    const link = !pub && !P && ad.link && ad.link.kind !== "none" ? `<span class="cl-linkmark">${ad.link.kind === "thread" ? "thread →" : "link ↗"}</span>` : "";
    const hid = !pub && plan.hidden;
    const marks = pub ? "" : ` data-node="${esc(ad.id)}"${inst !== undefined ? ` data-inst="${inst}"` : ""}`;
    return `<article class="${plan.cls}${hid ? " cle-hidden" : ""}"${marks} style="${esc(declsToString(plan.decls) + (hid ? ";opacity:.35" : ""))}">${planHTML(plan.kids, !pub)}${link}</article>`;
  }
  function renderSheet() {
    loadFonts(fontsUsed(doc));
    $sheet.setAttribute("style", declsToString(sheetDecls(doc)));
    if (P) {
      const design = doc.ads[0];
      $sheet.className = "cl-sheet cl-list cle-editing" + (viewport.phone ? " cl-phone" : "");
      $sheet.innerHTML = (doc.title ? `<h2 class="cl-listhead">${esc(doc.title)}</h2>` : "") +
        (design ? items().map((it, i) => adHTML(design, false, it, i)).join("") : '<p class="cl-empty">No design.</p>') +
        (design && !items().length ? '<p class="cl-empty">No items to draw yet.</p>' : "");
    } else {
      $sheet.className = "cl-sheet cle-editing" + (viewport.phone ? " cl-phone" : "");
      $sheet.innerHTML = `<div class="cl-masthead">${esc(doc.title || opts.orgName + " Classifieds")}<small>${esc(opts.orgName)}</small></div>` +
        (doc.ads.length ? doc.ads.map((a) => adHTML(a)).join("") : '<p class="cl-empty">No notices yet. Add one from the left.</p>');
    }
    if (showGrid) drawGuides(); else clearGridGuides($guides);
  }
  function boxName(st: PartStyle) { return st.layout === "grid" ? "Grid" : st.dir === "column" ? "Column" : "Row"; }
  function nodeName(ad: Ad, id: string): string {
    const k = kindOf(ad, id);
    if (k === "box") return boxName(eff(ad).parts[id] ?? {});
    return LABEL(k);
  }
  function adName(ad: Ad) { return P ? "Card" : `${plainCopy(eff(ad).copy.header || "Ad").toUpperCase()} ad`; }
  function describe(r: NodeRef) {
    const ad = adById(r.node); if (!ad) return "";
    const e = eff(ad);
    if (r.part === ROOT) return `${adName(ad)} · ${e.span[0]}×${e.span[1]}`;
    const k = kindOf(ad, r.part), st = e.parts[r.part] ?? {};
    if (k === "box") return `${boxName(st)}${st.layout === "grid" ? " · " + (st.gcols ?? 2) + " columns" : ""}`;
    return `${LABEL(k)}${isTextKind(k) && st.font ? " · " + st.font : ""}${isTextKind(k) && st.size ? " " + st.size + "px" : ""}`;
  }
  const viewport = new Viewport($canvas, $wrap, R("page"), { desktopWidth: DESKTOP_W, phoneWidth: PHONE_W, onChange: () => { renderOverlay(); renderZoom(); if (showGrid) drawGuides(); } });
  const overlay = new Overlay({
    scope: $sheet, wrap: $wrap, layer: R("overlay"), describe,
    find: (r, which) => find(r, which),
    reveal: (_r, el) => [...el.querySelectorAll<HTMLElement>("[data-part]")].filter((k) => k.parentElement?.closest("[data-part], [data-node]") === el),
    follow: (r) => {
      if (!P) return [];
      const out: HTMLElement[] = [];
      $sheet.querySelectorAll<HTMLElement>("[data-node]").forEach((el, i) => {
        if (i === selInst) return;
        const t = r.part === ROOT ? el : el.querySelector<HTMLElement>(`[data-part="${CSS.escape(r.part)}"]`);
        if (t) out.push(t);
      });
      return out;
    },
    handles: (r) => (r.part === ROOT && !viewport.phone ? ["e", "s", "se"] : []),
    grips: (r) => [
      ...(r.part !== ROOT || !P ? [["move", "⠿ move", r.part === ROOT ? "Drag to another place on the sheet" : `Drag into a row, another ${thing}, or out`] as [string, string, string]] : []),
      ...(!P && r.part !== ROOT && isTextKind(kindOf(adById(r.node), r.part)) ? [["graft", "graft ⤳", `Drag onto another ad to give it this ${LABEL(kindOf(adById(r.node), r.part)).toLowerCase()}`] as [string, string, string]] : []),
    ],
    quiet: () => !!inline?.active(),
  });
  const renderOverlay = () => {
    $sheet.querySelectorAll("[data-de-sel]").forEach((e) => e.removeAttribute("data-de-sel"));
    find(sel)?.setAttribute("data-de-sel", "");
    overlay.render(sel, hover); renderMini();
  };
  function renderZoom() { R("zoomlabel").textContent = Math.round(viewport.zoom * 100) + "%"; }
  function drawGuides() { drawGridGuides($guides, sheetGeometry($sheet, $guides, grid(), viewport.zoom)); }
  let flashTimer: ReturnType<typeof setTimeout> | undefined;
  /** Show the grid for a moment after it changes (unless it is on). */
  function flashGrid() {
    if (showGrid) return;
    drawGuides();
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { if (!showGrid) clearGridGuides($guides); }, 1400);
  }
  function renderRail() {
    let h = "";
    if (P) {
      h += `<section><h2>Data</h2><p class="cle-note">${esc(P.source ?? "Sample items")}. The design below is drawn for each of the ${items().length} items shown.</p></section>`;
      h += `<section><h2>Fields</h2><p class="cle-note">Click to add, or drag onto a card.</p><div class="cle-chips">` +
        P.fields.map((f) => `<button class="cle-chip" data-field="${esc(f.key)}" title="Add ${esc(f.label)}">${icon(f.type === "image" ? "k-image" : "k-data")}<span>${esc(f.label)}</span></button>`).join("") + "</div></section>";
      if (P.templates?.length) {
        h += `<section><h2>Start from</h2>` + P.templates.filter((id) => BASE_TEMPLATES[id]).map((id) =>
          `<div class="cle-tpl"><span>${esc(BASE_TEMPLATES[id]!.label)}${doc.ads[0]?.template === id ? ' <span class="cle-flag">in use</span>' : ""}</span><button class="cle-btn" data-design="${id}">Use</button><small>${esc(FAMILIES[BASE_TEMPLATES[id]!.family]!.label)}</small></div>`).join("") + "</section>";
      }
    } else {
      const all = { ...Object.fromEntries(Object.entries(BASE_TEMPLATES).filter(([id]) => !isCardTemplate(id))), ...doc.userTemplates };
      h += `<section><h2>Add an ad</h2>` + Object.entries(all).map(([id, t]) =>
        `<div class="cle-tpl"><span>${esc(t.label)}${doc.userTemplates[id] ? ' <span class="cle-flag">yours</span>' : ""}</span><button class="cle-btn" data-add="${id}">Add</button><small>${esc(FAMILIES[t.family]!.label)} · ${t.span[0]}×${t.span[1]}</small></div>`).join("") + "</section>";
    }
    const offered = INSERTS.filter((x) => x.minLevel <= freedom && (!x.pattern || P || freedom === 2));
    h += `<section><h2>Add inside ${P ? "the card" : "an ad"}</h2><p class="cle-note">Click to add to the selection, or drag onto ${P ? "a card" : "an ad"}.</p><div class="cle-chips">` +
      offered.map((x) => `<button class="cle-chip" data-ins="${x.id}" title="Add a ${esc(x.label.toLowerCase())}">${icon(x.kind === "box" ? (x.id === "grid" ? "k-grid" : x.id === "column" ? "dir-col" : "dir-row") : x.kind === "rule" ? "k-rule" : x.kind === "image" ? "k-image" : "text")}<span>${esc(x.label)}</span></button>`).join("") + "</div></section>";
    R("rail").innerHTML = h;
  }
  function renderCrumbs() {
    let h = `<button data-sel="" class="${sel ? "" : "here"}">${P ? "Cards" : "Page"}</button>`;
    if (sel) {
      const ad = adById(sel.node);
      h += `›<button data-sel="${sel.node}:frame" class="${sel.part === ROOT ? "here" : ""}">${esc(adName(ad))}</button>`;
      if (sel.part !== ROOT) {
        const f = findNode(treeOf(doc, ad), sel.part);
        const path: string[] = [];
        let cur = f?.parent?.id;
        while (cur) { path.unshift(cur); cur = findNode(treeOf(doc, ad), cur)?.parent?.id; }
        for (const p of path) h += `›<button data-sel="${sel.node}:${p}">${esc(nodeName(ad, p))}</button>`;
        h += `›<button class="here" data-sel="${sel.node}:${sel.part}">${esc(nodeName(ad, sel.part))}</button>`;
      }
    }
    R("crumbs").innerHTML = h;
  }

  // ------------------------------------------------------------------ panel
  function linkRows(ad: Ad) {
    const l = ad.link || { kind: "none" as const };
    if (P) {
      return `<div class="de-row"><span class="de-label">Each card</span><div class="de-ctl"><div class="de-seg" role="group" aria-label="Link">` +
        (["item", "none"] as const).map((k) => `<button data-link="${k}" aria-pressed="${l.kind === k}">${k === "item" ? "Opens its post" : "Goes nowhere"}</button>`).join("") + "</div></div><span></span></div>";
    }
    let h = `<div class="de-row"><span class="de-label">Goes to</span><div class="de-ctl"><div class="de-seg" role="group" aria-label="Link">` +
      (["none", "thread", "url"] as const).map((k) => `<button data-link="${k}" aria-pressed="${l.kind === k}">${k === "none" ? "Nothing" : k === "thread" ? "A thread" : "A web page"}</button>`).join("") + "</div></div><span></span></div>";
    if (l.kind === "thread") {
      h += opts.threads.length
        ? `<div class="de-row"><label class="de-label" for="cle-thread">Thread</label><div class="de-ctl"><select id="cle-thread" data-linkfield="threadId"><option value="">Choose a thread…</option>${opts.threads.map((t) => `<option value="${esc(t.id)}" ${t.id === l.threadId ? "selected" : ""}>${esc(t.title)}</option>`).join("")}</select></div><span></span></div>`
        : '<p class="de-note">This org has no published public threads yet.</p>';
    } else if (l.kind === "url") {
      h += `<div class="de-row"><label class="de-label" for="cle-url">Destination</label><div class="de-ctl"><input type="text" inputmode="url" id="cle-url" data-linkfield="url" placeholder="https://…" value="${esc(l.url || "")}"></div><span></span></div>` +
        `<div class="de-row"><label class="de-label" for="cle-ulabel">Label</label><div class="de-ctl"><input type="text" id="cle-ulabel" data-linkfield="label" placeholder="Shown on the ad" value="${esc(l.label || "")}"></div><span></span></div>`;
    }
    return h;
  }
  /** The family's type scale, then distinct styles used elsewhere on the page (never the selected part itself). */
  function textStyles(e: Effective): TextStylePreset[] {
    const out: TextStylePreset[] = [];
    const keyOf = (s: PartStyle) => `${s.font}|${s.size}|${s.weight ?? 400}|${s.italic ? 1 : 0}`;
    const seen = new Set<string>();
    const scale = TEXT_KINDS.map((p) => ({ p, s: e.fam.defaults[p] })).sort((a, b) => (b.s.size ?? 0) - (a.s.size ?? 0));
    for (const { p, s } of scale) {
      seen.add(keyOf(s));
      out.push({ id: "fam-" + p, group: `${e.fam.label} scale`, label: `${LABEL(p)} · ${s.font} ${s.size}${s.weight && s.weight >= 600 ? " Bold" : ""}`, style: { font: s.font, size: s.size, weight: s.weight ?? 400, leading: s.leading, italic: s.italic ?? false } });
    }
    let n = 0;
    for (const ad of doc.ads) {
      const ae = eff(ad);
      for (const [id, k] of Object.entries(ae.kinds)) {
        if (!isTextKind(k)) continue;
        const s = ae.parts[id]!;
        if (!s.font || !s.size || seen.has(keyOf(s)) || n >= 8 || (sel && sel.node === ad.id && sel.part === id)) continue;
        seen.add(keyOf(s)); n++;
        out.push({ id: `page-${ad.id}-${id}`, group: "In this page", label: `${s.font} ${s.size}${(s.weight ?? 400) >= 600 ? " Bold" : ""}${s.italic ? " Italic" : ""}`, style: { font: s.font, size: s.size, weight: s.weight ?? 400, leading: s.leading, italic: s.italic ?? false } });
      }
    }
    return out;
  }
  /** The colour behind a node and the colour it is drawn in (for the contrast check). */
  function colours(ad: Ad, e: Effective, id: string): { fg: string; bg: string } {
    const f = e.parts.frame!, st = e.parts[id] ?? {}, k = kindOf(ad, id);
    const paper = P ? "#ffffff" : paperOf(doc);
    const ink = normHex(f.color) ?? e.fam.ink;
    let bg = paper, fg = ink;
    if (f.tone === "tinted") bg = mixHex(paper, ink, 0.07);
    if (f.tone === "reversed") { bg = ink; fg = paper; }
    if (f.fill) bg = f.fill;
    // Boxes between the ad and the node may fill or re-ink.
    let p = findNode(e.tree, id)?.parent;
    const chain: PartStyle[] = [];
    while (p) { chain.unshift(e.parts[p.id] ?? {}); p = findNode(e.tree, p.id)?.parent ?? null; }
    for (const b of chain) { if (b.fill) bg = b.fill; if (b.color) fg = b.color; }
    if (k === "header" && st.variant === "reversed") { bg = f.tone === "reversed" ? paper : ink; fg = f.tone === "reversed" ? ink : paper; }
    if (k === "header" && st.variant === "tab") { bg = e.fam.spot; fg = "#ffffff"; }
    if (st.fill) bg = st.fill;
    if (st.color) fg = st.color;
    return { fg, bg };
  }
  /** Colours already on the page: every block's inks and every colour its nodes are drawn with. */
  function usedColours(): string[] {
    const out = new Set<string>();
    for (const ad of doc.ads) {
      const e = eff(ad);
      for (const c of [e.fam.ink, e.fam.spot]) out.add(c.toLowerCase());
      for (const p of Object.values(e.parts)) for (const k of ["color", "fill", "bcolor"] as const) { const c = normHex((p as PartStyle)[k]); if (c) out.add(c); }
    }
    return [...out];
  }
  const layerKind = (ad: Ad, n: TreeNode): string => (n.kind === "box" ? boxName(eff(ad).parts[n.id] ?? {}).toLowerCase() : n.kind === "rule" ? "rule" : n.kind === "image" ? "image" : "text");
  /** The whole page as a tree: page, ads, their nodes at any depth. */
  function layersAll(): LayerRow[] {
    const rows: LayerRow[] = [{ ref: "", kind: "frame", name: P ? "Cards" : "Page", text: doc.title || (P ? "" : opts.orgName + " Classifieds"), depth: 0 }];
    for (const ad of doc.ads) {
      const e = eff(ad), fref = `${ad.id}:frame`;
      rows.push({ ref: fref, kind: "frame", name: P ? "Card" : "Column", text: `${plainCopy(e.copy.header)} ${plainCopy(e.copy.title)}`.trim(), depth: 1, parent: "", selected: sel?.node === ad.id && sel.part === ROOT, link: !!ad.link && ad.link.kind !== "none", hidden: !!e.parts.frame!.hide, canHide: true, draggable: !P });
      walk(e.tree, (n, parent, depth) => {
        const k = n.kind as Kind;
        const text = isTextKind(k) ? plainCopy(e.copy[n.id]) || LABEL(k) : k === "image" ? (soleToken(e.copy[n.id]) ? "from " + soleToken(e.copy[n.id]) : "") : "";
        rows.push({ ref: `${ad.id}:${n.id}`, kind: layerKind(ad, n), name: k === "box" ? boxName(e.parts[n.id] ?? {}) : isTextKind(k) ? (k === "title" ? "Heading" : k === "body" ? "Paragraph" : "Text") : LABEL(k), text, depth: 1 + depth, parent: parent ? `${ad.id}:${parent.id}` : fref, selected: sel?.node === ad.id && sel.part === n.id, hidden: !!e.parts[n.id]?.hide, canHide: true, draggable: true });
      });
    }
    return rows;
  }
  function savedHTML(ad: Ad | null) {
    if (!ad) return `<div class="de-code"><p class="de-note">Select ${P ? "the card" : "an ad"} to see the record stored for it.</p><pre class="de-decls">${esc(JSON.stringify({ title: doc.title, theme: doc.theme, grid: doc.grid ?? "6 columns, 10px gutter, 34px rows (default)", ...(P ? { limit: doc.limit } : { ads: doc.ads.length, yourTemplates: Object.keys(doc.userTemplates).length }) }, null, 2))}</pre></div>`;
    const o = ad.o; let n = (o.family ? 1 : 0) + (o.span ? 1 : 0) + (o.tree ? 1 : 0) + Object.keys(o.copy || {}).length;
    for (const p of Object.values(o.parts || {})) n += Object.keys(p as object).length;
    return `<div class="de-code"><p class="de-note">Template "${esc(tpl(ad.template).label)}" plus ${n} change${n === 1 ? "" : "s"}${o.tree ? " (including its own structure)" : ""}${ad.link && ad.link.kind !== "none" ? " and a link" : ""}${doc.theme ? " and the sheet's shared variables" : ""}. The rest comes from the family and template, so improving them improves this ${thing}.</p><pre class="de-decls" data-r="data">${esc(JSON.stringify(doc.theme ? { ...ad, sheetTheme: doc.theme } : ad, null, 2))}</pre></div>`;
  }
  /** Values the page actually draws for the selected element: shown in every field that holds none of its own. */
  function computedFor(el: HTMLElement | null, isFrame: boolean): Record<string, unknown> {
    if (!el) return {};
    const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize) || 12;
    const px = (v: string) => r2(parseFloat(v) || 0);
    const quad = (a: string, b: string, c: string, d: string) => { const q = [px(a), px(b), px(c), px(d)]; return q.every((x) => x === q[0]) ? q[0] : q; };
    const out: Record<string, unknown> = {
      leading: cs.lineHeight === "normal" ? 1.2 : r2(parseFloat(cs.lineHeight) / fs),
      tracking: cs.letterSpacing === "normal" ? 0 : r2(parseFloat(cs.letterSpacing) / fs),
      padding: quad(cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft),
      margin: quad(cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft),
      gap: px(cs.rowGap), grow: parseFloat(cs.flexGrow) || 0, x: 0, y: 0,
      opacity: parseFloat(cs.opacity), radius: quad(cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius),
      bwidth: px(cs.borderTopWidth), bcolor: rgbHex(cs.borderTopColor) ?? rgbHex(cs.color), fill: rgbHex(cs.backgroundColor),
      blur: 0, bblur: 0, tx: 0, ty: 0, rot: 0, sx: 1, sy: 1,
      wpx: el.offsetWidth, hpx: el.offsetHeight, w: el.offsetWidth, h: el.offsetHeight,
      align: cs.textAlign === "start" ? "left" : cs.textAlign === "end" ? "right" : cs.textAlign,
      color: rgbHex(cs.color),
      weight: Number(cs.fontWeight) || 400, size: px(cs.fontSize),
      gcols: cs.display.includes("grid") ? cs.gridTemplateColumns.split(" ").filter(Boolean).length : 2,
      cspan: 1,
    };
    if (isFrame) out.color = rgbHex(cs.color);
    const props: Record<string, string> = { "z-index": "z-index", overflow: "overflow", "white-space": "white-space", "text-overflow": "text-overflow", "word-break": "word-break", hyphens: "hyphens", "mix-blend-mode": "mix-blend-mode", "text-shadow": "text-shadow", cursor: "cursor", "text-decoration": "text-decoration-line", "text-indent": "text-indent", "box-shadow": "box-shadow" };
    for (const [k, p] of Object.entries(props)) out["css:" + k] = cs.getPropertyValue(p).trim() || "none";
    return out;
  }
  /** The node's values as the panel shows them (stored or derived from the family). */
  function valuesFor(ad: Ad, id: string, el: HTMLElement | null): { values: Record<string, unknown>; overridden: Record<string, boolean>; comp: Record<string, unknown> } {
    const e = eff(ad), st = e.parts[id] ?? {}, k = kindOf(ad, id), isFrame = id === ROOT;
    const o = overridesOf(ad, id);
    const comp = computedFor(el, isFrame);
    const values: Record<string, unknown> = { ...st };
    const overridden: Record<string, boolean> = {};
    for (const key of Object.keys(o)) overridden[key] = true;
    if (k === "frame" || k === "box") {
      values.layout = st.layout ?? "stack";
      values.dir = st.dir ?? "column";
      values.items = st.items ?? "stretch";
      values.wrap = st.wrap ?? false;
    }
    if (isFrame) {
      const t = spanOfTemplate(ad);
      values.family = e.famId;
      values.colSpan = e.span[0];
      values.rowSpan = e.span[1];
      values.wmode = !ad.o.span ? "hug" : e.span[0] === grid().cols ? "fill" : "fixed";
      values.hmode = !ad.o.span || ad.o.span[1] === t[1] ? "hug" : "fixed";
      if (ad.o.family) overridden.family = true;
      if (ad.o.span) { overridden.colSpan = ad.o.span[0] !== t[0]; overridden.rowSpan = ad.o.span[1] !== t[1]; overridden.wmode = true; overridden.hmode = ad.o.span[1] !== t[1]; }
    } else {
      const variant = st.variant;
      values.self = st.self ?? (k === "header" && variant === "boxed" ? "center" : k === "header" && variant === "tab" ? "start" : "stretch");
      values.push = st.push ?? "start";
      values.pos = st.pos ?? "inline";
      values.italic = st.italic ?? false;
      values.case = st.case ?? "none";
      values.weight = st.weight ?? 400;
      if (isTextKind(k) && !st.color) values.color = colours(ad, e, id).fg;
      values.wmode = st.w !== undefined ? "fixed" : values.self === "stretch" ? "fill" : "hug";
      values.hmode = st.h !== undefined ? "fixed" : (st.grow ?? (comp.grow as number) ?? 0) > 0 ? "fill" : "hug";
      if (st.w !== undefined) values.wpx = st.w;
      if (st.h !== undefined) values.hpx = st.h;
      overridden.wmode = o.self !== undefined || o.w !== undefined;
      overridden.hmode = o.grow !== undefined || o.h !== undefined;
      if (isTextKind(k) && !st.align) values.align = values.align ?? (comp.align as string);
      if (k === "image") { values.ratio = st.ratio ?? "auto"; values.fit = st.fit ?? "cover"; }
      if (k === "rule") { values.bstyle = st.bstyle ?? "solid"; values.bwidth = st.bwidth ?? 1; }
    }
    return { values, overridden, comp };
  }
  function tweaksCtx(e?: Effective) {
    const fam = e?.fam ?? FAMILIES.broadsheet!;
    const t = doc.theme || {};
    const slots = resolveSlots(TWEAK_SCHEMA, freedom, null);
    const values: Record<string, unknown> = {
      "tw.paper": paperOf(doc), "tw.ink": t.ink ?? fam.ink, "tw.spot": t.spot ?? fam.spot,
      "tw.title": t.title ?? fam.display[0], "tw.body": t.body ?? fam.body[0],
    };
    const overridden: Record<string, boolean> = {};
    for (const k of ["paper", "ink", "spot", "title", "body"] as const) if (t[k]) overridden["tw." + k] = true;
    return {
      slots, values, overridden,
      fonts: { inPage: fontsUsed(doc), family: EVERY_FAMILY_FONT, library: freedom === 2 },
      palette: tweakGroups(),
      note: `Change one and every ${thing} that uses it follows: paper is the sheet, ink and spot colour the rules, tabs and text, the title and body fonts are the families' defaults. Reset returns a variable to each family's own.`,
    };
  }
  /** Pattern mode: where a node's words or picture come from. */
  function dataRows(ad: Ad, id: string): string {
    if (!P) return "";
    const k = kindOf(ad, id), raw = copyOf(ad, id), bound = soleToken(raw);
    const fields = P.fields.filter((f) => (k === "image" ? f.type === "image" : f.type !== "image"));
    const cur = items()[selInst];
    if (k === "image") {
      return `<div class="de-row"><label class="de-label" for="cle-src">Picture from</label><div class="de-ctl"><select id="cle-src" data-bind="src"><option value="">A web address</option>${fields.map((f) => `<option value="${esc(f.key)}" ${bound === f.key ? "selected" : ""}>${esc(f.label)}</option>`).join("")}</select></div><span></span></div>` +
        (bound ? "" : `<div class="de-row"><label class="de-label" for="cle-srcurl">Address</label><div class="de-ctl"><input type="text" id="cle-srcurl" data-bind="url" placeholder="https://…" value="${esc(raw)}"></div><span></span></div>`) +
        `<p class="de-note">${bound ? `Each card shows its own ${esc(P.fields.find((f) => f.key === bound)?.label.toLowerCase() ?? bound)}; cards without one leave it out.` : "The same picture on every card."}</p>`;
    }
    return `<div class="de-row"><label class="de-label" for="cle-bind">Comes from</label><div class="de-ctl"><select id="cle-bind" data-bind="words"><option value="" ${bound ? "" : "selected"}>${raw && !bound ? "These words (see below)" : "Fixed words"}</option>${fields.map((f) => `<option value="${esc(f.key)}" ${bound === f.key ? "selected" : ""}>${esc(f.label)}</option>`).join("")}</select></div><span></span></div>` +
      `<div class="de-row"><label class="de-label" for="cle-tok">Insert field</label><div class="de-ctl"><select id="cle-tok" data-bind="token"><option value="">Add a field to the words…</option>${fields.map((f) => `<option value="${esc(f.key)}">${esc(f.label)} {{${esc(f.key)}}}</option>`).join("")}</select></div><span></span></div>` +
      `<p class="de-note">${bound ? `Each card shows its own ${esc(P.fields.find((f) => f.key === bound)?.label.toLowerCase() ?? bound)}${cur ? ` (this one: “${esc(String(cur[bound] ?? "").slice(0, 60) || "empty, so it is left out")}”)` : ""}.` : "Words in {{double braces}} are filled from each item; the rest is the same on every card."}</p>`;
  }
  function pagePanel(): PanelContext {
    const layers = layersAll();
    const g = grid();
    const slots = [...resolveSlots(PAGE_SCHEMA, freedom, null), ...(P ? resolveSlots({ label: "List", slots: LIST_SLOTS }, freedom, null) : [])];
    const values: Record<string, unknown> = { "grid.cols": g.cols, "grid.gap": g.gap, "grid.row": g.row, "list.limit": limit() };
    const overridden: Record<string, boolean> = { "grid.cols": g.cols !== GRID_DEFAULT.cols, "grid.gap": g.gap !== GRID_DEFAULT.gap, "grid.row": g.row !== GRID_DEFAULT.row, "list.limit": doc.limit !== undefined };
    const outside = slots.filter((s) => s.allowed && !fitsAllowed(s.allowed, values[s.key])).map((s) => s.key);
    return {
      key: "page", heading: P ? "Cards" : "Page", sub: `${g.cols}-column grid`, freedom, slots, values, overridden, outside, layers, theme: [], used: [],
      extra: {
        layout: `<p class="de-note">Every ${thing} snaps to these columns and rows when it is resized; ${freedom === 2 ? "turn Snap off (or hold Alt) for an exact size" : "exact sizes come with Free"}. Changing the grid keeps each ${thing}'s size.</p>`,
        text: `<div class="de-row"><label class="de-label" for="cle-title">${P ? "Heading" : "Title"}</label><div class="de-ctl"><input type="text" id="cle-title" value="${esc(doc.title || "")}" placeholder="${P ? "None" : esc(opts.orgName) + " Classifieds"}"></div><span></span></div><p class="de-note">Click ${P ? "a card" : "an ad"} to select it. Click again to go inside; drag any part to move it.</p>`,
      },
      tweaks: tweaksCtx(), saved: savedHTML(null),
    };
  }
  const fitsAllowed = (a: { list?: readonly unknown[]; range?: readonly [number, number] }, v: unknown) => (a.list ? a.list.includes(v as never) : a.range && typeof v === "number" ? v >= a.range[0] && v <= a.range[1] : true);
  function panelCtx(): PanelContext {
    if (!sel) return pagePanel();
    const layers = layersAll();
    const ad = adById(sel.node), e = eff(ad), id = sel.part, isFrame = id === ROOT, k = kindOf(ad, id);
    const st = e.parts[id] ?? {};
    const slots = slotsFor(ad, id);
    const el = find(sel);
    const { values, overridden, comp } = valuesFor(ad, id, el);
    const outside = isFrame ? allIds(ad).flatMap((p) => outsideOf(ad, p).map((key) => (p === ROOT ? key : `${p}.${key}`))) : outsideOf(ad, id);
    const role = k === "body" || k === "contact" ? "body" : "display";
    const text = isTextKind(k);
    const c = colours(ad, e, id);
    const bottom = `<button class="cle-btn" data-cact="copy">Copy style</button><button class="cle-btn" data-cact="paste" ${clip ? "" : "disabled"}>Paste style</button>` +
      (isFrame
        ? (P ? "" : '<button class="cle-btn" data-cact="savetpl">Save as template</button><button class="cle-btn" data-cact="dup">Duplicate</button><button class="cle-btn" data-cact="earlier">Move earlier</button><button class="cle-btn" data-cact="later">Move later</button><button class="cle-btn" data-cact="del">Delete</button>')
        : `<button class="cle-btn" data-cact="dup">Duplicate</button>${k === "box" ? '<button class="cle-btn" data-cact="ungroup">Ungroup</button>' : '<button class="cle-btn" data-cact="group">Group in a row</button>'}<button class="cle-btn" data-cact="up">Select parent</button><button class="cle-btn" data-cact="del">Delete</button>`);
    // Inherited values and the shared variables they come from (the Code tab).
    const tokens: Record<string, string> = {};
    for (const [key, v] of [["paper", paperOf(doc)], ["spot", e.fam.spot], ["ink", e.fam.ink]] as const) tokens[v.toLowerCase()] = key;
    if (doc.theme?.title) tokens[doc.theme.title.toLowerCase()] = "title";
    if (doc.theme?.body) tokens[doc.theme.body.toLowerCase()] = "body";
    const f = e.parts.frame!;
    const frameInk = normHex(f.color) ?? e.fam.ink;
    const inherited: NonNullable<PanelContext["code"]>["inherited"] = [];
    const tok = (v: string) => tokens[v.toLowerCase()];
    if (isFrame) {
      inherited.push({ from: "sheet", prop: "--paper", value: paperOf(doc), token: tok(paperOf(doc)) });
      inherited.push({ from: ".cl-ad", prop: "color", value: frameInk, token: tok(frameInk) });
    } else {
      if (!st.color) inherited.push({ from: "frame", prop: "color", value: c.fg, token: tok(c.fg) });
      inherited.push({ from: "frame", prop: "--ink", value: frameInk, token: tok(frameInk) });
      inherited.push({ from: "frame", prop: "--spot", value: e.fam.spot, token: tok(e.fam.spot) });
      inherited.push({ from: "sheet", prop: "--paper", value: paperOf(doc), token: tok(paperOf(doc)) });
    }
    styleChoices = text ? textStyles(e) : [];
    const words = text ? `<div class="de-row c-words"><label class="de-label" for="cle-txt">Words</label><div class="de-ctl"><textarea id="cle-txt" rows="${k === "body" ? 4 : 2}">${esc(copyOf(ad, id))}</textarea></div><span></span></div>${richOf(k) ? `<p class="de-note">Bold, italic, underline, links${richOf(k)?.list ? " and bullets" : ""} are kept: &lt;b&gt; &lt;i&gt; &lt;u&gt; &lt;a href&gt;${richOf(k)?.list ? " &lt;ul&gt;&lt;li&gt;" : ""} &lt;br&gt;. Select words on the sheet to use the text bar.</p>` : ""}` : "";
    const extra: PanelContext["extra"] = {};
    if (isFrame) extra.link = linkRows(ad);
    if (text) extra.text = dataRows(ad, id) + words;
    if (k === "image") extra.appearance = P ? dataRows(ad, id) : `<div class="de-row"><label class="de-label" for="cle-srcurl">Address</label><div class="de-ctl"><input type="text" id="cle-srcurl" data-bind="url" placeholder="https://…" value="${esc(copyOf(ad, id))}"></div><span></span></div>`;
    return {
      key: refKey(sel) + (P ? "#" + selInst : ""), heading: isFrame ? adName(ad) : nodeName(ad, id), sub: k === "box" ? `holds ${(findNode(e.tree, id)?.node.kids ?? []).length}` : e.fam.label,
      freedom, slots, values, computed: comp, overridden, outside, layers,
      theme: themeColours(e.fam).map((v) => ({ value: v, label: v === e.fam.ink ? "ink" : v === e.fam.spot ? "spot" : v === paperOf(doc) ? "paper" : undefined })),
      used: usedColours(),
      palette: paletteGroups(e.fam, paperNow()),
      fonts: { inPage: fontsUsed(doc), family: e.fam[role], borrow: freedom >= 1 ? EVERY_FAMILY_FONT : undefined, library: freedom === 2 },
      textStyles: text ? styleChoices : undefined,
      contrast: text ? { fg: c.fg, bg: c.bg, size: st.size, weight: st.weight ?? 400 } : undefined,
      extra,
      bottom,
      code: { written: isFrame ? frameDecls(e, { noCss: true, cols: grid().cols }) : partDecls(st, { noCss: true, kind: k }), css: st.css || "", editable: freedom === 2, sanitize: safeDecls, inherited, tokens },
      tweaks: tweaksCtx(e),
      saved: savedHTML(ad),
    };
  }
  /** The width of one grid column plus its gap, in the sheet's own (unscaled) pixels. */
  function colStep() {
    const cs = getComputedStyle($sheet);
    const inner = $sheet.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return (inner + grid().gap) / grid().cols;
  }
  const panel = new Panel($panel, {
    change(key, value, live) {
      if (key.startsWith("tw.")) return setTheme(key.slice(3), value, live);
      if (key.startsWith("grid.")) return setGrid(key.slice(5) as "cols" | "gap" | "row", value as number, live);
      if (key === "list.limit") return setLimit(value as number, live);
      if (!sel) return;
      const ad = adById(sel.node), t = spanOfTemplate(ad), e = eff(ad), el = find(sel), g = grid();
      if (sel.part === ROOT) {
        if (key === "family") return setFamily(sel.node, value as string);
        if (key === "colSpan") return setSpan(sel.node, [Math.round(value as number), e.span[1]], true);
        if (key === "rowSpan") return setSpan(sel.node, [e.span[0], Math.round(value as number)], true);
        if (key === "wpx") return setSpan(sel.node, [Math.max(1, Math.min(g.cols, Math.round(((value as number) + g.gap) / colStep()))), e.span[1]], true);
        if (key === "hpx") return setSpan(sel.node, [e.span[0], Math.max(1, Math.min(maxRows(g), Math.round(((value as number) + g.gap) / (g.row + g.gap))))], true);
        if (key === "wmode") return setSpan(sel.node, value === "hug" ? (ad.o.span && ad.o.span[1] !== t[1] ? [t[0], ad.o.span[1]] : null) : value === "fill" ? [g.cols, e.span[1]] : [e.span[0] === g.cols ? Math.max(1, t[0]) : e.span[0], e.span[1]], value !== "hug");
        if (key === "hmode") return setSpan(sel.node, value === "hug" ? (ad.o.span ? [ad.o.span[0], t[1]] : null) : [e.span[0], e.span[1]], true);
      } else {
        const w = el ? Math.round(el.offsetWidth) : 120, h = el ? Math.round(el.offsetHeight) : 24;
        if (key === "wpx") return setPart(sel.node, sel.part, "w", value, live);
        if (key === "hpx") return setPart(sel.node, sel.part, "h", value, live);
        if (key === "wmode") return setStyle(sel.node, sel.part, value === "hug" ? { self: "start", w: null } : value === "fill" ? { self: "stretch", w: null } : { w });
        if (key === "hmode") return setStyle(sel.node, sel.part, value === "hug" ? { grow: 0, h: null } : value === "fill" ? { grow: 1, h: null } : { h, grow: null });
      }
      setPart(sel.node, sel.part, key, value, live);
    },
    reset(key) {
      if (key.startsWith("tw.")) return setTheme(key.slice(3), undefined);
      if (key.startsWith("grid.")) return setGrid(key.slice(5) as "cols" | "gap" | "row", undefined);
      if (key === "list.limit") return setLimit(undefined);
      if (!sel) return;
      const ad = adById(sel.node);
      if (sel.part === ROOT && key === "family") return setFamily(sel.node, null);
      if (sel.part === ROOT && ["colSpan", "rowSpan", "wmode", "hmode"].includes(key)) return setSpan(sel.node, null);
      history.remember(null);
      const drop = key === "wmode" ? ["self", "w"] : key === "hmode" ? ["grow", "h"] : [key];
      if (ad.o.parts?.[sel.part]) for (const k of drop) delete (ad.o.parts[sel.part] as Record<string, unknown>)[k];
      tidy(ad); renderAll();
    },
    textStyle(style) { if (sel) setStyle(sel.node, sel.part, style); },
    select(ref) { select(ref ? (parseRef(ref) as Sel) : null); },
    toggleHidden(ref) {
      const r = parseRef(ref) as Sel | null; if (!r) return;
      const ad = adById(r.node); if (!ad) return;
      setPart(r.node, r.part, "hide", !eff(ad).parts[r.part]?.hide);
    },
    snap() { if (sel) snap(sel.node, sel.part); },
    hover(ref) {
      const h = ref ? parseRef(ref) : null;
      hoverInst = selInst;
      if (refKey(h) !== refKey(hover)) { hover = h; renderOverlay(); }
    },
    dragLayer(ref, ev) {
      const from = parseRef(ref);
      if (!from) return;
      busy = true;
      const isAd = from.part === ROOT;
      startGhostDrag(ev, {
        label: isAd ? "move ad" : "move " + nodeName(adById(from.node), from.part).toLowerCase(), host: root, insertion: true, axis: "y",
        target: (under) => {
          const li = under.closest("li[data-drag]") as HTMLElement | null;
          if (!li || !$panel.contains(li) || li.dataset.drag === ref) return null;
          const to = parseRef(li.dataset.drag!)!;
          if (isAd) return to.part === ROOT ? li : null;
          if (to.node === from.node && to.part !== ROOT && within(treeOf(doc, adById(from.node)), from.part, to.part)) return null;
          return li;
        },
        onDrop: (li, before) => {
          const to = parseRef(li.dataset.drag!)!;
          if (isAd) return moveAd(from.node, to.node, before);
          const toAd = adById(to.node);
          if (to.part === ROOT) return moveNodeTo({ ad: from.node, id: from.part }, to.node, ROOT, before ? 0 : treeOf(doc, toAd).length);
          // Beside the target row, in its container.
          const pid = parentOf(toAd, to.part);
          const t = cloneTree(treeOf(doc, toAd));
          if (to.node === from.node) removeNode(t, from.part);
          const fi = findNode(t, to.part);
          if (!fi) return;
          const kind = kindOf(adById(from.node), from.part);
          if (!mayPlace(kind, subtreeDepth(findNode(treeOf(doc, adById(from.node)), from.part)!.node), toAd, pid, { ad: from.node, id: from.part })) { hud("Not allowed there at " + FREEDOM_LABEL[freedom]); return; }
          moveNodeTo({ ad: from.node, id: from.part }, to.node, pid, fi.index + (before ? 0 : 1));
        },
        onEnd: () => { busy = false; },
      });
    },
  });
  const renderPanel = () => { if (panelOpen) panel.render(panelCtx()); };

  function renderStatus(msg?: string, bad?: boolean) {
    const s = R("status"), dirty = history.dirty();
    s.textContent = msg ?? (saving ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved");
    s.className = "cle-status" + (bad ? " bad" : "");
    R("dot").hidden = !dirty;
    (R("save") as HTMLButtonElement).disabled = saving || !dirty;
    (R("undo") as HTMLButtonElement).disabled = !history.canUndo;
    (R("redo") as HTMLButtonElement).disabled = !history.canRedo;
  }
  function renderTools() {
    R("gridlines").setAttribute("aria-pressed", String(showGrid));
    const s = R("snap") as HTMLButtonElement;
    s.disabled = freedom < 2;
    s.setAttribute("aria-pressed", String(freedom < 2 || snapOn));
    s.title = freedom < 2 ? `Sizes always snap to the grid at ${FREEDOM_LABEL[freedom]}; exact sizes come with Free` : snapOn ? "Snapping to the grid (hold Alt for an exact size). Click to turn off" : "Exact sizes (hold Alt to snap). Click to snap to the grid";
  }
  function renderAll() { fixSel(); renderSheet(); renderRail(); renderCrumbs(); renderPanel(); renderTools(); viewport.apply(); renderStatus(); }
  function select(s: Sel | null) { endInline(); sel = s && exists(s) ? s : null; hover = null; renderCrumbs(); renderPanel(); renderOverlay(); }
  let hudTimer: ReturnType<typeof setTimeout> | undefined;
  function hud(msg: string) { const h = R("hud"); h.textContent = msg; h.classList.add("show"); clearTimeout(hudTimer); hudTimer = setTimeout(() => h.classList.remove("show"), 1600); }

  // ------------------------------------------------------------ tools and view
  function setTool(t: Tool) {
    tool = t; root.dataset.tool = t;
    root.querySelectorAll<HTMLElement>("[data-tool]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === t)));
    if (t !== "select" && hover) { hover = null; renderOverlay(); }
    if (t === "text") hud(`Text: click where the words should go in ${P ? "a card" : "an ad"}`);
  }
  function setPanelOpen(on: boolean) {
    panelOpen = on;
    R("main").classList.toggle("cle-nopanel", !on);
    R("paneltoggle").setAttribute("aria-pressed", String(on));
    if (on) renderPanel();
    viewport.apply();
  }
  function setPhone(on: boolean) {
    viewport.setPhone(on);
    R("phone").setAttribute("aria-pressed", String(on));
    $sheet.classList.toggle("cl-phone", on);
    if (on) viewport.setZoom(1); else viewport.fit();
    renderOverlay();
    hud(on ? `Phone preview: every ${thing} is one column wide` : "Desktop width");
  }
  function setShowGrid(on: boolean) {
    showGrid = on; renderTools();
    if (on) drawGuides(); else clearGridGuides($guides);
    hud(on ? `Grid: ${grid().cols} columns, ${grid().gap}px gutter, ${grid().row}px rows` : "Grid hidden");
  }

  // ------------------------------------------------------------ inline text
  function endInline() { if (inline?.active()) inline.finish(false); inline = null; }
  function startInline(r: Sel) {
    if (r.part === ROOT) return;
    const ad = adById(r.node); if (!ad) return;
    const k = kindOf(ad, r.part);
    if (!isTextKind(k)) return;
    if (inline?.active()) return;
    select(r);
    const el = find(r); if (!el) return;
    const before = copyOf(ad, r.part);
    const rich = richOf(k);
    // Pattern mode draws the item's data; while typing, the design's own words (with {{tokens}}) show.
    if (P && !rich) el.textContent = before;
    inline = startInlineText(el, {
      initial: before, multiline: k === "body", rich: rich ?? false,
      onCommit: (text) => { inline = null; setCopy(r.node, r.part, text); hud(P ? "Words changed on every card" : "Text changed"); },
      onCancel: () => { inline = null; renderAll(); },
      keepFocus: (to) => mini.contains(to),
      onSelection: () => renderMini(),
    });
    renderOverlay();
  }

  // ------------------------------------------------------- the floating toolbar
  function miniCtx(): { ctx: MiniBarContext; anchor: DOMRect } | null {
    if (!sel || sel.part === ROOT) return null;
    const ad = adById(sel.node); if (!ad) return null;
    const k = kindOf(ad, sel.part);
    if (!isTextKind(k)) return null;
    const editing = !!inline?.active();
    const state = editing ? inline!.state() : null;
    if (editing ? !state!.range : panelOpen || tool !== "select") return null;
    const e = eff(ad), slots = slotsFor(ad, sel.part);
    const rich = richOf(k), copy = copyOf(ad, sel.part);
    const vals = valuesFor(ad, sel.part, null).values;
    const tri = (cond: boolean, v: boolean): Tri => (cond ? v : null);
    const al = offers(slots, "align");
    const col = offers(slots, "color");
    const colList = col ? ((col.allowed!.list as string[] | undefined) ?? themeColours(e.fam)) : [];
    const match = styleChoices.find((p) => Object.entries(p.style).every(([key, v]) => v === undefined || vals[key] === v));
    const el = find(sel);
    let anchor = el?.getBoundingClientRect();
    if (editing) { const s = getSelection(); if (s && s.rangeCount) { const rr = s.getRangeAt(0).getBoundingClientRect(); if (rr.width || rr.height) anchor = rr; } }
    if (!anchor) return null;
    // While the selection chips are above the part, the text bar goes above them.
    if (!editing) anchor = new DOMRect(anchor.left, anchor.top - 24, anchor.width, anchor.height);
    const a = el?.querySelector("a")?.getAttribute("href") ?? undefined;
    return {
      anchor,
      ctx: {
        editing, styles: styleChoices.map((p) => ({ id: p.id, label: p.label, group: p.group })), styleId: match?.id ?? "",
        color: col ? { value: (vals.color as string) || "#000000", swatches: colList } : null,
        bold: editing ? tri(!!rich, state!.bold) : tri(!!offers(slots, "weight"), ((vals.weight as number) ?? 400) >= 600),
        italic: editing ? tri(!!rich, state!.italic) : tri(!!offers(slots, "italic"), !!vals.italic),
        underline: tri(!!rich, editing ? state!.underline : wholeHas(copy, "u", rich)),
        link: tri(!!rich, editing ? state!.link : wholeHas(copy, "a", rich)),
        list: tri(!!rich?.list, editing ? state!.list : wholeHas(copy, "ul", rich)),
        align: al ? { value: String(vals.align ?? "left"), options: (al.allowed!.list as string[]) ?? ["left", "center", "right"] } : null,
        href: a,
      },
    };
  }
  function renderMini() {
    const m = miniCtx();
    if (!m) { if (!mini.linkFieldOpen) mini.hide(); return; }
    mini.update(m.ctx, m.anchor);
  }
  /** Rewrite the part's whole words (underline, link or list on a part that is not being typed in). */
  function wholeEdit(fn: (copy: string, rich: { list?: boolean }) => string) {
    if (!sel || sel.part === ROOT) return;
    const rich = richOf(kindOf(adById(sel.node), sel.part)); if (!rich) return;
    setCopy(sel.node, sel.part, fn(copyOf(adById(sel.node), sel.part), rich));
  }
  const miniHandlers: MiniBarHandlers = {
    style(id) { const p = styleChoices.find((x) => x.id === id); if (p && sel) setStyle(sel.node, sel.part, p.style); },
    color(hex) { if (sel) setPart(sel.node, sel.part, "color", hex); },
    format(f) {
      if (!sel || sel.part === ROOT) return;
      if (inline?.active()) { inline.command(f === "b" ? "bold" : f === "i" ? "italic" : f === "u" ? "underline" : "list"); return; }
      const ad = adById(sel.node), st = eff(ad).parts[sel.part] ?? {};
      if (f === "b") setPart(sel.node, sel.part, "weight", (st.weight ?? 400) >= 600 ? 400 : 700);
      else if (f === "i") setPart(sel.node, sel.part, "italic", !st.italic);
      else if (f === "u") wholeEdit((c, r) => toggleWhole(c, "u", r));
      else if (f === "list") wholeEdit((c) => toggleList(c));
    },
    link(href) {
      if (inline?.active()) { if (href) inline.link(href); else inline.command("unlink"); return; }
      wholeEdit((c, r) => (href ? toggleWhole(wholeHas(c, "a", r) ? toggleWhole(c, "a", r) : c, "a", r, href) : wholeHas(c, "a", r) ? toggleWhole(c, "a", r) : c));
    },
    align(v) { if (sel) setPart(sel.node, sel.part, "align", v); },
    more(x, y) { openContext(x, y); },
    linkField(open) { if (!open && inline?.active()) setTimeout(() => inline?.restoreRange(), 0); },
  };
  const mini = new MiniBar(root, miniHandlers);

  // ---------------------------------------------------------- clipboard and menu
  const publicHTML = (ad: Ad, id?: string): string => {
    const html = adHTML(ad, true, P ? items()[selInst] : null);
    if (!id || id === ROOT) return html;
    const tmp = document.createElement("div"); tmp.innerHTML = html;
    // Public markup has no markers: find the node by its place in the plan.
    const plan = planAd(doc, ad, { item: P ? items()[selInst] : null, cols: grid().cols });
    const path: number[] = [];
    const seek = (nodes: typeof plan.kids, trail: number[]): boolean => nodes.some((n, i) => (n.id === id ? (path.push(...trail, i), true) : n.kids ? seek(n.kids, [...trail, i]) : false));
    if (!seek(plan.kids, [])) return "";
    let el: Element | null = tmp.firstElementChild;
    for (const i of path) el = el?.children[i] ?? null;
    return el?.outerHTML ?? "";
  };
  async function copyAsHtml() {
    if (!sel) return;
    const h = publicHTML(adById(sel.node), sel.part);
    const ok = await copyToClipboard({ text: h, html: h });
    hud(ok ? "Copied as HTML" : "The browser would not let this page copy");
  }
  async function copyAsPng() {
    if (!sel) return;
    const ad = adById(sel.node);
    const host = document.createElement("div");
    host.className = "cl-sheet cle-export" + (P ? " cl-list" : "");
    host.setAttribute("style", declsToString(sheetDecls(doc)));
    host.style.cssText += `;position:fixed;left:-99999px;top:0;width:${$sheet.clientWidth}px`;
    host.innerHTML = publicHTML(ad, sel.part === ROOT ? undefined : undefined);
    document.body.appendChild(host);
    try {
      const target = sel.part === ROOT ? (host.querySelector(".cl-ad") as HTMLElement | null) : (() => { const t = document.createElement("div"); t.innerHTML = publicHTML(ad, sel!.part); const n = t.firstElementChild as HTMLElement | null; if (n) { host.innerHTML = ""; host.appendChild(n); } return n; })();
      hud("Drawing the picture…");
      const png = target ? await elementToPng(target, { background: P ? "#ffffff" : paperOf(doc), scale: 2 }) : null;
      if (!png) { hud("Copy as PNG is not available here"); return; }
      const ok = await copyToClipboard({ png });
      hud(ok ? `Copied as PNG (${Math.round(png.size / 1024)} KB)` : "The browser would not let this page copy");
    } catch { hud("Copy as PNG is not available here"); } finally { host.remove(); }
  }
  const plainOfAd = (ad: Ad) => { const e = eff(ad); return Object.entries(e.kinds).filter(([, k]) => isTextKind(k)).map(([id]) => plainCopy(e.copy[id])).filter(Boolean).join("\n"); };
  function nodeClip(ad: Ad, id: string): Clip {
    const e = eff(ad), node = cloneTree([findNode(e.tree, id)!.node])[0]!;
    const parts: Record<string, PartStyle> = {}, copy: Record<string, string> = {};
    walk([node], (n) => { parts[n.id] = { ...(e.parts[n.id] ?? {}) }; if (e.copy[n.id] !== undefined) copy[n.id] = e.copy[n.id]!; });
    return { kind: "node", tree: node, parts, copy, style: { ...(e.parts[id] ?? {}) }, nodeKind: kindOf(ad, id) };
  }
  function doCopy() {
    if (!sel) return;
    const ad = adById(sel.node);
    if (sel.part === ROOT) { clip = { kind: "ad", ad: clone(ad) }; void copyToClipboard({ text: plainOfAd(ad) }); hud(`Copied the ${thing}`); }
    else { clip = nodeClip(ad, sel.part); void copyToClipboard({ text: plainCopy(copyOf(ad, sel.part)) }); hud(`Copied ${nodeName(ad, sel.part).toLowerCase()}`); }
    renderPanel();
  }
  function doDelete() {
    if (!sel) return;
    const ad = adById(sel.node), i = doc.ads.indexOf(ad);
    if (sel.part === ROOT) {
      if (P) { hud("The card design stays; delete its parts instead"); return; }
      history.remember(null); doc.ads.splice(i, 1); sel = null; renderAll(); hud("Deleted. Undo brings it back.");
    } else deleteNode(sel.node, sel.part);
  }
  function doCut() { if (!sel) return; doCopy(); doDelete(); }
  function pasteStyle(style: PartStyle, fromKind: Kind) {
    if (!sel || sel.part === ROOT) return;
    const ad = adById(sel.node);
    const offered = new Set(slotsFor(ad, sel.part).filter((s) => s.allowed && s.control !== "css-prop").map((s) => s.key));
    const keys = Object.keys(style).filter((k) => offered.has(k) && k !== "family");
    void fromKind;
    history.remember(null);
    for (const k of keys) writeKey(ad, sel.part, k, (style as Record<string, unknown>)[k]);
    tidy(ad); renderAll(); hud(`Pasted ${keys.length} setting${keys.length === 1 ? "" : "s"}`);
  }
  function doPaste() {
    if (!sel || !clip) return;
    if (clip.kind === "ad") {
      if (P) { hud("Paste parts into the card, not a whole card"); return; }
      const i = doc.ads.indexOf(adById(sel.node));
      history.remember(null);
      const n: Ad = { ...clone(clip.ad), id: "ad" + doc.next++ };
      doc.ads.splice(i + 1, 0, n); sel = { node: n.id, part: ROOT }; renderAll(); hud("Pasted the ad");
      return;
    }
    // A copied part goes into the selected box / after the selected part / at the end of the selected ad.
    const c = clip;
    const at = insertionPoint(c.nodeKind);
    if (!at) return;
    const ad = adById(at.ad);
    if (!mayPlace(c.nodeKind, subtreeDepth(c.tree), ad, at.parent)) { hud("No room for that here"); return; }
    history.remember(null);
    const node = cloneTree([c.tree])[0]!;
    const map: Array<[string, string]> = [];
    walk([node], (n) => { const nid = newId(); map.push([n.id, nid]); n.id = nid; });
    const t = cloneTree(treeOf(doc, ad));
    insertNode(t, toParent(at.parent), at.index, node);
    commitTree(ad, t);
    for (const [old, nid] of map) {
      const k = (findNode(t, nid)?.node.kind ?? "body") as Kind;
      const base = baseOf(ad, nid);
      const s = c.parts[old] ?? {};
      const own: PartStyle = {};
      for (const [key, v] of Object.entries(s)) if (JSON.stringify((base as Record<string, unknown>)[key]) !== JSON.stringify(v)) (own as Record<string, unknown>)[key] = v;
      if (Object.keys(own).length) { ad.o.parts = ad.o.parts || {}; ad.o.parts[nid] = own; }
      if (c.copy[old] !== undefined && k !== "box" && k !== "rule") putCopy(ad, nid, c.copy[old]!);
    }
    tidy(ad);
    sel = { node: ad.id, part: node.id };
    renderAll(); hud("Pasted");
  }
  function doDuplicate() {
    if (!sel) return;
    if (sel.part !== ROOT) { duplicateNode(sel.node, sel.part); return; }
    if (P) { hud("Every item gets this card; duplicate its parts instead"); return; }
    const ad = adById(sel.node), i = doc.ads.indexOf(ad);
    history.remember(null);
    const n: Ad = { id: "ad" + doc.next++, template: ad.template, o: clone(ad.o), link: ad.link ? clone(ad.link) : { kind: "none" } };
    doc.ads.splice(i + 1, 0, n); sel = { node: n.id, part: ROOT }; renderAll(); hud("Duplicated");
    find(sel)?.scrollIntoView({ block: "nearest" });
  }
  function doMove(where: "first" | "last" | "earlier" | "later") {
    if (!sel) return;
    if (sel.part !== ROOT) { moveWithin(sel.node, sel.part, where); return; }
    if (P) return;
    const i = doc.ads.findIndex((a) => a.id === sel!.node);
    const j = where === "first" ? 0 : where === "last" ? doc.ads.length - 1 : where === "earlier" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= doc.ads.length || j === i) return;
    history.remember(null);
    doc.ads.splice(j, 0, doc.ads.splice(i, 1)[0]!);
    renderAll(); hud(where === "first" ? "Moved to first" : where === "last" ? "Moved to last" : "Moved");
  }
  function menuItems(): MenuItem[] {
    if (!sel) return [];
    const ad = adById(sel.node), isFrame = sel.part === ROOT, k = kindOf(ad, sel.part);
    const f = isFrame ? null : findNode(treeOf(doc, ad), sel.part);
    const i = doc.ads.indexOf(ad);
    const first = isFrame ? i <= 0 : (f?.index ?? 0) <= 0;
    const last = isFrame ? i >= doc.ads.length - 1 : (f?.index ?? 0) >= (f?.siblings.length ?? 1) - 1;
    return [
      { id: "cut", label: "Cut", hint: "Ctrl+X", disabled: isFrame && !!P },
      { id: "copy", label: "Copy", hint: "Ctrl+C" },
      { id: "paste", label: "Paste", hint: "Ctrl+V", disabled: !clip },
      { id: "dup", label: "Duplicate", hint: "Ctrl+D", disabled: isFrame && !!P, sep: true },
      { id: "html", label: "Copy as HTML" },
      { id: "png", label: "Copy as PNG" },
      { id: "first", label: "Move to first", hint: "[", disabled: (isFrame && !!P) || first, sep: true },
      { id: "last", label: "Move to last", hint: "]", disabled: (isFrame && !!P) || last },
      ...(!isFrame ? [
        { id: "group", label: "Group in a row", hint: "Ctrl+G", sep: true },
        { id: "groupcol", label: "Group in a column" },
        { id: "ungroup", label: "Ungroup", hint: "Ctrl+Shift+G", disabled: k !== "box" },
      ] : []),
      { id: "parent", label: "Select parent", hint: "Esc", disabled: !upOf(sel), sep: true },
      { id: "snap", label: "Snap to family", disabled: (isFrame ? allIds(ad).flatMap((p) => outsideOf(ad, p)) : outsideOf(ad, sel.part)).length === 0 },
      ...(isTextKind(k) ? [{ id: "clear", label: "Clear words", disabled: !copyOf(ad, sel.part) }] : []),
      { id: "del", label: "Delete", hint: "Del", danger: true, disabled: isFrame && !!P, sep: !isTextKind(k) },
    ];
  }
  /** Every box under the pointer at the last right-click, part ids outermost first. */
  let contextLayers: string[] = [];
  function layerItems() {
    if (!sel) return [];
    const ad = adById(sel.node);
    const kids = [ROOT, ...contextLayers].map((id, i) => ({
      id: `layer:${id}`,
      label: `${"· ".repeat(i)}${id === ROOT ? adName(ad) : nodeName(ad, id)}`,
      hint: id === sel!.part ? "✓" : undefined,
    }));
    return [{ id: "layers", label: "Layers", sep: true, kids }];
  }
  function runAction(id: string) {
    if (!sel) return;
    if (id.startsWith("layer:")) { select({ node: sel.node, part: id.slice(6) }); return; }
    switch (id) {
      case "cut": doCut(); break;
      case "copy": doCopy(); break;
      case "paste": doPaste(); break;
      case "dup": doDuplicate(); break;
      case "html": void copyAsHtml(); break;
      case "png": void copyAsPng(); break;
      case "first": doMove("first"); break;
      case "last": doMove("last"); break;
      case "group": wrapInBox(sel.node, sel.part, "row"); break;
      case "groupcol": wrapInBox(sel.node, sel.part, "column"); break;
      case "ungroup": unwrapBox(sel.node, sel.part); break;
      case "parent": select(upOf(sel)); break;
      case "snap": snap(sel.node, sel.part); break;
      case "clear": setCopy(sel.node, sel.part, ""); hud("Words cleared. Undo brings them back."); break;
      case "del": doDelete(); break;
    }
  }
  function openContext(x: number, y: number) {
    if (!sel) return;
    mini.hide();
    openMenu({ x, y, title: sel.part === ROOT ? (P ? "Card" : "Ad") : nodeName(adById(sel.node), sel.part), items: [...menuItems(), ...layerItems()], host: root, onPick: runAction });
  }

  // ------------------------------------------------------------ interaction
  /** The drop rules for dragging a node (existing or new) over the canvas. */
  function dropRules(kind: Kind, levels: number, moving: { ad: string; id: string } | null, source: HTMLElement | null): DropRules {
    return {
      containers: CONTAINER_SEL, scope: $sheet, source,
      parentOf: (c) => (c.matches("[data-node]") ? null : (c.parentElement?.closest(CONTAINER_SEL) as HTMLElement | null)),
      childrenOf: (c) => [...c.children].filter((k) => (k as HTMLElement).dataset.part !== undefined) as HTMLElement[],
      accepts: (c) => {
        const ref = containerRef(c);
        return !!ref && mayPlace(kind, levels, adById(ref.ad), ref.parent, moving ?? undefined);
      },
    };
  }
  function containerRef(c: HTMLElement): { ad: string; parent: string } | null {
    const nodeEl = c.closest("[data-node]") as HTMLElement | null;
    if (!nodeEl) return null;
    return { ad: nodeEl.dataset.node!, parent: c === nodeEl ? ROOT : c.dataset.part! };
  }
  /** Drag a node of an ad (or a new one from the left rail) into any container on the sheet. */
  function dragNode(ev: PointerEvent, from: { ad: string; id: string } | null, fresh?: { kind: Exclude<Kind, "frame">; label: string; style?: PartStyle; words?: string }) {
    const srcAd = from ? adById(from.ad) : null;
    const f = from ? findNode(treeOf(doc, srcAd!), from.id) : null;
    if (from && !f) return;
    const kind = (from ? f!.node.kind : fresh!.kind) as Kind;
    const levels = from ? subtreeDepth(f!.node) : 1;
    const source = from ? find({ node: from.ad, part: from.id }) : null;
    busy = true;
    endInline();
    mini.hide();
    startNodeDrag(ev, {
      ...dropRules(kind, levels, from, source),
      host: root, label: from ? nodeName(srcAd!, from.id) : fresh!.label,
      onDrop: (c, index) => {
        const ref = containerRef(c); if (!ref) return;
        if (from) moveNodeTo(from, ref.ad, ref.parent, index);
        else { const id = insertNew(ref.ad, ref.parent, index, { kind: fresh!.kind, style: fresh!.style, words: fresh!.words ?? (isTextKind(fresh!.kind) && !P ? "Your text here" : undefined) }); if (id) hud(`Added ${fresh!.label.toLowerCase()}`); }
      },
      onEnd: (dropped) => { busy = false; canvas.suppressNextClick(); if (!dropped) renderOverlay(); },
    });
  }
  /** Text tool: new words where the click is, in whatever container is under it. */
  function insertText(ev: MouseEvent) {
    setTool("select");
    const spot = findDropSpot(ev.clientX, ev.clientY, dropRules("body", 1, null, null));
    if (!spot) { hud(`Click inside ${P ? "a card" : "an ad"} to put words there`); return; }
    const ref = containerRef(spot.container); if (!ref) return;
    const id = insertNew(ref.ad, ref.parent, spot.index, { kind: "body", words: "Your text here" });
    if (id) { startInline({ node: ref.ad, part: id }); hud("Added text: type to replace it"); }
  }
  // Pattern mode: which card the pointer is in.
  L.on($sheet, "pointerdown", (ev: PointerEvent) => { const i = (ev.target as HTMLElement).closest?.("[data-inst]") as HTMLElement | null; if (i) selInst = Number(i.dataset.inst) || 0; }, true);
  L.on($sheet, "contextmenu", (ev: MouseEvent) => { const i = (ev.target as HTMLElement).closest?.("[data-inst]") as HTMLElement | null; if (i) selInst = Number(i.dataset.inst) || 0; }, true);
  L.on($sheet, "mousemove", (ev: MouseEvent) => { const i = (ev.target as HTMLElement).closest?.("[data-inst]") as HTMLElement | null; if (i) hoverInst = Number(i.dataset.inst) || 0; }, true);
  const canvas = bindCanvas({
    scope: $sheet, canvas: $canvas,
    getSel: () => sel, select: (r) => select(r as Sel | null),
    getHover: () => hover, setHover: (r) => { hover = r; renderOverlay(); },
    busy: () => busy || tool !== "select",
    deeper: (cur, node, chain) => deeperIn(cur, node, chain, (outer, inner) => within(treeOf(doc, adById(node)), outer, inner)),
    onInline: (r) => { const ad = adById(r.node); const c = r.part; if (ad && c !== ROOT && isTextKind(kindOf(ad, c))) startInline(r); },
    onClick: (ev, _hit) => {
      if (tool === "hand") return true;
      if (tool === "text") { insertText(ev); return true; }
      return false;
    },
    onContext: (ev, hit) => {
      const c = (ev.target as HTMLElement).closest("[data-part]") as HTMLElement | null;
      const cur = sel;
      // Inside the selected ad, right-click selects the part under the pointer (a part that already
      // holds the pointer stays selected); elsewhere it selects the ad.
      const keep = cur && cur.node === hit.node && cur.part !== ROOT && !!find(cur)?.contains(ev.target as Node);
      if (!keep) select(cur && cur.node === hit.node && c ? { node: hit.node, part: c.dataset.part! } : { node: hit.node, part: ROOT });
      contextLayers = hitChain(ev.target)?.chain ?? [];
      openContext(ev.clientX, ev.clientY);
    },
    onPressDrag: (ev, hit, chain) => {
      if (tool !== "select") return;
      // Drag what is selected when the press is inside it; otherwise what a click would select.
      const curEl = sel ? find(sel) : null;
      const inside = !!sel && sel.node === hit.node && !!curEl && curEl.contains(ev.target as Node) || (!!sel && sel.node === hit.node && sel.part !== ROOT && chain.includes(sel.part));
      const target: Sel = inside ? sel! : deeperIn(sel, hit.node, chain, (outer, inner) => within(treeOf(doc, adById(hit.node)), outer, inner));
      if (refKey(target) !== refKey(sel)) select(target);
      if (target.part === ROOT) { if (!P) dragAd(ev, target.node); return; }
      dragNode(ev, { ad: target.node, id: target.part });
    },
    onWheel: (r, kind, dir) => {
      const ref = r as Sel;
      const ad = adById(ref.node);
      if (!ad || !isTextKind(kindOf(ad, ref.part))) return;
      if (!sel || refKey(sel) !== refKey(ref)) select(ref);
      const st = eff(ad).parts[ref.part] ?? {};
      const slots = slotsFor(ad, ref.part);
      if (kind === "font") {
        const list = (slots.find((s) => s.key === "font")?.allowed?.list ?? []) as string[];
        if (!list.length) return;
        let i = list.indexOf(st.font ?? "");
        i = (i + dir + list.length) % list.length;
        setPart(ref.node, ref.part, "font", list[i], true);
        hud(`Font: ${list[i]} (${i + 1} of ${list.length} at ${FREEDOM_LABEL[freedom]})`);
      } else {
        const rg = slots.find((s) => s.key === "size")?.allowed?.range; if (!rg) return;
        const v = Math.max(rg[0], Math.min(rg[1], (st.size ?? 12) - dir));
        setPart(ref.node, ref.part, "size", v, true);
        hud(`Size: ${v}px (range ${rg[0]} to ${rg[1]})`);
      }
    },
  }, L);

  function dragAd(ev: PointerEvent, id: string) {
    busy = true;
    startGhostDrag(ev, {
      label: "move ad", host: root, insertion: true,
      target: (under) => { const n = under.closest("[data-node]") as HTMLElement | null; return n && $sheet.contains(n) && n.dataset.node !== id ? n : null; },
      onDrop: (target, before) => moveAd(id, target.dataset.node!, before),
      onEnd: () => { busy = false; canvas.suppressNextClick(); },
    });
  }

  // Hand tool (and the middle button anywhere): drag the canvas.
  L.on($canvas, "pointerdown", (ev: PointerEvent) => {
    const t = ev.target as HTMLElement;
    if (t.closest(".cle-tools, .de-handle, .de-grip")) return;
    if ((tool === "hand" && ev.button === 0) || ev.button === 1) { ev.preventDefault(); viewport.startPan(ev); }
  });
  L.on($canvas, "wheel", (ev: WheelEvent) => { if (ev.ctrlKey) { ev.preventDefault(); viewport.step(ev.deltaY < 0 ? 1 : -1); } }, { passive: false });
  L.on(R("tools"), "click", (ev: MouseEvent) => {
    const b = (ev.target as HTMLElement).closest("button") as HTMLElement | null; if (!b) return;
    if (b.dataset.tool) setTool(b.dataset.tool as Tool);
    else if (b.dataset.r === "zoomin") viewport.step(1);
    else if (b.dataset.r === "zoomout") viewport.step(-1);
    else if (b.dataset.r === "zoomfit") viewport.fit();
    else if (b.dataset.r === "zoomlabel") viewport.setZoom(1);
    else if (b.dataset.r === "phone") setPhone(!viewport.phone);
    else if (b.dataset.r === "gridlines") setShowGrid(!showGrid);
    else if (b.dataset.r === "snap" && freedom === 2) { snapOn = !snapOn; renderTools(); hud(snapOn ? "Sizes snap to the grid" : "Exact sizes: resizing keeps the size you drag to"); }
  });
  L.on(R("paneltoggle"), "click", () => setPanelOpen(!panelOpen));

  L.on(R("overlay"), "pointerdown", (ev: PointerEvent) => {
    const t = ev.target as HTMLElement, handle = t.closest("[data-h]") as HTMLElement | null, grip = t.closest("[data-grip]") as HTMLElement | null;
    if ((!handle && !grip) || !sel) return;
    ev.preventDefault();
    const from = { ...sel };
    busy = true;
    const done = () => { busy = false; canvas.suppressNextClick(); };
    if (handle) {
      const adEl = find({ node: from.node, part: ROOT })!, e = eff(adById(from.node));
      const g = grid();
      startSmoothResize(ev, {
        el: adEl, handle: handle.dataset.h!, span: [...e.span] as [number, number], zoom: viewport.zoom, maxRows: maxRows(g), guides: $guides,
        geometry: () => sheetGeometry($sheet, $guides, g, viewport.zoom),
        snap: (e2) => freedom < 2 || (snapOn !== !!(e2 && "altKey" in e2 && e2.altKey)),
        onMove: (s) => {
          drawGuides();
          renderOverlay();
          hud(s.snapped ? `${s.span[0]} of ${g.cols} columns × ${s.span[1]} rows${s.wraps ? " · moves down a row" : ""}` : `${Math.round(s.wPx)} × ${Math.round(s.hPx)} px, exact (Alt snaps)`);
        },
        onEnd: (res) => {
          done();
          if (!showGrid) clearGridGuides($guides);
          if (!res) { renderOverlay(); return; }
          applyResize(from.node, res.span, res.free);
        },
      });
    } else if (grip!.dataset.grip === "move") {
      busy = false;
      if (from.part === ROOT) dragAd(ev, from.node);
      else dragNode(ev, { ad: from.node, id: from.part });
    } else {
      startGhostDrag(ev, {
        label: "graft " + nodeName(adById(from.node), from.part).toLowerCase(), host: root,
        target: (under) => { const n = under.closest("[data-node]") as HTMLElement | null; return n && $sheet.contains(n) && n.dataset.node !== from.node ? n : null; },
        onDrop: (target) => graft(from, target.dataset.node!),
        onEnd: done,
      });
    }
  });
  /** A resize lands: on the grid (span), or (Free, snapping off) at an exact size inside the cells it covers. */
  function applyResize(adId: string, span: [number, number], free?: { w?: number; h?: number }) {
    const ad = adById(adId);
    history.remember(null);
    const t = spanOfTemplate(ad);
    if (t[0] === span[0] && t[1] === span[1]) delete ad.o.span; else ad.o.span = span;
    if (free) { if (free.w !== undefined) writeKey(ad, ROOT, "w", free.w); if (free.h !== undefined) writeKey(ad, ROOT, "h", free.h); }
    else { writeKey(ad, ROOT, "w", undefined); writeKey(ad, ROOT, "h", undefined); }
    tidy(ad); renderAll();
    hud(free ? `Exact size ${free.w ?? "auto"} × ${free.h ?? "auto"} px` : `${span[0]} × ${span[1]} on the ${grid().cols}-column grid`);
  }
  function moveAd(id: string, targetId: string, before: boolean) {
    const i = doc.ads.findIndex((a) => a.id === id); if (i < 0) return;
    history.remember(null);
    const [ad] = doc.ads.splice(i, 1);
    let j = doc.ads.findIndex((a) => a.id === targetId);
    if (j < 0) j = doc.ads.length; else if (!before) j++;
    doc.ads.splice(j, 0, ad!);
    renderAll(); hud("Moved");
  }
  /** Give another ad this part's look (and a header its words): the same node id there, or its first node of the same kind. */
  function graft(from: Sel, toId: string) {
    const srcAd = adById(from.node), src = eff(srcAd), to = adById(toId);
    const k = kindOf(srcAd, from.part);
    const te = eff(to);
    const target = te.kinds[from.part] === k ? from.part : Object.entries(te.kinds).find(([, kk]) => kk === k)?.[0];
    if (!target) { hud(`That ad has no ${LABEL(k).toLowerCase()}; drag the part itself to move it there`); return; }
    history.remember(null);
    to.o.parts = to.o.parts || {};
    to.o.parts[target] = { ...src.parts[from.part] };
    if (k === "header") putCopy(to, target, src.copy[from.part] ?? "");
    tidy(to); sel = { node: toId, part: target }; renderAll();
    hud(`${LABEL(k)} grafted onto "${plainCopy(eff(to).copy.title)}"`);
  }

  // Host fields inside the panel: page title, words, data binding, link, actions.
  L.on($panel, "input", (ev: Event) => {
    const t = ev.target as HTMLInputElement;
    if (t.id === "cle-title") { history.remember("title"); doc.title = t.value.slice(0, 120) || undefined; renderSheet(); renderPanel(); renderOverlay(); renderStatus(); return; }
    if (!sel) return;
    if (t.id === "cle-txt") { const r = { ...sel }; clearTimeout((t as unknown as { _tm?: ReturnType<typeof setTimeout> })._tm); (t as unknown as { _tm?: ReturnType<typeof setTimeout> })._tm = setTimeout(() => setCopy(r.node, r.part, t.value, true), 350); return; }
    if (t.dataset.bind === "url") { const r = { ...sel }; clearTimeout((t as unknown as { _tm?: ReturnType<typeof setTimeout> })._tm); (t as unknown as { _tm?: ReturnType<typeof setTimeout> })._tm = setTimeout(() => setCopy(r.node, r.part, t.value.trim(), true), 400); return; }
    if (t.dataset.linkfield === "url" || t.dataset.linkfield === "label") {
      const ad = adById(sel.node), l = { ...(ad.link && ad.link.kind === "url" ? ad.link : { kind: "url" as const, url: "" }) };
      if (t.dataset.linkfield === "url") l.url = t.value; else l.label = t.value;
      history.remember(sel.node + "link" + t.dataset.linkfield); ad.link = l; renderSheet(); renderOverlay(); renderStatus();
    }
  });
  L.on($panel, "change", (ev: Event) => {
    const t = ev.target as HTMLSelectElement;
    if (t.dataset.linkfield === "threadId" && sel) setLink(sel.node, { kind: "thread", threadId: t.value });
    if (!sel || !t.dataset.bind) return;
    const ad = adById(sel.node), cur = items()[selInst];
    if (t.dataset.bind === "words") {
      if (t.value) setCopy(sel.node, sel.part, tokenFor(t.value));
      else setCopy(sel.node, sel.part, plainCopy(String(cur?.[soleToken(copyOf(ad, sel.part)) ?? ""] ?? "")) || "Your words");
      hud(t.value ? `Every card shows its own ${P?.fields.find((f) => f.key === t.value)?.label.toLowerCase() ?? t.value}` : "Fixed words: the same on every card");
    } else if (t.dataset.bind === "token" && t.value) {
      const raw = copyOf(ad, sel.part);
      setCopy(sel.node, sel.part, `${raw}${raw && !/\s$/.test(raw) ? " " : ""}${tokenFor(t.value)}`);
    } else if (t.dataset.bind === "src") {
      setCopy(sel.node, sel.part, t.value ? tokenFor(t.value) : "");
    }
  });
  L.on($panel, "click", (ev: MouseEvent) => {
    const b = (ev.target as HTMLElement).closest("button") as HTMLButtonElement | null; if (!b || !sel) return;
    if (b.dataset.link) {
      const k = b.dataset.link, cur = (adById(sel.node).link || {}) as { threadId?: string; url?: string; label?: string };
      setLink(sel.node, k === "item" ? { kind: "item" } : k === "thread" ? { kind: "thread", threadId: cur.threadId || "" } : k === "url" ? { kind: "url", url: cur.url || "", label: cur.label || "" } : { kind: "none" });
      return;
    }
    const act = b.dataset.cact; if (!act) return;
    const ad = adById(sel.node);
    if (act === "up") select(upOf(sel));
    else if (act === "copy") { clip = sel.part === ROOT ? { kind: "node", tree: { id: "x", kind: "body" }, parts: {}, copy: {}, style: { ...eff(ad).parts.frame }, nodeKind: "frame" } : nodeClip(ad, sel.part); renderPanel(); hud(`Copied ${(sel.part === ROOT ? thing : nodeName(ad, sel.part)).toLowerCase()} style`); }
    else if (act === "paste" && clip) { if (clip.kind === "node") pasteStyle(clip.style, clip.nodeKind); else doPaste(); }
    else if (act === "dup") doDuplicate();
    else if (act === "del") doDelete();
    else if (act === "earlier") doMove("earlier");
    else if (act === "later") doMove("later");
    else if (act === "group") wrapInBox(sel.node, sel.part, "row");
    else if (act === "ungroup") unwrapBox(sel.node, sel.part);
    else if (act === "savetpl") {
      const e = eff(ad); history.remember(null);
      const id = "t-user-" + doc.next++;
      const g = grid();
      const parts: Record<string, PartStyle> = {};
      for (const [nid, s] of Object.entries(e.parts)) parts[nid] = clone(s);
      const copy: Record<string, string> = {};
      for (const [nid, w] of Object.entries(e.copy)) if (w !== undefined && (isTextKind(e.kinds[nid]) || e.kinds[nid] === "image")) copy[nid] = w;
      doc.userTemplates[id] = {
        label: `${plainCopy(e.copy.header) || "Ad"}, your version`, family: e.famId,
        span: sameGrid(g, GRID_DEFAULT) ? [...e.span] as [number, number] : scaleSpan(e.span, g, GRID_DEFAULT),
        parts, copy, ...(ad.o.tree || tpl(ad.template).tree ? { tree: cloneTree(e.tree) } : {}),
      };
      renderAll(); hud("Saved as a template. Add new ads from it on the left.");
    }
  });

  L.on(R("rail"), "click", (ev: MouseEvent) => {
    const t = ev.target as HTMLElement;
    const add = t.closest("[data-add]") as HTMLElement | null;
    if (add) {
      history.remember(null); const n: Ad = { id: "ad" + doc.next++, template: add.dataset.add!, o: {}, link: { kind: "none" } };
      doc.ads.push(n); sel = { node: n.id, part: ROOT }; renderAll();
      find(sel)?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      hud("Added");
      return;
    }
    if (railDragged) { railDragged = false; return; }
    const ins = t.closest("[data-ins]") as HTMLElement | null;
    if (ins) { const x = INSERTS.find((i) => i.id === ins.dataset.ins); if (x) insertByClick(x); return; }
    const fld = t.closest("[data-field]") as HTMLElement | null;
    if (fld && P) { const f = P.fields.find((x) => x.key === fld.dataset.field); if (f) insertByClick(fieldInsert(f)); return; }
    const des = t.closest("[data-design]") as HTMLElement | null;
    if (des && P && doc.ads[0]) {
      history.remember(null);
      doc.ads[0] = { id: doc.ads[0].id, template: des.dataset.design!, o: {}, link: doc.ads[0].link ?? { kind: "item" } };
      sel = { node: doc.ads[0].id, part: ROOT }; renderAll(); hud(`Design: ${BASE_TEMPLATES[des.dataset.design!]?.label}. Undo brings the last one back.`);
    }
  });
  const fieldInsert = (f: FieldSpec) => ({ kind: (P?.fieldKinds?.[f.key] ?? (f.type === "image" ? "image" : "body")) as Exclude<Kind, "frame">, label: f.label, words: tokenFor(f.key) });
  // Press and pull a palette chip or a field onto the sheet.
  let railDragged = false;
  L.on(R("rail"), "pointerdown", (ev: PointerEvent) => {
    if (ev.button !== 0) return;
    const chip = (ev.target as HTMLElement).closest("[data-ins], [data-field]") as HTMLElement | null;
    if (!chip) return;
    const x0 = ev.clientX, y0 = ev.clientY;
    const move = (m: PointerEvent) => {
      if (Math.hypot(m.clientX - x0, m.clientY - y0) < 5) return;
      stop(); railDragged = true;
      if (chip.dataset.ins) { const x = INSERTS.find((i) => i.id === chip.dataset.ins)!; dragNode(m, null, { kind: x.kind, label: x.label, style: x.style }); }
      else if (P) { const f = P.fields.find((x) => x.key === chip.dataset.field); if (f) dragNode(m, null, fieldInsert(f)); }
      setTimeout(() => { railDragged = false; }, 50);
    };
    const stop = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", stop); };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", stop);
  });
  L.on(root, "click", (ev: MouseEvent) => {
    const b = (ev.target as HTMLElement).closest("[data-sel]") as HTMLElement | null;
    if (b && b.closest('[data-r="crumbs"]')) select(parseRef(b.dataset.sel!) as Sel | null);
  });
  L.on(R("freedom"), "click", (ev: MouseEvent) => {
    const b = (ev.target as HTMLElement).closest("button") as HTMLElement | null; if (!b) return;
    freedom = Number(b.dataset.level) as Freedom;
    R("freedom").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderAll(); hud(`${FREEDOM_LABEL[freedom]}: ${FREEDOM_HINT[freedom]}`);
  });
  const undo = () => { endInline(); if (history.undo()) { fixSel(); renderAll(); hud("Undone"); } };
  const redo = () => { endInline(); if (history.redo()) { fixSel(); renderAll(); hud("Redone"); } };
  L.on(R("undo"), "click", undo);
  L.on(R("redo"), "click", redo);

  async function save() {
    endInline();
    if (saving || !history.dirty()) return;
    saving = true; renderStatus();
    const snapshot = JSON.stringify(doc);
    try {
      const res = await opts.onSave(JSON.parse(snapshot));
      saving = false;
      if (res.ok) { history.markSaved(snapshot); renderStatus(history.dirty() ? "Saved; newer changes not saved yet" : "Saved"); }
      else renderStatus(res.error || "Could not save", true);
    } catch {
      // A rebuild since this page opened makes the save action unknown.
      saving = false; renderStatus("Could not save: the site was updated. Copy anything important, then reload.", true);
    }
  }
  L.on(R("save"), "click", save);

  L.on(document, "keydown", (ev: KeyboardEvent) => {
    const t = ev.target as HTMLElement;
    const inField = t.closest && t.closest("input, textarea, select, [contenteditable='true']");
    const mod = ev.ctrlKey || ev.metaKey;
    const k = ev.key.toLowerCase();
    if (mod && k === "s") { ev.preventDefault(); save(); return; }
    if (document.querySelector("[data-de-menu]")) return;
    if (inField || document.body.classList.contains("de-dragging") || document.body.classList.contains("de-resizing")) return;
    if (mod && k === "z") { ev.preventDefault(); ev.shiftKey ? redo() : undo(); return; }
    if (mod && k === "y") { ev.preventDefault(); redo(); return; }
    if (mod && k === "d") { ev.preventDefault(); doDuplicate(); return; }
    if (mod && k === "g" && sel && sel.part !== ROOT) { ev.preventDefault(); ev.shiftKey ? unwrapBox(sel.node, sel.part) : wrapInBox(sel.node, sel.part, "row"); return; }
    if (mod && k === "c" && sel) { ev.preventDefault(); doCopy(); return; }
    if (mod && k === "x" && sel) { ev.preventDefault(); doCut(); return; }
    if (mod && k === "v" && sel && clip) { ev.preventDefault(); doPaste(); return; }
    if (mod && (k === "b" || k === "i" || k === "u") && sel && sel.part !== ROOT) { ev.preventDefault(); miniHandlers.format(k); return; }
    if (mod || ev.altKey) return;
    if ((ev.key === "Delete" || ev.key === "Backspace") && sel) { ev.preventDefault(); doDelete(); return; }
    if (ev.key === "[") { ev.preventDefault(); doMove("first"); return; }
    if (ev.key === "]") { ev.preventDefault(); doMove("last"); return; }
    if (sel && !t.closest("button")) {
      if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") { ev.preventDefault(); doMove("earlier"); return; }
      if (ev.key === "ArrowRight" || ev.key === "ArrowDown") { ev.preventDefault(); doMove("later"); return; }
    }
    if (k === "v") { setTool("select"); return; }
    if (k === "h") { setTool("hand"); return; }
    if (k === "t") { setTool("text"); return; }
    if (k === "p") { setPanelOpen(!panelOpen); return; }
    if (k === "g") { setShowGrid(!showGrid); return; }
    if (ev.key === "=" || ev.key === "+") { viewport.step(1); return; }
    if (ev.key === "-") { viewport.step(-1); return; }
    if (ev.key === ")" || (ev.shiftKey && ev.key === "0")) { viewport.fit(); return; }
    if (ev.key === "Escape") {
      if (tool !== "select") { setTool("select"); return; }
      if (sel && !(t.closest && t.closest(".de-panel"))) select(upOf(sel));
      return;
    }
    if (ev.key === "Enter" && sel && !(t.closest && t.closest("button"))) {
      ev.preventDefault();
      const ad = adById(sel.node);
      if (sel.part === ROOT || isBox(ad, sel.part)) {
        const kids = sel.part === ROOT ? treeOf(doc, ad) : findNode(treeOf(doc, ad), sel.part)?.node.kids ?? [];
        const first = kids.find((n) => n.kind === "title") ?? kids[0];
        if (first) select({ node: sel.node, part: first.id });
      } else startInline(sel);
    }
  });
  L.on(window, "beforeunload", (ev: BeforeUnloadEvent) => { if (history.dirty()) ev.preventDefault(); });
  L.on(window, "resize", () => { renderOverlay(); if (showGrid) drawGuides(); });
  L.on($canvas, "scroll", renderOverlay);
  if (document.fonts?.ready) document.fonts.ready.then(() => renderOverlay());
  if (document.fonts) L.on(document.fonts, "loadingdone", renderOverlay);

  renderAll();
  viewport.fit();
  renderZoom();
  return () => { endInline(); L.dispose(); viewport.destroy(); mini.destroy(); panel.destroy(); clearTimeout(flashTimer); root.innerHTML = ""; };
}

/** The template kinds a pattern host may want to know (re-exported for hosts). */
export type { TextKind };

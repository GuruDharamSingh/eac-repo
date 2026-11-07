// ============================================================================
// Editing a page's structure (2026-11-02): boxes can leave their parent, be
// grouped, duplicated and deleted, because the page is a stored Puck document
// rather than markup we may only restyle.
//
// Own blocks (box, words, picture) are styled through the panel. Any other block
// is sealed: it moves like a box. With a contract its declared settings are in the
// panel too (block-fields.ts), stored on its props; without one they stay in the
// block editor, which opens the same document. To style around one, put it in a box.
//
// With a contract a sealed block can also be clicked into (2026-11-04, stone 2): a
// selection may be a part ref (block/contract.ts), and its look is stored in the node's
// `morph` (block/morph.ts). The node's own panel is its root part. A part cannot leave
// its block: move, group, detach and delete are for the node.
//
// The host draws: `draw(doc)` must have updated the page when it returns.
// ============================================================================

import { FONT_CATEGORIES, fontsIn, loadFont } from "@elkdonis/fonts";
import { contractFor, hasOwn, parsePartRef, partRef, propKey, propNameOf, propSlotId, ROOT_PART, sampleHasRows, tokenKey, tokenNameOf, tokenSlotId, type BlockContract, type EditorContract } from "../block/contract";
import { partLookOf, partSafeDecls, setPartLook, setToken, tokenOf } from "../block/morph";
import { cleanBoxDoc, PART_TYPE, duplicatePuckNode, findPuckNode, insertPuckNode, isWithin, mayPlace, movePuckNode, nodeLevels, OWN_TYPES, removePuckNode, ROOT_ID, ROOT_SLOT, unwrapPuckNode, walkDoc, wrapPuckNode, BOX_TAGS, WORD_TAGS, type FoundNode, type PuckDoc, type PuckNode, type SlotMap, type Spot } from "../block/puck-tree";
import { declsToString, safeDecls, type Decl, type PartStyle } from "../block/style";
import { normHex } from "../model/color";
import { History } from "../model/history";
import { setDecl } from "../model/css";
import { parseRich, sanitizeRich, toggleList, toggleWhole, wholeHas, type RNode } from "../model/richtext";
import { lookDecls } from "../block/patch";
import { Panel, type LayerRow, type PanelContext } from "../panel/panel";
import { applyKey, backgroundOf, boxSlots, inheritedFrom, readBox, resetKey, rgbHex, styleOverridden, styleValues, usedColoursIn } from "./box-panel";
import { adoptElement } from "./adopt";
import { applyShape, arrangeHtml, fullestOf, holdingOf, moved, noSwapWords, setInLine, setSequence, type Holding, type Shape } from "./arrange";
import { blockSlots, blockValues, cleanPropValue, isTypedProp, resetProp } from "./block-fields";
import { startBoxMove, startBoxResize } from "./box-drag";
import { mountClickThrough, type LayerSource } from "./clickthrough";
import { mountEditShell, type PictureChooser } from "./edit-shell";
import { Listeners, startGhostDrag, startInlineText, type InlineSession } from "./interact";
import { layerName, layerRole } from "./layers";
import type { MenuItem } from "./menu";
import { MiniBar, type MiniBarContext, type MiniBarStyle } from "./minibar";
import { startNodeDrag } from "./nodedrag";
import { partAbove, partEls, partKind, partOwners, partsInside } from "./parts";
import { openBlockPopup, type PopupHandle } from "./popup";
import { mountRecordChooser, type Binding } from "./records";

/** This mount is the popup's: a working copy of one block, its chrome in the frame (popup.ts). */
export interface NestedEditor {
  chrome: HTMLElement;
  layers: HTMLElement;
  blockId: string;
  fitWidth(): number;
  applyZoom(z: number): void;
  onClose(): void;
}

export interface TreeEditorOptions {
  doc: PuckDoc;
  slots: SlotMap;
  /** Where the page is drawn. */
  scope: HTMLElement;
  /** Draw the document; the page must be updated when this returns. */
  draw(doc: PuckDoc): void;
  /** Block type → name. */
  labels: Record<string, string>;
  /** Blocks that may be added, with their starting props. */
  catalogue?: Array<{ type: string; label: string; defaults: Record<string, unknown> }>;
  onSave(doc: PuckDoc): Promise<{ ok: boolean; error?: string }>;
  /** Said once before the first save (edit-shell). */
  saveNotice?: string;
  onDone?(): void;
  choosePicture?: PictureChooser;
  /** The old editor, on this same document: where a sealed block's settings are edited. */
  blockEditorHref?: string;
  /** The name on the left pill. Default: the page's title. */
  pageName?: string;
  /** Offer to go back to what the page was before it was a tree. */
  onRestore?(): void;
  /** What each sealed block declares. Absent: a sealed block offers no settings here, as before. */
  contract?: EditorContract;
  /** This node is drawn with sample rows. Anything that copies what it drew must refuse. */
  drawsSample?(node: PuckNode): boolean;
  /**
   * The developer tools: the Code tab (2026-11-06). Only `false` removes them, so a host that passes nothing keeps
   * them as before; the popup opened from Puck Studio passes the parts plugin's `developer` switch.
   */
  developer?: boolean;
  /** The host's sanitiser for a rich-text prop typed on the page (`sanitizePageText` via page-builder). Absent: the save path's sanitiser is the only one. */
  cleanRich?(html: string): string;
  /** Props that hold a reference to a record (`binds`): chosen in the drawer, drawn from what the host resolves (canvas/records.ts, 2026-11-06). Absent: such a prop is a text field, as before. */
  binding?: Binding;
  nested?: NestedEditor;
  /** A second mount on a working copy, for the popup. Absent: a sealed block does not open large. */
  mountNested?(m: { stage: HTMLElement; doc: PuckDoc; name: string; nested: NestedEditor; onSave(doc: PuckDoc): Promise<{ ok: boolean; error?: string }> }): TreeEditorHandle;
}

export interface TreeEditorHandle {
  doc(): PuckDoc;
  select(id: string | null): void;
  /** Opens a sealed block in the popup. */
  openLarge(id: string): void;
  /** Goes up a level; false when nothing is above the selection. */
  up(): boolean;
  dirty(): boolean;
  /** Zooms the page to the room it has. */
  fit(): void;
  /** Draws the selection again: the page moved underneath. */
  refresh(): void;
  /** Hands the cleaned document to onSave. */
  save(): void;
  dispose(): void;
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const NODE = "[data-tree-node]";
const SLOT = "[data-tree-slot]";
const newId = (type: string) => `${type}-${Math.random().toString(36).slice(2, 10)}`;
const LOOK_ONLY = ["order", "cspan", "w", "h", "self", "grow", "hide"] as const;
const BOX_KIND_LABELS: Record<string, string> = { div: "Box", section: "Section", header: "Header", footer: "Footer", nav: "Navigation", aside: "Aside", article: "Article", main: "Main", figure: "Figure", ul: "List", ol: "Numbered list", li: "Item", blockquote: "Quote", figcaption: "Caption", span: "Inline box" };
const WORD_KIND_LABELS: Record<string, string> = { p: "Paragraph", h1: "Heading 1", h2: "Heading 2", h3: "Heading 3", h4: "Heading 4", h5: "Heading 5", h6: "Heading 6", div: "Text", span: "Label", li: "Item", blockquote: "Quote", figcaption: "Caption", hr: "Divider" };
const LIBRARY_FONTS = FONT_CATEGORIES.map((c) => ({ label: c.label, names: fontsIn(c.id).map((f) => f.family) }));
export const firstFamily = (css: string) => css.split(",")[0]?.trim().replace(/^["']|["']$/g, "") ?? "";
/** What a box hands down to what is inside it. */
export const INHERITED = /^(color$|font|letter-spacing$|word-spacing$|line-height$|text-(align|indent|transform|shadow)$|white-space$|hyphens$|cursor$|visibility$)/;
export const kindOfRole = (role: string, fallback: string) => (role === "Row" ? "row" : role === "Column" ? "column" : role === "Grid" ? "grid" : role === "Picture" ? "image" : fallback);

// Exported 2026-11-06 for the look panel inside Puck (puck/look-panel.ts), which shares them.
/** The look as the Code tab shows it, one declaration a line. */
export function codeText(look: PartStyle): string {
  const { hide: _hide, ...shown } = look;
  return lookDecls(shown).map(([k, v]) => `${k}: ${v};`).join("\n");
}
/** What was typed in the Code tab is now the whole look; what it did not keep is listed there. */
export function setCodeText(s: PartStyle, text: string, sanitize: (css: string) => Decl[] = safeDecls): void {
  const hide = s.hide;
  for (const k of Object.keys(s)) delete (s as Record<string, unknown>)[k];
  if (hide) s.hide = true;
  const kept = declsToString(sanitize(text));
  if (kept) s.css = kept;
}
/** A panel field wins over the same property typed in the Code tab, or changing the field would do nothing. */
export function settleCss(s: PartStyle): void {
  if (!s.css) return;
  const { css, ...fields } = s;
  const set = lookDecls(fields).map(([k]) => k);
  const kept = safeDecls(css).filter(([k]) => !set.some((v) => k === v || k.startsWith(`${v}-`)));
  if (kept.length) s.css = declsToString(kept); else delete s.css;
}
export function dropCss(s: PartStyle, props: string[]): void {
  if (!s.css) return;
  const kept = safeDecls(s.css).filter(([k]) => !props.includes(k));
  if (kept.length) s.css = declsToString(kept); else delete s.css;
}
/** Words typed in place as a rich-text prop: the inline markup's lines become paragraphs, as the block's own rich text is stored. */
export function richToParagraphs(rich: string): string {
  const out: string[] = [];
  let line = "";
  const flush = () => { if (line.replace(/<[^>]*>/g, "").trim()) out.push(`<p>${line}</p>`); line = ""; };
  for (const seg of rich.split(/(<ul>[\s\S]*?<\/ul>)/)) {
    if (seg.startsWith("<ul>")) { flush(); out.push(seg); continue; }
    seg.split("<br>").forEach((l, i) => { if (i > 0) flush(); line += l; });
  }
  flush();
  return out.join("");
}
/** Markup a rich-text prop may hold that typing in place would lose (inline editing keeps b, i, u, links, bullets and lines). */
const RICH_NOT_INLINE = /<(h[1-6]|blockquote|ol|img|table|pre|s|strike|del|figure|hr)\b/i;
const TYPABLE = new Set(["string", "text", "richtext"]);
const plainOf = (n: RNode): string => (n.t === "text" ? n.v : n.kids.map(plainOf).join(""));
export const FONT_GROUPS = { inPage: [], family: [], library: true };
/** `color(srgb .2 .3 .4)` is how a browser reports a color-mix(). */
export function srgbHex(c: string): string | undefined {
  const m = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(c);
  return m ? "#" + [m[1], m[2], m[3]].map((n) => Math.round(Math.min(1, Number(n)) * 255).toString(16).padStart(2, "0")).join("") : undefined;
}
export const quoted = (el: Element) => /“(.*)”$/.exec(layerName(el))?.[1];
/** What the menu lists and leaves grey on a part: these act on a whole block. */
const NODE_ONLY = new Set(["group", "groupcol", "ungroup", "detach", "dup", "first", "last", "delete"]);

export function mountTreeEditor(o: TreeEditorOptions): TreeEditorHandle {
  const L = new Listeners();
  const { slots, scope } = o;
  let doc: PuckDoc = clone(o.doc);
  // Puck also accepts a root without `props`; the page root edits need one place to write.
  const r0 = doc.root as Record<string, unknown> | undefined;
  doc.root = r0 && typeof r0 === "object" ? ("props" in r0 ? r0 : { props: r0 }) : { props: {} };
  if (!(doc.root as { props?: unknown }).props) (doc.root as { props?: unknown }).props = {};
  let selId: string | null = null;
  let busy = false;
  let inline: InlineSession | null = null;
  let styleClip: PartStyle | null = null;
  let tool: "select" | "hand" = "select";
  let presenting = false;
  let zoom = 1;
  let scale: MiniBarStyle[] | null = null;
  /** The block setting being typed in: its letters are one undo step, however long the pauses. */
  let typing: string | null = null;
  /** The slot id whose last typed value was not kept. */
  let refused: { field: string; message: string } | null = null;
  /** Shown in place of the hint for a while: the click that left a field may also select something, which redraws the top bar. */
  let heldNote: { text: string; until: number } | null = null;
  let popup: PopupHandle | null = null;
  let panelWasHidden = false;

  const rootEl = () => scope.querySelector<HTMLElement>("[data-page-root]") ?? scope.querySelector<HTMLElement>(`[data-tree-slot="${ROOT_ID}:${ROOT_SLOT}"]`);
  const nodeEl = (id: string) => scope.querySelector<HTMLElement>(`[data-tree-node="${CSS.escape(id)}"]`);
  const elOf = (id: string | null): HTMLElement | null => {
    const pr = parsePartRef(id);
    if (!pr) return id === ROOT_ID ? rootEl() : id ? nodeEl(id) : null;
    const at = nodeEl(pr.id), n = found(pr.id)?.node;
    const parts = n && defOf(n)?.parts;
    return at && parts && hasOwn(parts, pr.part) ? partEls(at, parts[pr.part]!.sel)[pr.i ?? 0] ?? null : null;
  };
  const idOf = (el: HTMLElement | null) => {
    if (!el) return null;
    if (el.dataset.treeNode !== undefined) return el.dataset.treeNode;
    if (el === rootEl()) return ROOT_ID;
    const hit = partHit(el);
    // The clicked one, where the part draws several.
    return hit ? partRef(hit.nodeEl.dataset.treeNode!, hit.name, hit.count > 1 ? hit.i : undefined) : null;
  };
  /** The page itself reads like a box in the panel, and holds no place in a list. A part selects its node's place. */
  const found = (id: string | null): FoundNode | null => {
    if (!id) return null;
    if (id === ROOT_ID) return { node: { type: "box", props: (doc.root as { props: PuckNode["props"] }).props }, list: [], parent: "", slot: "", index: 0, depth: 0 };
    return findPuckNode(doc, slots, parsePartRef(id)?.id ?? id);
  };
  const own = (n: PuckNode | undefined | null) => !!n && OWN_TYPES.has(n.type);
  /** The Code tab is a developer tool: gone only when the host says `developer: false`. */
  const devTabs = (tabs: NonNullable<PanelContext["tabs"]>): PanelContext["tabs"] => (o.developer === false ? tabs.filter((t) => t !== "code") : tabs);
  /** `look` on a sealed block is the block's own setting (faq's divided or boxed), not a style. A host with no contract keeps these rows as they were. */
  const lookIsSetting = (n: PuckNode | undefined | null) => !!o.contract && !!n && !own(n);
  const slotsFor = (type: string) => (hasOwn(slots, type) ? slots[type] : undefined);
  const firstSlot = (n: PuckNode) => slotsFor(n.type)?.[0]?.name ?? null;
  const labelFor = (type: string) => (hasOwn(o.labels, type) ? o.labels[type]! : type);
  /** What this sealed block declares. An own block's look is not a morph, so it has none. */
  const defOf = (n: PuckNode): BlockContract | undefined => (own(n) ? undefined : contractFor(o.contract, n.type));
  const ownersOf = (at: HTMLElement) => {
    const n = found(at.dataset.treeNode ?? null)?.node;
    return partOwners(at, n && defOf(n));
  };
  /** Which part this element is, found from the declaration each time, so a block's own redraw leaves nothing stale. */
  const partHit = (el: HTMLElement) => {
    if (!o.contract) return null;
    const at = el.closest<HTMLElement>(NODE);
    if (!at || at === el) return null;
    const owners = ownersOf(at), hit = owners.get(el);
    return hit ? { ...hit, nodeEl: at, owners } : null;
  };

  const history = new History<PuckDoc>(() => doc, (d) => {
    doc = d;
    // A field still holding focus is not touched by a soft redraw, and it must show the undone value. With no typing session too, or it keeps the text from before the undo.
    const stale = typing !== null || (!!o.contract && !!document.activeElement && side.contains(document.activeElement));
    typing = null;
    refused = null;
    redraw(stale);
  });
  function setZoom(z: number | "fit") {
    if (o.nested) {
      zoom = z === "fit" ? Math.max(0.25, Math.min(1, o.nested.fitWidth() / Math.max(1, scope.scrollWidth))) : z;
      o.nested.applyZoom(zoom);
      ct.refresh();
      renderBar();
      return;
    }
    if (z === "fit") { (scope.style as CSSStyleDeclaration & { zoom: string }).zoom = "1"; zoom = Math.max(0.25, Math.min(1, (scope.parentElement?.clientWidth ?? scope.clientWidth) / Math.max(1, scope.scrollWidth))); }
    else zoom = z;
    (scope.style as CSSStyleDeclaration & { zoom: string }).zoom = String(zoom);
    ct.refresh();
    renderBar();
  }
  const shell = mountEditShell<PuckDoc>({
    host: o.nested?.chrome,
    saveLabel: o.nested ? "Use on this page" : undefined,
    doneLabel: o.nested ? "Close" : undefined,
    onClose: o.nested?.onClose,
    history,
    save: () => cleanBoxDoc(doc),
    onSave: o.onSave,
    saveNotice: o.saveNotice,
    onDone: () => { if (o.onDone) o.onDone(); else handle.dispose(); },
    pageName: () => o.pageName ?? ((doc.root as { props: { title?: string } }).props.title || "Page"),
    pageMenu: o.onRestore ? () => [{ id: "restore", label: "Restore the original page", danger: true }] : undefined,
    onPageMenu(id) {
      if (id === "restore" && confirm("Go back to the page as it was before it became editable boxes? Changes made here are lost.")) { history.markSaved(); o.onRestore?.(); }
    },
    tools: o.nested ? [{ id: "tool-select", label: "Select", icon: "tool-select", toggle: true }] : [
      { id: "tool-select", label: "Select", icon: "tool-select", key: "V", toggle: true },
      { id: "tool-hand", label: "Hand", icon: "tool-hand", key: "H", toggle: true },
      { id: "add-words", label: "Add words", icon: "tool-text", key: "T" },
      { id: "add-box", label: "Add a box", icon: "hash", key: "F" },
      { id: "add-picture", label: "Add a picture", icon: "k-image" },
      { id: "tool-note", label: "Note (comes with the board)", icon: "note", disabled: true },
      { id: "tool-pen", label: "Pen (comes with the board)", icon: "pen", disabled: true },
      { id: "tool-shape", label: "Shape (comes with the board)", icon: "oval", disabled: true },
    ],
    onTool(a) {
      if (a.startsWith("add-")) addNew(a.slice(4));
      else if (a === "tool-select" || a === "tool-hand") setTool(a === "tool-hand" ? "hand" : "select");
    },
    activeTool: () => `tool-${tool}`,
    panel: o.nested ? undefined : {
      open: () => !side.hidden,
      toggle() { side.hidden = !side.hidden; document.documentElement.classList.toggle("de-vpanel-open", !side.hidden); ct.refresh(); renderBar(); },
    },
    zoom: {
      value: () => zoom,
      set: setZoom,
    },
    present: o.nested ? undefined : {
      on: () => presenting,
      toggle() {
        presenting = !presenting;
        document.documentElement.classList.toggle("de-present", presenting);
        ct.hold(presenting);
        renderBar();
      },
    },
    hint: () => (heldNote && Date.now() < heldNote.until ? heldNote.text : o.nested ? (parsePartRef(selId) ? "A part of this block. Double-click its words to type them. Drag it to change its place. Esc goes back out." : "Click a part to go inside it. Drag a part to change its place. Esc closes.") : o.mountNested && !parsePartRef(selId) && selId !== ROOT_ID && (!selId || canOpenLarge(selId)) ? (selId ? "Double-click to open this block large. Click again to go inside." : "Double-click a block to open it large.") : parsePartRef(selId) ? "A part of this block. It stays where the block puts it. Esc goes back out." : selId === ROOT_ID ? "The page itself. Click a part of it to go inside." : selId ? "Click again to go inside. Drag it to move it into another box. Esc goes back out." : "Click a part of the page, or add a box."),
    choosePicture: o.choosePicture,
  });

  const side = document.createElement("div");
  // The class keeps direct-edit.css's popover rule off a host with no contract.
  side.className = o.contract ? "de-vpanel de-has-contract" : "de-vpanel";
  side.dataset.deUi = "";
  (o.nested?.chrome ?? document.body).append(side);
  if (!o.nested) {
    document.documentElement.classList.add("de-vpanel-open");
    // A phone starts with the page, not the panel.
    if (window.innerWidth <= 760) { side.hidden = true; document.documentElement.classList.remove("de-vpanel-open"); }
  }

  // --------------------------------------------------------------- arrange
  /** The selection and what holds it, in the popup. */
  function arrangeFacts(): { node: PuckNode; at: HTMLElement; el: HTMLElement; inside: Holding; around: Holding | null; aroundLabel: string; label: string; declares: boolean; nested: Array<{ holder: string; parts: string[] }> } | null {
    const f = found(selId), el = elOf(selId);
    if (!o.nested || !f || !el || own(f.node)) return null;
    const def = defOf(f.node), at = nodeEl(f.node.props.id);
    if (!def || !at) return null;
    const owners = partOwners(at, def);
    const inside = holdingOf(at, fullestOf(el, owners), owners, f.node.props);
    const pr = parsePartRef(selId);
    const around = pr && el.parentElement ? holdingOf(at, el.parentElement, owners, f.node.props) : null;
    const up = pr ? partAbove(at, el, owners) : null;
    const nested = inside.kids.map((k) => ({ holder: k.label, parts: [...new Set(partsInside(at, k.els[0]!, owners).map((e) => owners.get(e)!.part.label))] })).filter((n) => n.parts.length);
    return {
      node: f.node, at, el, inside, around, nested,
      label: pr ? owners.get(el)?.part.label ?? "" : def.label,
      aroundLabel: up ? owners.get(up)!.part.label : def.label,
      declares: Object.keys(def.parts ?? {}).some((n) => n !== ROOT_PART),
    };
  }
  function arrangeAct(act: string) {
    const a = arrangeFacts();
    if (!a) return;
    const [verb, x, y] = act.split(":");
    if (verb === "as") { change(() => applyShape(a.node.props, a.inside, x as Shape), undefined, true); fitAgain(); }
    else if (verb === "move") { const names = moved(a.inside, x!, Number(y)); if (names) change(() => { setSequence(a.node.props, a.inside, names); }, undefined, true); }
    else if (verb === "place" && a.around) {
      const me = a.around.kids.find((k) => k.label === a.label);
      const names = me && moved(a.around, me.name, Number(x));
      if (names) change(() => { setSequence(a.node.props, a.around!, names); }, undefined, true);
    } else if (verb === "line") {
      change(() => setInLine(a.node.props, x!, y === "1"), undefined, true);
    }
  }
  /** A shape can change the block's height: the fitted box follows on its own, and the selection is measured again. */
  function fitAgain() { requestAnimationFrame(() => { ct.refresh(); renderBar(); }); }
  /** Press on the block and pull: the innermost part under the pointer that has something to change places with. */
  function arrangeDrag(ev: PointerEvent, pressed: HTMLElement) {
    const chain = source.chain(ev.target as Element), from = chain.indexOf(pressed);
    const at = pressed.closest<HTMLElement>(NODE), n = at ? found(at.dataset.treeNode ?? null)?.node : null;
    if (from < 0 || !at || !n || own(n)) return;
    const def = defOf(n), owners = partOwners(at, def);
    const parts = chain.slice(from).filter((e) => owners.has(e));
    const say = (text: string) => { heldNote = { text, until: Date.now() + 6000 }; shell.drawTop(); };
    let moving: HTMLElement | null = null, h: Holding | null = null;
    for (const e of [...parts].reverse()) {
      const held = e.parentElement ? holdingOf(at, e.parentElement, owners, n.props) : null;
      if (held && held.kids.length >= 2 && held.kids.some((k) => k.els.includes(e))) { moving = e; h = held; break; }
    }
    if (!moving || !h) {
      const e = parts[parts.length - 1];
      if (e?.parentElement) {
        const up = partAbove(at, e, owners);
        say(noSwapWords(owners.get(e)!.part.label, holdingOf(at, e.parentElement, owners, n.props), up ? owners.get(up)!.part.label : labelFor(n.type)));
      }
      return;
    }
    const held = h, el = moving, name = owners.get(el)!.part.label;
    const mine = held.kids.flatMap((k) => k.els);
    let warned = false;
    busy = true;
    bar.hide();
    ct.hold(true);
    startBoxMove({
      ev, el, name,
      host: o.nested?.chrome,
      among: mine,
      onMove(m) {
        // Over a part it can never reach: say why, in words, rather than doing nothing.
        const under = document.elementFromPoint(m.clientX, m.clientY);
        let hit: HTMLElement | null = null;
        for (let e = under as HTMLElement | null; e && e !== at && !hit; e = e.parentElement) if (owners.has(e)) hit = e;
        const away = !!hit && hit !== el && !mine.includes(hit) && !el.contains(hit) && !mine.some((k) => k.contains(hit!));
        if (away) { warned = true; shell.drawTop(`${name} and ${owners.get(hit!)!.part.label} sit in different containers in this block's code, so they cannot swap.`); }
        else if (warned) { warned = false; shell.drawTop(`${name} can change places with ${held.kids.map((k) => k.label).filter((l) => l !== name).join(", ")}.`); }
      },
      onDrop(seq) {
        const names = [...new Set(seq.map((e) => owners.get(e)!.name))];
        selId = idOf(el);
        change(() => {
          if (!setSequence(n.props, held, names)) say("The box around these belongs to the block's code, so their order cannot change.");
        }, undefined, true);
      },
      onEnd() { busy = false; ct.hold(false); ct.adopt(elOf(selId)); shell.drawTop(); renderBar(); },
    });
  }

  // ----------------------------------------------------------------- popup
  const canOpenLarge = (id: string | null) => {
    const n = found(id)?.node;
    return !!o.mountNested && !!n && id !== ROOT_ID && !own(n) && n.type !== PART_TYPE && !!defOf(n);
  };
  /** The page's editor while the popup is over it: no clicks, no keys, no panel or bar. The page stays where it is. */
  function pause(on: boolean) {
    if (on) {
      if (tool === "hand") setTool("select");
      panelWasHidden = side.hidden;
      side.hidden = true;
      busy = true;
      bar.hide();
      shell.closePicture();
      shell.pause(true);
      ct.hold(true);
    } else {
      busy = false;
      side.hidden = panelWasHidden;
      shell.pause(false);
      ct.hold(false);
    }
  }
  function openLarge(ref: string | null) {
    const id = parsePartRef(ref)?.id ?? ref, f = found(id), el = id ? nodeEl(id) : null;
    if (!id || !f || !el || popup || !canOpenLarge(id)) return;
    const name = labelFor(f.node.type);
    const working = { root: clone(doc.root), content: [clone(f.node)] } as PuckDoc;
    const width = el.offsetWidth || el.getBoundingClientRect().width;
    pause(true);
    popup = openBlockPopup({
      name, scope, width,
      measure: (stage) => stage.querySelector<HTMLElement>(`[data-tree-node="${CSS.escape(id)}"]`),
      mount: (h) => o.mountNested!({
        stage: h.stage, doc: working, name,
        nested: { chrome: h.chrome, layers: h.layers, blockId: id, fitWidth: h.fitWidth, applyZoom: h.applyZoom, onClose: h.close },
        // One undo step on the page. Nothing is public until the page's own Save.
        async onSave(saved) {
          const node = saved.content?.[0];
          if (node) structural(() => { const g = found(id); if (g) g.list.splice(g.index, 1, node); return id; });
          popup?.close();
          return { ok: true };
        },
      }),
      onClosed() { popup = null; pause(false); selId = id; redraw(true); },
    });
  }

  function setTool(next: "select" | "hand") {
    tool = next;
    document.documentElement.classList.toggle("de-pan", next === "hand");
    ct.hold(next === "hand");
    shell.drawTop();
    renderBar();
  }
  L.on(document, "pointerdown", (ev: PointerEvent) => {
    if (tool !== "hand" || ev.button !== 0 || (ev.target as Element).closest?.("[data-de-ui],[data-de-menu]")) return;
    ev.preventDefault();
    let x = ev.clientX, y = ev.clientY;
    document.documentElement.classList.add("de-panning");
    const move = (m: PointerEvent) => { window.scrollBy(x - m.clientX, y - m.clientY); x = m.clientX; y = m.clientY; };
    const up = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); document.documentElement.classList.remove("de-panning"); };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  }, true);

  // --------------------------------------------------------------- drawing
  /** Put the page and everything around it right after any change. A moved node is a new element, so the selection is found again by id. */
  function redraw(fullPanel = false) {
    o.draw(doc);
    scale = null;
    // A part can stop drawing (its prop was emptied): the selection goes to the same part's first instance, else its node, and the panel says so.
    const pr = parsePartRef(selId);
    if (pr && !elOf(selId)) {
      const first = partRef(pr.id, pr.part);
      selId = pr.i !== undefined && elOf(first) ? first : pr.id;
      fullPanel = true;
    }
    ct.adopt(elOf(selId));
    if (selId && !elOf(selId)) selId = null;
    panel.render(context(), fullPanel);
    shell.drawTop();
    renderBar();
  }
  /** Change the document as one undo step, unless `live` runs coalesce under the same field. */
  function change(fn: () => void, field?: string, fullPanel = false) {
    history.remember(field ?? null);
    fn();
    redraw(fullPanel);
  }
  function select(id: string | null) { selId = id; ct.select(elOf(id)); }
  function structural(fn: () => string | null | void) {
    history.remember(null);
    const next = fn();
    if (next !== undefined) selId = next as string | null;
    redraw(true);
  }

  // ---------------------------------------------------------------- layers
  const source: LayerSource = {
    chain(target) {
      const out: HTMLElement[] = [];
      for (let e = target?.closest?.(NODE) as HTMLElement | null; e && scope.contains(e); e = e.parentElement?.closest(NODE) as HTMLElement | null) out.unshift(e);
      // Then the parts of the innermost node that hold the target, outermost first.
      const inner = out[out.length - 1];
      if (o.contract && inner) {
        const owners = ownersOf(inner), at = out.length;
        for (let e = target as HTMLElement | null; e && e !== inner; e = e.parentElement) if (owners.has(e)) out.splice(at, 0, e);
      }
      return out;
    },
    kids(el) {
      const root = el === rootEl();
      const hit = root ? null : partHit(el);
      if (hit) return partsInside(hit.nodeEl, el, hit.owners);
      const nested = Array.from(el.querySelectorAll<HTMLElement>(NODE)).filter((k) => (k.parentElement?.closest(NODE) ?? null) === (root ? null : el));
      return o.contract && !root && el.dataset.treeNode !== undefined ? [...partsInside(el, el, ownersOf(el)), ...nested] : nested;
    },
    parent(el) {
      if (el === rootEl() || (o.nested && el.dataset.treeNode === o.nested.blockId)) return null;
      const hit = partHit(el);
      if (hit) return partAbove(hit.nodeEl, el, hit.owners) ?? hit.nodeEl;
      return (el.parentElement?.closest(NODE) as HTMLElement | null) ?? rootEl();
    },
    name(el) {
      const id = idOf(el);
      if (id === ROOT_ID) return "Page";
      const hit = parsePartRef(id) ? partHit(el) : null;
      if (hit) return hit.part.label;
      const n = found(id)?.node;
      if (n && !own(n)) return labelFor(n.type);
      return n?.props.anchor ? `${layerRole(el)} #${n.props.anchor as string}` : layerName(el);
    },
  };

  /** A sealed block's parts as rows under it, nested as the page draws them. A part not drawn has no row; a repeated part is one row. */
  function partRows(id: string, node: PuckNode, at: HTMLElement, depth: number): LayerRow[] {
    const owners = partOwners(at, defOf(node));
    const firsts = new Map<string, HTMLElement>();
    for (const [el, hit] of owners) if (!firsts.has(hit.name)) firsts.set(hit.name, el);
    const under = new Map<string, string[]>();
    for (const [name, el] of firsts) {
      const above = partAbove(at, el, owners);
      const key = above ? owners.get(above)!.name : "";
      under.set(key, [...(under.get(key) ?? []), name]);
    }
    const sel = parsePartRef(selId), out: LayerRow[] = [];
    const emit = (key: string, parent: string, d: number) => {
      for (const name of under.get(key) ?? []) {
        const el = firsts.get(name)!, hit = owners.get(el)!, ref = partRef(id, name), kind = partKind(el);
        out.push({
          ref, parent, depth: d, kind, name: hit.part.label,
          note: hit.count > 1 ? `×${hit.count}` : undefined,
          text: hit.count > 1 ? undefined : quoted(el),
          selected: sel?.id === id && sel.part === name,
          canHide: true, hidden: !!partLookOf(node.props, name).hide, open: true,
        });
        emit(name, ref, d + 1);
      }
    };
    emit("", id, depth + 1);
    return out;
  }

  function rows(): LayerRow[] {
    const title = (doc.root as { props: { title?: string } }).props.title;
    const out: LayerRow[] = [{ ref: ROOT_ID, kind: "frame", name: "Page", note: title || undefined, depth: 0, selected: selId === ROOT_ID, open: true }];
    walkDoc(doc, slots, ({ node, parent, depth }) => {
      const id = node.props.id, el = elOf(id);
      const isOwn = own(node);
      const role = el && isOwn ? layerRole(el) : labelFor(node.type);
      const parts = el && !isOwn && o.contract ? partRows(id, node, el, depth) : [];
      const given = node.props.anchor ? `#${node.props.anchor as string}` : (node.props.label as string | undefined);
      const words = el && isOwn && !given ? /“(.*)”$/.exec(layerName(el))?.[1] : undefined;
      out.push({
        ref: id, depth, parent,
        kind: kindOfRole(role, slotsFor(node.type)?.length ? "frame" : isOwn ? "text" : "frame"),
        name: role, note: given, text: words, selected: id === selId, canHide: isOwn, hidden: !!(node.props.look as PartStyle | undefined)?.hide,
        // A block's parts stay folded, so the tree stays short; selecting it or one of them opens the row.
        link: !!node.props.href, open: depth <= 3 && !parts.length,
        // A page node's row can be pulled to another place in the tree (2026-11-07). Not in the popup: it holds one block.
        draggable: !o.nested,
      });
      out.push(...parts);
      // Marked runs inside words are layers too, as on the canvas; selecting one selects its words.
      if (node.type === "words") {
        parseRich((node.props.html as string | undefined) ?? "", { list: true }).forEach((n, i) => {
          if (n.t !== "el") return;
          out.push({ ref: `${id}~${i}`, kind: "text", name: n.tag === "a" ? "Link" : "Text", text: plainOf(n), depth: depth + 1, parent: id, link: n.tag === "a" });
        });
      }
    });
    // The popup's tree is rooted at its block, and the block's parts show from the start.
    if (o.nested) return out.slice(1).map((r) => ({ ...r, depth: r.depth - 1, parent: r.parent === ROOT_ID ? undefined : r.parent, open: r.ref === o.nested!.blockId ? true : r.open }));
    return out;
  }
  /** A marked run in words stands for its words. A part ref is a selection of its own. */
  const baseOf = (ref: string) => (parsePartRef(ref) ? ref : ref.split("~")[0]!);

  /** What this box takes from the boxes around it, nearest first, each group only what nothing nearer has set. */
  function fromGroups(id: string, ownLook: PartStyle) {
    const seen = new Set(lookDecls(ownLook).map(([k]) => k));
    const groups: Array<{ kind: string; tag: string; rows: Array<{ prop: string; value: string }> }> = [];
    let at = found(id)?.parent ?? "";
    while (at) {
      const a = found(at), el = elOf(at);
      if (!a) break;
      if (own(a.node) && el) {
        const list = lookDecls((a.node.props.look ?? {}) as PartStyle).filter(([k]) => INHERITED.test(k) && !seen.has(k));
        list.forEach(([k]) => seen.add(k));
        if (list.length) groups.push({ kind: kindOfRole(layerRole(el), "frame"), tag: el.tagName.toLowerCase(), rows: list.map(([prop, value]) => ({ prop, value })) });
      }
      at = at === ROOT_ID ? "" : a.parent;
    }
    return groups;
  }

  /** Why Detach would put something false in the document, or null. It copies what the element drew. A host with no contract keeps Detach as it was. */
  function detachRefusal(node: PuckNode, el: HTMLElement): string | null {
    if (!o.contract) return null;
    if (o.drawsSample?.(node)) return sampleHasRows(o.contract, node.type) ? "This block is showing sample rows. Detach would keep them as if they were yours." : "This block has no rows to show here, so there is nothing to detach.";
    if (el.dataset.treeStandin !== undefined) return "This block cannot draw here, so there is nothing to detach.";
    if (el.dataset.treeEmpty !== undefined || el.classList.contains("de-tree-empty")) return "This block has drawn nothing yet, so there is nothing to detach.";
    return null;
  }

  // ----------------------------------------------------------------- panel
  /** The tabs for a selection in this block: a block with tokens has Tweaks too. */
  const tabsOf = (def: BlockContract): PanelContext["tabs"] => devTabs(def.tokens?.length ? ["props", "code", "tweaks"] : ["props", "code"]);

  /** What a box's sections read from the page. */
  function styleContext(el: HTMLElement, look: PartStyle): Pick<PanelContext, "computed" | "fonts" | "contrast"> {
    const computed = readBox(el);
    return {
      computed,
      fonts: FONT_GROUPS,
      contrast: { fg: (look.color ?? computed.color) as string | undefined, bg: backgroundOf(el), size: computed.size as number, weight: computed.weight as number },
    };
  }

  /** "This block" in Tweaks: each token as stored, else what the page gives it now, so none is blank. */
  function tweaksOf(def: BlockContract, node: PuckNode): PanelContext["tweaks"] {
    if (!def.tokens?.length) return undefined;
    const at = nodeEl(node.props.id);
    const page = at ? getComputedStyle(at) : null;
    // Resolves what a colour or a length token holds (color-mix(), rem) to a value a field can show.
    const probe = side.appendChild(document.createElement("div"));
    const read = (prop: "color" | "width", raw: string) => { probe.style[prop] = ""; probe.style[prop] = raw; return getComputedStyle(probe)[prop]; };
    const slots: PanelContext["slots"] = [], values: Record<string, unknown> = {}, overridden: Record<string, boolean> = {};
    for (const t of def.tokens) {
      const key = tokenKey(t.name), stored = tokenOf(node.props, t.name);
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

  /** The panel on a part: a box's sections on its look. It has no tag or link of its own, so no Kind and no Link. */
  function partContext(base: PanelContext, node: PuckNode, name: string, el: HTMLElement): PanelContext | null {
    const def = defOf(node), part = def?.parts && hasOwn(def.parts, name) ? def.parts[name] : undefined;
    if (!def || !part) return null;
    const look = partLookOf(node.props, name);
    // The part's own words or picture first, where the block draws them from a prop.
    const field = part.prop ? blockSlots(def, node.props).filter((s) => s.key === propKey(part.prop!)).map((s) => ({ ...s, section: "content" as const })) : [];
    const fields = blockValues(def, node.props);
    const at = nodeEl(node.props.id);
    const count = part.repeat && at ? partEls(at, part.sel).length : 0;
    const groups = new Map<Element, { kind: string; tag: string; rows: Array<{ prop: string; value: string }> }>();
    for (const r of inheritedFrom(el)) {
      if (!groups.has(r.source)) groups.set(r.source, { kind: kindOfRole(layerRole(r.source), "frame"), tag: r.source.tagName.toLowerCase(), rows: [] });
      groups.get(r.source)!.rows.push({ prop: r.prop, value: rgbHex(r.value) ?? r.value });
    }
    return {
      ...base,
      ...styleContext(el, look),
      tabs: tabsOf(def),
      key: selId!,
      heading: part.label,
      sub: def.label,
      stickHead: true,
      slots: [...field, ...boxSlots(el, look)],
      values: { ...styleValues(look), ...(part.prop ? { [propKey(part.prop)]: fields.values[propKey(part.prop)] } : {}) },
      overridden: { ...styleOverridden(look), ...(part.prop ? { [propKey(part.prop)]: !!fields.overridden[propKey(part.prop)] } : {}) },
      tweaks: tweaksOf(def, node),
      notice: count > 1 ? `All ${count} change together.` : undefined,
      code: { written: [], css: codeText(look), editable: true, sanitize: partSafeDecls, sheet: { tag: el.tagName.toLowerCase(), hint: quoted(el), from: [...groups.values()] } },
    };
  }

  function context(): PanelContext {
    const f = found(selId), el = elOf(selId);
    const base: PanelContext = { tabs: devTabs(["props", "code"]), layersOnCode: true, key: "", heading: "", freedom: 2, slots: [], values: {}, overridden: {}, outside: [], theme: [], used: usedColoursIn(scope), layers: rows() };
    // In the popup, how the block is laid out comes first.
    const arr = o.nested ? arrangeFacts() : null;
    if (arr) {
      base.leadSection = "layout";
      base.sectionTop = { layout: arrangeHtml({ label: arr.label, props: arr.node.props, inside: arr.inside, around: arr.around, aroundLabel: arr.aroundLabel, declaresParts: arr.declares, nested: arr.nested }) };
    }
    if (!f || !el) return { ...base, empty: `<p class="de-note de-pad">Click a part of the page, or a row above. Click again to go inside it.</p>` };
    const node = f.node;
    const pr = parsePartRef(selId);
    if (pr) return partContext(base, node, pr.part, el) ?? { ...base, empty: `<p class="de-note de-pad">Click a part of the page, or a row above. Click again to go inside it.</p>` };
    if (!own(node)) {
      const wrapped = `<button type="button" class="de-picture-btn" data-tree-act="wrap" data-f="wrap-block">Put it in a box</button>`;
      if (node.type === PART_TYPE) {
        return { ...base, key: selId!, heading: (node.props.label as string | undefined) ?? "Live part", sub: "Stays connected to its data", bottom: `<p class="de-note">This part of the page stays live: its words and data come from the site. Drag it anywhere, or put it in a box to change what is around it.</p><p>${wrapped}</p>` };
      }
      const refusal = detachRefusal(node, el);
      const detach = `<button type="button" class="de-picture-btn" data-tree-act="detach" data-f="detach-block"${refusal ? " disabled" : ""}>Detach: edit its HTML and CSS</button>`;
      const open = o.blockEditorHref ? ` <a class="de-picture-btn" href="${esc(o.blockEditorHref)}" data-f="block-editor">Edit its settings</a>` : "";
      const def = defOf(node);
      const declared = Object.keys(def?.parts ?? {});
      const changed = declared.filter((name) => Object.keys(partLookOf(node.props, name)).length > 0).length;
      const lost = node.props.morph ? `<p class="de-note" data-f="detach-looks">Its looks on this page do not come with it.</p>` : "";
      const count = declared.length ? `<p class="de-note" data-f="parts-changed">${changed} of ${declared.length} parts changed on this page.</p>` : "";
      const actions = o.nested ? count : `${count}${refusal ? `<p class="de-note" data-f="detach-why">${esc(refusal)}</p>` : lost}<p>${detach} ${wrapped}${open}</p>`;
      if (def) {
        const { id: _id, ...stored } = node.props;
        const bound = boundProps(node);
        // An Opens this host cannot choose is no field at all: a box holding a reference nobody can write by hand (2026-11-06).
        const unclaimed = def.props.filter((p) => p.binds === "opens" && !o.binding?.records.handles("opens"));
        const isBound = (key: string) => bound.some((p) => propKey(p.name) === key) || unclaimed.some((p) => propKey(p.name) === key);
        const look = partLookOf(node.props, ROOT_PART);
        const fields = blockValues(def, node.props);
        return {
          ...base,
          ...styleContext(el, look),
          tabs: tabsOf(def),
          key: selId!,
          heading: def.label,
          // The node is its root part: the block's own settings first, then what a box has.
          values: { ...styleValues(look), ...fields.values },
          overridden: { ...styleOverridden(look), ...fields.overridden },
          slots: [...blockSlots(def, node.props).filter((x) => !isBound(x.key)), ...boxSlots(el, look)],
          ...(bound.length ? { sectionTop: { ...base.sectionTop, content: bound.map((p) => boundFieldHtml(node, p)).join("") } } : {}),
          tweaks: tweaksOf(def, node),
          notice: o.drawsSample?.(node) && sampleHasRows(o.contract, node.type) ? "Sample rows. Not saved." : o.nested && !declared.some((n) => n !== ROOT_PART) ? "This block lists no parts yet, so only its settings and its own look can change here." : undefined,
          extra: def.props.some((p) => p.group && (p.kind === "rows" || p.kind === "list"))
            ? { content: Object.values(def.parts ?? {}).some((pt) => pt.prop?.includes("."))
              ? `<p class="de-note" data-f="rows-note">Double-click a row's words on the block to type them. Rows are added, removed and reordered in the block's settings.</p>`
              : `<p class="de-note">Rows cannot be changed here yet.</p>` }
            : undefined,
          // data-sync: typing can make a block start or stop drawing while a field holds focus, and only synced elements are redrawn then.
          bottom: o.nested ? `<div class="de-bottom-sync" data-sync="block-actions">${actions}</div>` : `<p class="de-note">A block. Drag it into any box. Detach turns what it drew into boxes you can change one by one, and it then stops following these settings and its data.</p><div class="de-bottom-sync" data-sync="block-actions">${actions}</div>`,
          code: { written: [], css: "", editable: false, sanitize: safeDecls, config: { tag: node.type, hint: def.label, json: JSON.stringify(stored, null, 2) } },
        };
      }
      return { ...base, key: selId!, heading: labelFor(node.type), bottom: `<p class="de-note">A block. Drag it into any box. Its settings still shape it; detach it to turn what it drew into boxes you can change one by one. It stops following its data.</p>${actions}` };
    }
    const isRoot = selId === ROOT_ID;
    const look = (node.props.look ?? {}) as PartStyle;
    const computed = readBox(el);
    const tagList = node.type === "words" ? WORD_TAGS : BOX_TAGS;
    let slotsNow = boxSlots(el, look);
    // The page has no parent to align in or layout of its own: what is on it does.
    if (isRoot) slotsNow = slotsNow.filter((x) => x.section === "text" || x.section === "appearance" || x.key === "padding" || x.key === "wmode");
    else if (node.type !== "picture") {
      slotsNow.unshift({
        key: "tag", id: "tag", section: node.type === "box" ? "layout" : "text", label: "Kind", control: "select",
        allowed: { list: tagList }, labels: node.type === "box" ? BOX_KIND_LABELS : WORD_KIND_LABELS,
      });
    }
    const values = { ...styleValues(look), tag: node.props.tag };
    const image = node.type === "box" ? (node.props.image as string | undefined) : undefined;
    const src = node.type === "picture" ? (node.props.src as string | undefined) : undefined;
    const given = node.props.anchor ? `#${node.props.anchor as string}` : (node.props.label as string | undefined);
    const hint = isRoot ? ((node.props.title as string | undefined) || undefined) : given ?? /“(.*)”$/.exec(layerName(el))?.[1];
    const attrs: string[] = [];
    if (node.props.cls) attrs.push(`@class: ${node.props.cls as string}`);
    if (node.props.anchor) attrs.push(`@id: ${node.props.anchor as string}`);
    if (node.props.label) attrs.push(`@aria-label: ${node.props.label as string}`);
    if (node.props.href) attrs.push(`@href: ${node.props.href as string}`);
    if (image) attrs.push(`@picture: ${image}`);
    if (src) attrs.push(`@src: ${src}`);
    return {
      ...base,
      key: selId!,
      heading: isRoot ? "Page" : layerRole(el),
      sub: hint,
      slots: slotsNow,
      values,
      computed,
      overridden: styleOverridden(look),
      fonts: { inPage: [], family: [], library: true },
      contrast: { fg: (look.color ?? computed.color) as string | undefined, bg: backgroundOf(el), size: computed.size as number, weight: computed.weight as number },
      extra: {
        ...(isRoot ? {} : { link: attrRows(node) }),
        appearance: node.type === "words" ? "" : pictureRow(node.type === "picture" ? src : image, node.type) + (node.type === "picture" ? altRow(node.props.alt as string | undefined) : fitRow(image, node.props.imageFit as string | undefined)),
      },
      code: {
        written: [], css: codeText(look), editable: true, sanitize: safeDecls,
        sheet: { tag: isRoot ? "page" : el.tagName.toLowerCase(), hint, attrs, from: isRoot ? [] : fromGroups(selId!, look) },
      },
    };
  }

  /** A link, an anchor something else can link to, and a name for the layer. */
  function attrRows(node: PuckNode): string {
    const row = (key: string, label: string, ph: string) => `<div class="de-row" data-sync="row-${key}"><label class="de-label" for="de-attr-${key}">${label}</label><div class="de-ctl"><input type="text" id="de-attr-${key}" data-attr="${key}" placeholder="${ph}" value="${esc(node.props[key] ?? "")}" spellcheck="false" data-f="attr-${key}"></div><span class="de-aux"></span></div>`;
    return (node.type === "picture" ? "" : row("href", "Destination", "https://… or #anchor")) + row("anchor", "Anchor", "for-sale") + row("label", "Name", "First page of ads");
  }

  function pictureRow(value: string | undefined, type: string): string {
    if (!o.choosePicture) {
      return `<div class="de-row" data-sync="row-image"><label class="de-label" for="de-image">Picture</label><div class="de-ctl"><input type="text" id="de-image" data-image placeholder="Paste a picture address" value="${esc(value ?? "")}" spellcheck="false" data-f="image"></div><span class="de-aux"></span></div>`;
    }
    return `<div class="de-row" data-sync="row-image"><span class="de-label">Picture</span><div class="de-ctl de-picture">${value ? `<span class="de-picture-thumb" style="background-image:url(&quot;${esc(value)}&quot;)"></span>` : ""}<button type="button" class="de-picture-btn" data-tree-act="picture" data-f="choose">${value ? "Change" : "Choose a picture"}</button>${value && type === "box" ? `<button type="button" class="de-picture-btn" data-tree-act="clear-picture" data-f="clear-picture">Remove</button>` : ""}</div><span class="de-aux"></span></div>`;
  }
  const altRow = (alt: string | undefined) => `<div class="de-row" data-sync="row-alt"><label class="de-label" for="de-alt">Description</label><div class="de-ctl"><input type="text" id="de-alt" data-alt placeholder="What the picture shows" value="${esc(alt ?? "")}" data-f="alt"></div><span class="de-aux"></span></div>`;
  const fitRow = (image: string | undefined, fit: string | undefined) => (image
    ? `<div class="de-row c-chips" data-sync="row-imagefit"><span class="de-label">Picture fit</span><div class="de-ctl"><div class="de-seg chips" role="group" aria-label="Picture fit"><button data-set="imageFit" data-val="&quot;cover&quot;" aria-pressed="${fit !== "contain"}" data-f="fit-cover">Fill</button><button data-set="imageFit" data-val="&quot;contain&quot;" aria-pressed="${fit === "contain"}" data-f="fit-contain">Show all</button></div></div><span class="de-aux"></span></div>`
    : `<div data-sync="row-imagefit" hidden></div>`);

  /** Where this selection's look is stored: a part's, or a sealed node's root part, in its morph; an own node's in `look`. */
  function writeLook(id: string, fn: (s: PartStyle, el: HTMLElement) => void) {
    const f = found(id), el = elOf(id);
    if (!f || !el) return;
    const pr = parsePartRef(id);
    if (pr || lookIsSetting(f.node)) {
      if (!defOf(f.node)) return;
      const name = pr?.part ?? ROOT_PART;
      const s = clone(partLookOf(f.node.props, name));
      fn(s, el);
      setPartLook(f.node.props, name, s);
      return;
    }
    const s = (f.node.props.look ?? {}) as PartStyle;
    fn(s, el);
    if (Object.keys(s).length) f.node.props.look = s; else delete f.node.props.look;
  }
  /** This selection's look as stored, or undefined when it has none. A host with no contract keeps reading `look`, whatever it holds. */
  function readLook(id: string | null): PartStyle | undefined {
    const f = found(id);
    if (!f) return undefined;
    const pr = parsePartRef(id);
    if (!pr && !lookIsSetting(f.node)) return f.node.props.look as PartStyle | undefined;
    if (!defOf(f.node)) return undefined;
    const look = partLookOf(f.node.props, pr?.part ?? ROOT_PART);
    return Object.keys(look).length ? look : undefined;
  }

  const propOf = (node: PuckNode, name: string) => contractFor(o.contract, node.type)?.props.find((p) => p.name === name);
  /** A style token on this block. One undo step per field; removed when it has no value. */
  function changeToken(node: PuckNode, name: string, value: unknown) {
    const t = defOf(node)?.tokens?.find((x) => x.name === name);
    if (!t) return;
    if (t.type === "font" && value) loadFont(String(value));
    const stored = value === undefined || value === null || value === "" ? undefined : t.type === "length" ? `${value as number}px` : String(value);
    change(() => setToken(node.props, name, stored), `${node.props.id}:t:${name}`);
  }
  /** A sealed block's setting: kept only if it is safe to keep. Typing is one undo step; other fields coalesce as a box's do. */
  function changeProp(id: string, node: PuckNode, name: string, value: unknown, live: boolean) {
    const p = propOf(node, name);
    if (!p) return;
    const clean = cleanPropValue(p, value);
    // The field keeps what was typed, which may be on its way to something valid; leaving the field settles it.
    if (clean.ok === false) { refused = { field: propSlotId(name), message: clean.message }; return; }
    if (refused?.field === propSlotId(name)) refused = null;
    if (!isTypedProp(p)) return change(() => { node.props[name] = clean.value; }, live ? `${id}:p:${name}` : undefined);
    const session = `${id}:${name}`;
    if (typing !== session) { history.remember(null); typing = session; }
    node.props[name] = clean.value;
    redraw();
  }

  const panel = new Panel(side, {
    change(key, value, live) {
      const id = selId, f = found(id);
      if (!id || !f) return;
      const prop = propNameOf(key);
      if (prop) return changeProp(id, f.node, prop, value, live);
      const token = tokenNameOf(key);
      if (token) return changeToken(f.node, token, value);
      const field = live ? `${id}:${key}` : undefined;
      if (key === "css") return change(() => writeLook(id, (s) => setCodeText(s, String(value ?? ""), parsePartRef(id) ? partSafeDecls : safeDecls)), field);
      if (key === "tag") return change(() => { f.node.props.tag = value; }, field, true); // The panel's heading names the kind.
      if (key === "imageFit") return change(() => { if (value === "contain") f.node.props.imageFit = "contain"; else delete f.node.props.imageFit; }, field);
      change(() => writeLook(id, (s, el) => {
        applyKey(s, key, value, el);
        // Columns only draw on a grid the fields know about; one written in the Code tab becomes one.
        if (key === "gcols" && !s.layout) s.layout = "grid";
        if (key === "layout" && value === "block") dropCss(s, ["display", "flex-direction", "flex-wrap", "grid-template-columns"]);
        settleCss(s);
      }), field, key === "layout" || key === "bstyle");
    },
    reset(key) {
      const id = selId;
      if (!id) return;
      const token = tokenNameOf(key);
      if (token) { const n = found(id)?.node; if (n) changeToken(n, token, undefined); return; }
      const prop = propNameOf(key);
      if (!prop) return change(() => writeLook(id, (s) => resetKey(s, key)));
      const f = found(id), p = f && propOf(f.node, prop);
      if (f && p) change(() => resetProp(p, f.node.props));
    },
    select(ref) { const id = baseOf(ref); selId = id; ct.select(elOf(id)); elOf(id)?.scrollIntoView({ block: "nearest", behavior: "instant" as ScrollBehavior }); },
    hover(ref) { ct.hover(ref && baseOf(ref) !== ROOT_ID ? elOf(baseOf(ref)) : null); },
    toggleHidden(ref) { change(() => writeLook(ref, (s) => { if (s.hide) delete s.hide; else s.hide = true; })); },
    dragLayer(ref, ev) { dragRow(ref, ev); },
  });

  /**
   * A layer row pulled to another place in the tree (2026-11-07), as the classifieds editor's rows are: the line
   * puts the node before or after the row it is over, in that row's slot; the middle of a box's row puts it at the
   * end of the box's first slot. The same move and the same rules as a pull on the page (`movePuckNode`), one undo
   * step. Escape cancels.
   */
  function dragRow(ref: string, ev: PointerEvent) {
    const id = ref, f = found(id);
    if (!f || id === ROOT_ID || parsePartRef(id) || ref.includes("~") || o.nested) return;
    const type = f.node.type, levels = nodeLevels(f.node, slots);
    const rowId = (li: HTMLElement) => li.dataset.drag ?? "";
    const holds = (tid: string) => { const t = found(tid); return t ? firstSlot(t.node) : null; };
    /** Where a drop on this row would go, or null when it may not. */
    const spotFor = (tid: string, before: boolean, inside: boolean): { spot: Spot; index: number } | null => {
      const t = found(tid);
      if (!t || tid === id || isWithin(doc, slots, id, tid)) return null;
      if (inside) {
        const slot = holds(tid);
        if (!slot) return null;
        const kids = Array.isArray(t.node.props[slot]) ? (t.node.props[slot] as PuckNode[]) : [];
        return { spot: { parent: tid, slot }, index: kids.filter((k) => k?.props?.id !== id).length };
      }
      // movePuckNode counts the slot's nodes without the moved one.
      const same = t.parent === f.parent && t.slot === f.slot;
      const at = same && f.index < t.index ? t.index - 1 : t.index;
      return { spot: { parent: t.parent, slot: t.slot }, index: at + (before ? 0 : 1) };
    };
    busy = true;
    bar.hide();
    startGhostDrag(ev, {
      label: "move " + (elOf(id) ? source.name(elOf(id)!) : labelFor(type)).toLowerCase(),
      host: document.body,
      insertion: true,
      axis: "y",
      target(under) {
        const li = under.closest<HTMLElement>("li[data-drag]");
        if (!li || !side.contains(li)) return null;
        const tid = rowId(li);
        return tid && tid !== id && !isWithin(doc, slots, id, tid) ? li : null;
      },
      inside(li) { return !!holds(rowId(li)); },
      onDrop(li, before, inside) {
        const to = spotFor(rowId(li), before, inside);
        if (!to || !mayPlace(doc, slots, type, levels, to.spot)) { shell.drawTop("That cannot go there."); return; }
        selId = id;
        structural(() => { if (!movePuckNode(doc, slots, id, to.spot, to.index)) shell.drawTop("That cannot go there."); });
      },
      onEnd() { busy = false; ct.adopt(elOf(selId)); renderBar(); },
    });
  }

  L.on(side, "input", (ev: Event) => {
    const t = ev.target as HTMLInputElement, f = found(selId);
    if (!f) return;
    // The soft redraw leaves the row being typed in alone, so its swatch follows here. A token's field is often the only thing changing on screen.
    if (o.contract && t.dataset.hex !== undefined && normHex(t.value)) {
      const sw = t.parentElement?.querySelector<HTMLElement>(".de-swatchbtn .de-sw");
      if (sw) { sw.classList.remove("none"); sw.style.setProperty("--sw", normHex(t.value)!); }
    }
    if (t.dataset.image !== undefined) {
      const key = f.node.type === "picture" ? "src" : "image";
      change(() => { if (t.value.trim()) f.node.props[key] = t.value.trim(); else delete f.node.props[key]; }, `${selId}:image`);
    } else if (t.dataset.alt !== undefined) {
      change(() => { f.node.props.alt = t.value.slice(0, 300); }, `${selId}:alt`);
    } else if (t.dataset.attr) {
      const key = t.dataset.attr;
      change(() => { if (t.value.trim()) f.node.props[key] = t.value.trim(); else delete f.node.props[key]; }, `${selId}:${key}`);
    }
  });
  // Leaving a block's field ends its typing session, says why a value was not kept, and shows what is stored.
  L.on(side, "focusout", (ev: FocusEvent) => {
    typing = null;
    const t = ev.target as HTMLInputElement, name = propNameOf(t.dataset?.k ?? ""), f = found(selId);
    const p = name && f ? propOf(f.node, name) : undefined;
    if (!name || !f || !p || !t.isConnected) return;
    if (refused?.field === propSlotId(name)) {
      heldNote = { text: refused.message, until: Date.now() + 6000 };
      refused = null;
      shell.drawTop();
    }
    if (t.dataset.text !== undefined || t.dataset.num !== undefined) t.value = String(f.node.props[name] ?? p.default ?? "");
  });
  L.on(side, "click", (ev: MouseEvent) => {
    const arr = (ev.target as HTMLElement).closest<HTMLElement>("[data-arr]")?.dataset.arr;
    if (arr) { arrangeAct(arr); return; }
    const a = (ev.target as HTMLElement).closest<HTMLElement>("[data-tree-act]")?.dataset.treeAct;
    if (a === "picture") choosePictureFor(selId);
    else if (a === "clear-picture") { const f = found(selId); if (f) change(() => { delete f.node.props.image; delete f.node.props.imageFit; }); }
    else if (a === "wrap") wrap("column");
    else if (a === "detach") detach(selId);
    else if (a?.startsWith("bind:")) chooseRecordFor(selId, a.slice(5));
  });
  /** A sealed block's props that hold a reference this host can choose. */
  function boundProps(node: PuckNode) {
    const b = o.binding;
    return b ? (contractFor(o.contract, node.type)?.props ?? []).filter((p) => p.group && p.binds && b.records.handles(p.binds)) : [];
  }
  function boundFieldHtml(node: PuckNode, p: { name: string; label: string; binds?: string; description?: string }) {
    const b = o.binding!, v = typeof node.props[p.name] === "string" ? (node.props[p.name] as string) : "";
    const words = v ? b.records.describe(p.binds!, v, b.drawn(node.type, p.name, v)) : "Not chosen yet.";
    return `<div class="de-rec-field" data-f="bind-${esc(p.name)}"><span class="de-label"${p.description ? ` title="${esc(p.description)}"` : ""}>${esc(p.label)}</span><p class="de-rec-now">${esc(words)}</p><button type="button" class="de-picture-btn" data-tree-act="bind:${esc(p.name)}" data-f="bind-open-${esc(p.name)}">${v ? "Change…" : "Choose…"}</button></div>`;
  }
  /** "From what?" in the drawer. What the value draws is fetched first, so the page shows it on the same redraw; undo brings back the earlier value and what it drew. */
  function chooseRecordFor(id: string | null, name: string) {
    const f = found(id), b = o.binding;
    if (!f || !b) return;
    const p = boundProps(f.node).find((x) => x.name === name);
    if (!p?.binds) return;
    const binds = p.binds, type = f.node.type;
    shell.openDrawer(b.records.title?.(binds) ?? "Choose", (body, close) => mountRecordChooser(body, {
      records: b.records,
      binds,
      value: typeof f.node.props[name] === "string" ? (f.node.props[name] as string) : "",
      async onPick(value) {
        if (value && b.drawn(type, name, value) === undefined) {
          let drawn: Record<string, unknown> | null = null;
          try { drawn = await b.records.resolve(binds, value); } catch { drawn = null; }
          b.remember(type, name, value, drawn);
        }
        close();
        const g = found(id);
        if (g) change(() => { if (value) g.node.props[name] = value; else resetProp(p, g.node.props); }, undefined, true);
      },
    }));
  }
  function choosePictureFor(id: string | null) {
    const f = found(id);
    if (!f) return;
    const key = f.node.type === "picture" ? "src" : "image";
    shell.openPicture(f.node.props[key] as string | undefined, f.node.type === "picture" ? "Picture" : "Background picture", (url) => {
      const g = found(id);
      if (g) change(() => { g.node.props[key] = url; });
    });
  }

  // ------------------------------------------------------------- structure
  const spotOf = (el: HTMLElement): Spot | null => {
    const key = el.dataset.treeSlot;
    if (!key) return null;
    const at = key.lastIndexOf(":");
    return { parent: key.slice(0, at), slot: key.slice(at + 1) };
  };
  function wrap(dir: "row" | "column") {
    const id = selId;
    if (!id || id === ROOT_ID) return;
    structural(() => {
      const box: PuckNode = { type: "box", props: { id: newId("box"), tag: "div", look: { layout: "stack", dir, gap: 12 } } };
      return wrapPuckNode(doc, slots, id, box) ? box.props.id : id;
    });
  }
  /** Into the selected container, else after the selection, else at the end of the page. */
  function placeNew(node: PuckNode): boolean {
    const f = selId === ROOT_ID ? null : found(selId);
    if (f) {
      const inner = firstSlot(f.node);
      if (inner && mayPlace(doc, slots, node.type, nodeLevels(node, slots), { parent: f.node.props.id, slot: inner })) {
        return insertPuckNode(doc, slots, node, { parent: f.node.props.id, slot: inner }, Number.MAX_SAFE_INTEGER);
      }
      return insertPuckNode(doc, slots, node, { parent: f.parent, slot: f.slot }, f.index + 1);
    }
    return insertPuckNode(doc, slots, node, { parent: ROOT_ID, slot: ROOT_SLOT }, doc.content.length);
  }
  function addNew(kind: string) {
    let node: PuckNode;
    if (kind === "box") node = { type: "box", props: { id: newId("box"), tag: "div", look: { layout: "stack", dir: "column", gap: 12, padding: 16 }, items: [] } };
    else if (kind === "words") node = { type: "words", props: { id: newId("words"), tag: "p", html: "" } };
    else if (kind === "picture") node = { type: "picture", props: { id: newId("picture"), src: "", alt: "" } };
    else {
      const b = o.catalogue?.find((c) => c.type === kind);
      if (!b) return;
      node = { type: kind, props: { ...clone(b.defaults), id: newId(kind) } };
    }
    let ok = false;
    structural(() => { ok = placeNew(node); return ok ? node.props.id : selId; });
    if (!ok) { shell.drawTop("That cannot go there."); return; }
    ct.select(elOf(node.props.id));
    if (node.type === "words") startWords(node.props.id);
    else if (node.type === "picture" && o.choosePicture) choosePictureFor(node.props.id);
  }
  /** Turn what a block drew into boxes (the canvas's Detach instance). What sits in its slots stays as it is. */
  function detach(id: string | null) {
    const f = found(id), el = elOf(id);
    if (!id || !f || !el || own(f.node) || f.node.type === PART_TYPE || parsePartRef(id)) return;
    const refusal = detachRefusal(f.node, el);
    if (refusal) { shell.drawTop(refusal); return; }
    const skipped: string[] = [];
    const box = adoptElement(el, {
      newId,
      skipped,
      existing(e) {
        if (e.dataset.treeWrap) return found(e.dataset.treeWrap)?.node ?? null;
        // A block no catalogue knows draws with no wrap, and its stand-in text must not be copied as words. A node's own element is what is being detached.
        return o.contract && e !== el && e.dataset.treeNode ? found(e.dataset.treeNode)?.node ?? null : null;
      },
    });
    if (!box) { shell.drawTop("That block has nothing that can be turned into boxes."); return; }
    const lost = !!f.node.props.morph;
    structural(() => { f.list.splice(f.index, 1, box); return box.props.id; });
    ct.select(elOf(box.props.id));
    const looks = lost ? " Its looks on this page did not come with it." : "";
    if (skipped.length) shell.drawTop(`Detached, without: ${[...new Set(skipped)].join(", ")}. Those cannot be copied as boxes.${looks} Undo brings the block back.`);
    else if (lost) shell.drawTop(`Detached.${looks} Undo brings the block back.`);
  }
  function remove() {
    const f = selId === ROOT_ID ? null : found(selId);
    if (!f) return;
    const next = f.list[f.index + 1]?.props.id ?? f.list[f.index - 1]?.props.id ?? f.parent;
    structural(() => { removePuckNode(doc, slots, f.node.props.id); return next; });
    ct.select(elOf(next));
  }
  function moveEnd(end: "first" | "last") {
    const f = found(selId);
    if (!f || f.list.length < 2) return;
    structural(() => { movePuckNode(doc, slots, f.node.props.id, { parent: f.parent, slot: f.slot }, end === "first" ? 0 : f.list.length); });
  }

  function startWords(id: string) {
    const f = found(id), el = elOf(id);
    if (!f || !el || f.node.type !== "words" || f.node.props.tag === "hr") return;
    const initial = (f.node.props.html as string | undefined) ?? "";
    // What the page drew, a link around the words included; React will not put it back if nothing changed.
    const before = el.innerHTML;
    ct.hold(true);
    inline = startInlineText(el, {
      initial,
      rich: { list: true },
      multiline: true,
      keepFocus: (to) => bar.contains(to),
      onSelection: () => renderBar(),
      onCommit(text) {
        inline = null;
        el.style.opacity = "";
        ct.hold(false);
        const g = found(id);
        if (g) change(() => { g.node.props.html = text; });
      },
      onCancel() {
        inline = null;
        el.style.opacity = "";
        el.innerHTML = before;
        ct.hold(false);
        renderBar();
      },
    });
    renderBar();
  }

  // ------------------------------------------------------ words a block owns
  // A sealed block's part that draws one of its own props (2026-11-06): its `prop`, or "<rows prop>.<field>" for one
  // field of the row its nearest editItem mark names. Typing writes that prop, the same value Puck's fields edit.
  // A part with no prop on a data block draws the site's data, which is not changed here.
  type WordsTarget = { label: string; kind: string; value: unknown; set(props: Record<string, unknown>, v: string): void };
  function wordsTarget(ref: string): WordsTarget | { locked: string } | null {
    const pr = parsePartRef(ref), f = pr ? found(pr.id) : null, el = elOf(ref), at = pr ? nodeEl(pr.id) : null;
    if (!pr || !f || !el || !at || own(f.node)) return null;
    const def = defOf(f.node), part = def?.parts && hasOwn(def.parts, pr.part) ? def.parts[pr.part] : undefined;
    if (!def || !part) return null;
    if (!part.prop) return def.dataDriven && partKind(el) === "text" ? { locked: `${part.label}: these words come from the site's data. They are changed where that is kept, not on this page.` } : null;
    const [name, field] = part.prop.split(".") as [string, string | undefined];
    const p = def.props.find((x) => x.name === name);
    if (!p) return null;
    if (field === undefined) return TYPABLE.has(p.kind) ? { label: p.label, kind: p.kind, value: f.node.props[name], set: (props, v) => { props[name] = v; } } : null;
    const sub = p.kind === "rows" ? p.fields?.find((x) => x.name === field) : undefined;
    if (!sub || !TYPABLE.has(sub.kind)) return null;
    const mark = el.closest<HTMLElement>("[data-edit-item]");
    const m = mark && (mark === at || at.contains(mark)) ? /^([^:]+):(\d+)$/.exec(mark.dataset.editItem ?? "") : null;
    const row = m && m[1] === name ? Number(m[2]) : -1;
    const rows = f.node.props[name];
    if (row < 0 || !Array.isArray(rows) || !rows[row] || typeof rows[row] !== "object") return null;
    return {
      label: `${p.label} ${row + 1}: ${sub.label ?? field}`,
      kind: sub.kind,
      value: (rows[row] as Record<string, unknown>)[field],
      set(props, v) {
        const list = Array.isArray(props[name]) ? (props[name] as unknown[]).slice() : [];
        list[row] = { ...(list[row] as Record<string, unknown>), [field]: v };
        props[name] = list;
      },
    };
  }
  /** Typing into a part's own words. True when the double-click was taken (typed, or a note said why not). */
  function startOwnWords(ref: string): boolean {
    const t = wordsTarget(ref), el = elOf(ref), id = parsePartRef(ref)?.id;
    if (!t || !el || !id) return false;
    const say = (text: string) => { heldNote = { text, until: Date.now() + 6000 }; shell.drawTop(); };
    if ("locked" in t) { say(t.locked); return true; }
    const rich = t.kind === "richtext";
    const stored = typeof t.value === "string" ? t.value : "";
    if (rich && RICH_NOT_INLINE.test(stored)) { say(`${t.label} has headings, quotes or numbered lists. Type it in the block's settings, where they are kept.`); return true; }
    // React's own nodes and their text, put back before the block redraws: React updates the nodes it made, not the ones typing made.
    const kept = Array.from(el.childNodes);
    const texts = new Map<Text, string | null>();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.set(n as Text, n.nodeValue);
    const restore = () => { texts.forEach((v, n) => { n.nodeValue = v; }); el.replaceChildren(...kept); el.style.opacity = ""; };
    ct.hold(true);
    inline = startInlineText(el, {
      initial: stored,
      rich: rich ? { list: true } : undefined,
      multiline: rich,
      keepFocus: (to) => bar.contains(to),
      onSelection: () => renderBar(),
      onCommit(text) {
        inline = null;
        restore();
        ct.hold(false);
        const value = rich ? (o.cleanRich ?? ((h: string) => h))(richToParagraphs(sanitizeRich(text, { list: true }))) : text;
        const g = found(id);
        if (g) change(() => t.set(g.node.props, value)); else renderBar();
      },
      onCancel() {
        inline = null;
        restore();
        ct.hold(false);
        renderBar();
      },
    });
    renderBar();
    return true;
  }

  // ------------------------------------------------------------- the thin bar
  const styleKey = (el: Element) => { const cs = getComputedStyle(el); return [cs.fontFamily, cs.fontSize, cs.fontWeight, cs.lineHeight].join("|"); };
  /** The page's type scale: every distinct look its words have, largest first, named as the canvas names them. */
  function typeScale(): MiniBarStyle[] {
    if (scale) return scale;
    const seen = new Map<string, { family: string; size: number; weight: number }>();
    scope.querySelectorAll('[data-tree-type="words"]').forEach((e) => {
      if (e.tagName === "HR") return;
      const cs = getComputedStyle(e), key = styleKey(e);
      if (!seen.has(key)) seen.set(key, { family: cs.fontFamily, size: Math.round(parseFloat(cs.fontSize) * 10) / 10, weight: Number(cs.fontWeight) || 400 });
    });
    scale = [...seen.entries()].sort((a, b) => b[1].size - a[1].size || b[1].weight - a[1].weight).slice(0, 30).map(([id, v], i) => ({ id, label: `Heading ${i + 1}`, ...v }));
    return scale;
  }

  const bar = new MiniBar(o.nested?.chrome ?? document.body, {
    style(id) {
      const target = selId;
      if (!target) return;
      // A part already drawn this way: its "Block style" row must not write a look that freezes what the block draws.
      const at = parsePartRef(target) ? elOf(target) : null;
      if (at && styleKey(at) === id) return;
      const [family, size, weight, lh] = id.split("|");
      change(() => writeLook(target, (s) => {
        delete s.font; delete s.size; delete s.weight; delete s.leading;
        let css = s.css ?? "";
        css = setDecl(css, "font-family", family);
        css = setDecl(css, "font-size", size);
        css = setDecl(css, "font-weight", weight);
        css = setDecl(css, "line-height", lh);
        s.css = declsToString(safeDecls(css));
      }));
    },
    custom(key, value) {
      const target = selId;
      if (!target) return;
      if (key === "font") loadFont(String(value));
      change(() => writeLook(target, (s, el) => { applyKey(s, key, value, el); settleCss(s); }), `${target}:${key}`);
    },
    color(hex) {
      const target = selId, f = found(target), at = elOf(target);
      if (!target || !f) return;
      const key = (parsePartRef(target) ? at && partKind(at) === "text" : f.node.type === "words") ? "color" : "fill";
      change(() => writeLook(target, (s, el) => { applyKey(s, key, hex, el); settleCss(s); }), `${target}:${key}`);
    },
    format(k) {
      if (inline?.active()) {
        inline.command(k === "b" ? "bold" : k === "i" ? "italic" : k === "u" ? "underline" : "list");
        renderBar();
        return;
      }
      const f = found(selId);
      if (!f) return;
      const html = (f.node.props.html as string | undefined) ?? "";
      change(() => { f.node.props.html = k === "list" ? toggleList(html) : toggleWhole(html, k, { list: true }); });
    },
    link(href) {
      if (inline?.active()) { if (href) inline.link(href); else inline.command("unlink"); renderBar(); return; }
      const f = found(selId);
      if (f) change(() => { if (href) f.node.props.href = href; else delete f.node.props.href; }, undefined, true);
    },
    align(v) { const target = selId; if (target) change(() => writeLook(target, (s, el) => { applyKey(s, "align", v, el); settleCss(s); })); },
    more(x, y) { ct.menuAt(x, y); },
    comment(text) {
      const f = found(selId);
      if (f) change(() => { if (text) f.node.props.comment = text; else delete f.node.props.comment; });
    },
    linkField(open) { if (open) inline?.saveRange(); else inline?.restoreRange(); },
  });
  bar.el.dataset.deUi = "";
  bar.topInset = o.nested ? o.nested.chrome.getBoundingClientRect().top + 50 : 50;

  function renderBar() {
    const f = found(selId), el = elOf(selId);
    if (!f || !el || selId === ROOT_ID || busy || presenting || tool === "hand") { bar.hide(); return; }
    const node = f.node;
    const base: MiniBarContext = { key: selId!, bold: null, italic: null, underline: null, link: null, list: null, editing: !!inline, comment: (node.props.comment as string | undefined) ?? "" };
    let ctx: MiniBarContext;
    const pr = parsePartRef(selId);
    if (pr) {
      // Style and colour as a box's words. Its words come from the block, so bold, italic, underline, link and list stay off.
      const kind = partKind(el), cs = readBox(el), look = partLookOf(node.props, pr.part);
      const typed = !!(look.font || look.size || look.weight || look.leading), drawn = styleKey(el), page = typeScale();
      // A part with no type of its own is as the block draws it, which the page's words need not include: it says so, rather than "Custom".
      const asDrawn = !typed && !/(^|;)\s*(font-|line-height)/.test(look.css ?? "") && !page.some((s) => s.id === drawn);
      ctx = kind === "image" ? { ...base, mode: "plain" }
        : kind === "frame" ? { ...base, mode: "box", color: { value: (cs.fill ?? "#ffffff") as string, swatches: usedColoursIn(scope) } }
        : {
          ...base,
          mode: "text",
          styles: asDrawn ? [{ id: drawn, label: "Block style", family: getComputedStyle(el).fontFamily, size: Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10, weight: Number(getComputedStyle(el).fontWeight) || 400 }, ...page] : page,
          styleId: typed ? "" : drawn,
          custom: { fonts: LIBRARY_FONTS, font: (cs.font as string | undefined) ?? firstFamily(getComputedStyle(el).fontFamily), weight: cs.weight as number, size: cs.size as number, leading: cs.leading as number | undefined, tracking: cs.tracking as number },
          color: { value: (look.color ?? cs.color ?? "#000000") as string, swatches: usedColoursIn(scope) },
          align: { value: String(cs.align ?? "left"), options: ["left", "center", "right", "justify"] },
        };
    } else if (node.type === "words" && node.props.tag !== "hr") {
      const cs = readBox(el);
      const html = (node.props.html as string | undefined) ?? "";
      const st = inline?.active() ? inline.state() : null;
      const look = (node.props.look ?? {}) as PartStyle;
      ctx = {
        ...base,
        mode: "text",
        styles: typeScale(),
        styleId: look.font || look.size || look.weight || look.leading ? "" : styleKey(el),
        custom: { fonts: LIBRARY_FONTS, font: (cs.font as string | undefined) ?? firstFamily(getComputedStyle(el).fontFamily), weight: cs.weight as number, size: cs.size as number, leading: cs.leading as number | undefined, tracking: cs.tracking as number },
        color: { value: (look.color ?? cs.color ?? "#000000") as string, swatches: usedColoursIn(scope) },
        bold: st ? st.bold : wholeHas(html, "b", { list: true }),
        italic: st ? st.italic : wholeHas(html, "i", { list: true }),
        underline: st ? st.underline : wholeHas(html, "u", { list: true }),
        link: st ? st.link : !!node.props.href,
        list: st ? st.list : wholeHas(html, "ul", { list: true }),
        align: { value: String(cs.align ?? "left"), options: ["left", "center", "right", "justify"] },
        href: (node.props.href as string | undefined) ?? "",
      };
    } else if (node.type === "box") {
      const cs = readBox(el);
      ctx = { ...base, mode: "box", color: { value: (cs.fill ?? "#ffffff") as string, swatches: usedColoursIn(scope) } };
    } else {
      ctx = { ...base, mode: "plain" };
    }
    bar.update(ctx, el.getBoundingClientRect());
  }

  // ----------------------------------------------------------------- menus
  function menuTools(el: HTMLElement): MenuItem[] {
    const ref = idOf(el), f = found(ref);
    if (!f) return [];
    const isOwn = own(f.node), onPart = !!parsePartRef(ref);
    const look = readLook(ref);
    // A sealed node's reset clears all of its morph: tokens and parts, not only its root part's look.
    const canReset = !onPart && !isOwn && defOf(f.node) ? !!f.node.props.morph : !!look;
    // In the popup there is one block to edit: moving it, adding beside it and detaching it belong to the page.
    if (o.nested) {
      return [
        { id: "parent", label: "Select parent", hint: "Esc", disabled: !source.parent(el) },
        { id: "copy-style", label: "Copy style", sep: true, disabled: !look },
        { id: "paste-style", label: "Paste style", disabled: !styleClip || !(isOwn || onPart || !!defOf(f.node)) },
        { id: "hide", label: look?.hide ? "Show" : "Hide", disabled: !(isOwn || onPart) },
        { id: "reset", label: "Reset style", disabled: !canReset },
      ];
    }
    const addKids: MenuItem[] = [
      { id: "add:box", label: "Box" }, { id: "add:words", label: "Words" }, { id: "add:picture", label: "Picture" },
      ...(o.catalogue ?? []).filter((c) => !OWN_TYPES.has(c.type)).map((c, i) => ({ id: `add:${c.type}`, label: c.label, sep: i === 0 })),
    ];
    return [
      ...(canOpenLarge(ref) ? [{ id: "open-large", label: "Open this block large", hint: "Double-click" }] : []),
      { id: "parent", label: "Select parent", hint: "Esc", disabled: !source.parent(el), sep: canOpenLarge(ref) },
      { id: "add", label: "Add", kids: addKids, sep: true },
      { id: "group", label: "Group in a row", hint: "Ctrl+G", disabled: onPart },
      { id: "groupcol", label: "Group in a column", disabled: onPart },
      { id: "ungroup", label: "Ungroup", hint: "Ctrl+Shift+G", disabled: onPart || f.node.type !== "box" },
      { id: "detach", label: "Detach", disabled: onPart || isOwn || f.node.type === PART_TYPE || !!detachRefusal(f.node, el) },
      { id: "dup", label: "Duplicate", hint: "Ctrl+D", sep: true, disabled: onPart },
      { id: "first", label: "Move to first", hint: "[", disabled: onPart || f.index === 0 },
      { id: "last", label: "Move to last", hint: "]", disabled: onPart || f.index === f.list.length - 1 },
      { id: "copy-style", label: "Copy style", sep: true, disabled: !look },
      { id: "paste-style", label: "Paste style", disabled: !styleClip || !(isOwn || onPart || !!defOf(f.node)) },
      // A block's root cannot be hidden from here: its parts can.
      { id: "hide", label: look?.hide ? "Show" : "Hide", disabled: !(isOwn || onPart) },
      { id: "reset", label: "Reset style", disabled: !canReset },
      { id: "delete", label: "Delete", hint: "Del", danger: true, sep: true, disabled: onPart },
    ];
  }
  function runTool(id: string, el: HTMLElement) {
    const nodeId = idOf(el);
    if (id === "open-large") { openLarge(nodeId); return; }
    if (parsePartRef(nodeId) && NODE_ONLY.has(id)) return;
    selId = nodeId;
    if (id.startsWith("add:")) return addNew(id.slice(4));
    switch (id) {
      case "parent": { const p = source.parent(el); selId = idOf(p); ct.select(p); break; }
      case "detach": detach(nodeId); break;
      case "group": wrap("row"); break;
      case "groupcol": wrap("column"); break;
      case "ungroup": if (nodeId) { const kid = (found(nodeId)?.node.props.items as PuckNode[] | undefined)?.[0]?.props.id ?? null; structural(() => { unwrapPuckNode(doc, slots, nodeId); return kid; }); ct.select(elOf(kid)); } break;
      case "dup": if (nodeId) { let copy: string | null = null; structural(() => { copy = duplicatePuckNode(doc, slots, nodeId, () => newId("n")); return copy; }); ct.select(elOf(copy)); } break;
      case "first": moveEnd("first"); break;
      case "last": moveEnd("last"); break;
      case "copy-style": {
        const stored = readLook(nodeId);
        if (lookIsSetting(found(nodeId)?.node) && !stored) break;
        const c: PartStyle = clone((stored ?? {}) as PartStyle);
        for (const key of LOOK_ONLY) delete c[key];
        styleClip = c;
        shell.drawTop("Style copied. Select another box and paste it.");
        break;
      }
      case "paste-style": if (nodeId && styleClip) { const clip = styleClip; change(() => writeLook(nodeId, (s) => Object.assign(s, clone(clip)))); } break;
      case "hide": if (nodeId) change(() => writeLook(nodeId, (s) => { if (s.hide) delete s.hide; else s.hide = true; })); break;
      case "reset": {
        const f = found(nodeId);
        if (!f) break;
        if (parsePartRef(nodeId)) change(() => writeLook(nodeId!, (s) => { for (const k of Object.keys(s)) delete (s as Record<string, unknown>)[k]; }));
        else if (!lookIsSetting(f.node)) change(() => { delete f.node.props.look; });
        else if (f.node.props.morph) change(() => { delete f.node.props.morph; });
        break;
      }
      case "delete": remove(); break;
    }
  }

  // ---------------------------------------------------------------- canvas
  const ct = mountClickThrough({
    host: o.nested?.layers,
    menuHost: o.nested?.chrome,
    layers: source,
    emptyTarget: (t) => (o.nested ? nodeEl(o.nested.blockId) : scope.contains(t) ? rootEl() : null),
    menu: menuTools,
    onMenu: runTool,
    // A right-click selects, and a shorter panel then clamps its own scroll. A sealed block's panel is often the longer one. With no contract the menu is as it was.
    menuKeepsOnScroll: o.contract ? (t) => side.contains(t) : undefined,
    onDraw() { renderBar(); },
    onSelect(el) { selId = idOf(el); shell.closePicture(); panel.render(context(), true); shell.drawTop(); renderBar(); },
    onDouble(el) { const id = idOf(el); if (canOpenLarge(id)) openLarge(id); else if (id && !startOwnWords(id)) startWords(id); },
    handles(el) { return idOf(el) !== ROOT_ID && own(found(idOf(el))?.node) ? ["e", "s", "se", "ne", "sw"] : []; },
    onHandle(ev, handle, el) {
      const id = idOf(el);
      if (!id) return;
      history.remember(null);
      const before = clone(doc);
      busy = true;
      bar.hide();
      ct.hold(true);
      startBoxResize({
        ev, el, handle,
        onChange(c) {
          writeLook(id, (s) => {
            if (c.cspan !== undefined) s.cspan = c.cspan;
            if (c.w !== undefined) s.w = c.w;
            if (c.h !== undefined) s.h = c.h;
          });
          o.draw(doc);
          ct.adopt(elOf(id));
          ct.hold(true, c.label);
        },
        onEnd(commit) {
          busy = false;
          if (!commit) { doc = before; history.undo(); }
          ct.hold(false);
          redraw(true);
        },
      });
    },
    onPull(ev, el) {
      if (o.nested) { arrangeDrag(ev, el); return; }
      const id = idOf(el), f = found(id);
      if (!id || !f || id === ROOT_ID || parsePartRef(id)) return;
      const levels = nodeLevels(f.node, slots), type = f.node.type;
      busy = true;
      bar.hide();
      ct.hold(true);
      startNodeDrag(ev, {
        host: document.body,
        label: source.name(el),
        source: el,
        containers: SLOT,
        scope,
        parentOf: (c) => (c.parentElement?.closest(SLOT) as HTMLElement | null) ?? null,
        childrenOf: (c) => Array.from(c.querySelectorAll<HTMLElement>(NODE)).filter((n) => n !== c && n.parentElement?.closest(SLOT) === c),
        accepts(c) { const spot = spotOf(c); return !!spot && mayPlace(doc, slots, type, levels, spot); },
        onDrop(container, index) {
          const spot = spotOf(container);
          if (!spot) return;
          structural(() => { if (!movePuckNode(doc, slots, id, spot, index)) shell.drawTop("That cannot go there."); });
        },
        onEnd() { busy = false; ct.hold(false); ct.adopt(elOf(selId)); renderBar(); },
      });
    },
  });

  L.on(document, "keydown", (ev: KeyboardEvent) => {
    const field = (ev.target as Element).closest?.("input, textarea, select, [contenteditable='true'], [data-de-menu]");
    if (!o.nested && !busy && !inline && !field && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      const key = ev.key.toLowerCase();
      if (key === "v") { setTool("select"); return; }
      if (key === "h") { setTool("hand"); return; }
      if (key === "t") { ev.preventDefault(); addNew("words"); return; }
      if (key === "f") { ev.preventDefault(); addNew("box"); return; }
    }
    if (busy || inline || !selId || selId === ROOT_ID || (ev.target as Element).closest?.("input, textarea, select, [contenteditable='true'], [data-de-menu]")) return;
    const mod = ev.ctrlKey || ev.metaKey, k = ev.key.toLowerCase();
    // A part cannot leave its block. The browser's own Ctrl+D and Ctrl+G stay out of it too.
    if (parsePartRef(selId) || o.nested) { if (mod && (k === "d" || k === "g")) ev.preventDefault(); return; }
    if (ev.key === "Delete" || ev.key === "Backspace") { ev.preventDefault(); remove(); }
    else if (!mod && ev.key === "[") { ev.preventDefault(); moveEnd("first"); }
    else if (!mod && ev.key === "]") { ev.preventDefault(); moveEnd("last"); }
    else if (mod && k === "d") { ev.preventDefault(); const el = elOf(selId); if (el) runTool("dup", el); }
    else if (mod && k === "g" && ev.shiftKey) { ev.preventDefault(); const el = elOf(selId); if (el) runTool("ungroup", el); }
    else if (mod && k === "g") { ev.preventDefault(); wrap("row"); }
  }, true);

  o.draw(doc);
  panel.render(context());
  shell.drawTop();

  if (o.nested) select(o.nested.blockId);

  const handle: TreeEditorHandle = {
    doc: () => doc,
    select,
    openLarge,
    up() {
      const el = elOf(selId), above = el ? source.parent(el) : null;
      if (!above) return false;
      ct.select(above);
      return true;
    },
    dirty: () => history.dirty(),
    fit() { setZoom("fit"); shell.drawTop(); },
    refresh() { ct.refresh(); renderBar(); },
    save() { void o.onSave(cleanBoxDoc(doc)); },
    dispose() {
      popup?.close();
      inline?.finish(true);
      bar.destroy();
      shell.dispose(); L.dispose(); ct.dispose(); panel.destroy(); side.remove();
      if (!o.nested) document.documentElement.classList.remove("de-vpanel-open", "de-present", "de-pan", "de-panning");
    },
  };
  return handle;
}

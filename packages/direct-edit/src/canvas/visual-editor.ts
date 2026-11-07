// ============================================================================
// Edit mode over a page's declared sections (2026-11-02): click-through to pick
// a box, the right-hand panel to change it, undo, save. The panel is the same
// one the classifieds editor uses, with fields chosen by the box and its parent
// (canvas/box-panel.ts) and a layer tree of the page's declared sections.
//
// The page is not re-rendered: edits are one stylesheet (block/patch.ts), the
// same one the public page is sent. The host supplies the document and onSave.
// ============================================================================

import { cleanPatches, patchCss, type BoxPatch, type PagePatches } from "../block/patch";
import { partDecls, type PartStyle } from "../block/style";
import { History } from "../model/history";
import { Panel, type LayerRow, type PanelContext } from "../panel/panel";
import { applyKey, backgroundOf, boxSlots, inheritedFrom, readBox, resetKey, styleOverridden, styleValues, usedColoursIn } from "./box-panel";
import { drawnOrder, movableOf, startBoxMove, startBoxResize } from "./box-drag";
import { mountClickThrough } from "./clickthrough";
import { mountEditShell, type PictureChooser } from "./edit-shell";
import { Listeners } from "./interact";
import { layerName, layerRole, parentLayer, readLayers, sectionOf, selectorFor, type LayerNode } from "./layers";
import type { MenuItem } from "./menu";

export { isPrivatePicture, type PictureChooser } from "./edit-shell";

export interface VisualEditorOptions {
  doc: PagePatches;
  /** Upload and storage for pictures. Without it the panel offers a pasted address. */
  choosePicture?: PictureChooser;
  onSave(doc: PagePatches): Promise<{ ok: boolean; error?: string }>;
  /** Leave edit mode. Default: remove the editor. */
  onDone?(): void;
}

export interface VisualEditorHandle { doc(): PagePatches; dispose(): void }

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const KIND_OF_ROLE: Record<string, string> = { Row: "row", Column: "column", Grid: "grid", Picture: "image", Video: "image", Graphic: "image", Embed: "image" };
const kindOf = (n: LayerNode) => KIND_OF_ROLE[n.role] ?? (n.kids.length ? "frame" : "text");

export function mountVisualEditor(o: VisualEditorOptions): VisualEditorHandle {
  const L = new Listeners();
  let doc = cleanPatches(o.doc);

  const sheet = document.createElement("style");
  sheet.dataset.editPatches = "";
  document.head.appendChild(sheet);
  // The page's own copy of the edits would keep hidden boxes hidden and removed edits showing.
  const publicSheet = document.querySelector<HTMLStyleElement>("style[data-edit-patches-public]");
  if (publicSheet) publicSheet.media = "not all";
  let savedDoc = doc;
  const paint = () => { sheet.textContent = patchCss(doc, { editor: true }); };

  const history = new History<PagePatches>(() => doc, (d) => { doc = d; paint(); ct.refresh(); drawPanel(); drawTop(); });
  const shell = mountEditShell<PagePatches>({
    history,
    save: () => cleanPatches(doc),
    onSave: o.onSave,
    onSaved: (clean) => { savedDoc = clean; },
    onDone: () => { if (o.onDone) o.onDone(); else handle.dispose(); },
    hint: () => (ct.selected() ? "Click again to go inside. Drag it to move it among its neighbours. Esc goes back out." : "Click a part of the page to change it."),
    warning() {
      const stale = Object.keys(doc.boxes).filter((s) => !document.querySelector(s)).length;
      return stale ? `${stale} change${stale === 1 ? "" : "s"} can no longer find ${stale === 1 ? "its" : "their"} place on the page` : null;
    },
    choosePicture: o.choosePicture,
    pageName: () => "This page",
    panel: {
      open: () => !side.hidden,
      toggle() { side.hidden = !side.hidden; document.documentElement.classList.toggle("de-vpanel-open", !side.hidden); ct.refresh(); },
    },
  });
  const drawTop = shell.drawTop;

  const side = document.createElement("div");
  side.className = "de-vpanel";
  side.dataset.deUi = "";
  document.body.append(side);
  document.documentElement.classList.add("de-vpanel-open");

  // ---------------------------------------------------------------- pictures
  const closeDrawer = shell.closePicture;
  function openDrawer() {
    const el = ct.selected(), k = el && keyOf(el);
    if (!el || !k) return;
    shell.openPicture(doc.boxes[k]?.image, "Background picture", (url) => edit(el, "image", (b) => { b.image = url; }));
  }

  // ---------------------------------------------------------------- layers
  let refs = new Map<string, HTMLElement>();
  let rows: LayerRow[] = [];
  function readTree() {
    refs = new Map();
    rows = [];
    const add = (n: LayerNode, depth: number, parent?: string) => {
      const firstWords = /“(.*)”$/.exec(n.name)?.[1];
      refs.set(n.address, n.el);
      rows.push({ ref: n.address, kind: kindOf(n), name: n.role, text: firstWords, depth, parent, canHide: true, link: n.el.tagName === "A" });
      for (const k of n.kids) add(k, depth + 1, n.address);
    };
    document.querySelectorAll<HTMLElement>("[data-edit-section]").forEach((s) => add(readLayers(s), 0));
  }
  const keyOf = (el: HTMLElement) => { const s = sectionOf(el); return s ? selectorFor(el, s) : null; };
  const liveRows = (): LayerRow[] => {
    const sel = ct.selected();
    return rows.map((r) => {
      const el = refs.get(r.ref)!, k = keyOf(el);
      return { ...r, selected: el === sel, hidden: !!(k && doc.boxes[k]?.style?.hide) };
    });
  };

  // ----------------------------------------------------------------- panel
  function edit(el: HTMLElement, field: string, fn: (b: BoxPatch) => void, live = false) {
    const k = keyOf(el);
    if (!k) return;
    history.remember(live ? `${k}:${field}` : null);
    const b: BoxPatch = clone(doc.boxes[k] ?? {});
    fn(b);
    if (b.style && !Object.keys(b.style).length) delete b.style;
    if (Object.keys(b).length) doc.boxes[k] = b; else delete doc.boxes[k];
    paint();
    ct.refresh();
    drawPanel();
    drawTop();
  }

  const panel = new Panel(side, {
    change(key, value, live) {
      const el = ct.selected();
      if (!el) return;
      if (key === "imageFit") return edit(el, key, (b) => { if (value === "contain") b.imageFit = "contain"; else delete b.imageFit; });
      edit(el, key, (b) => { const s: PartStyle = b.style ?? {}; applyKey(s, key, value, el); b.style = s; }, live);
    },
    reset(key) {
      const el = ct.selected();
      if (el) edit(el, key, (b) => { if (b.style) resetKey(b.style, key); });
    },
    select(ref) {
      const el = refs.get(ref);
      if (!el) return;
      ct.select(el);
      // Instant: a site may set smooth scrolling, and the outline should arrive with the box.
      el.scrollIntoView({ block: "nearest", behavior: "instant" as ScrollBehavior });
    },
    hover(ref) { ct.hover(ref ? refs.get(ref) ?? null : null); },
    toggleHidden(ref) {
      const el = refs.get(ref);
      if (el) edit(el, "hide", (b) => { const s: PartStyle = b.style ?? {}; if (s.hide) delete s.hide; else s.hide = true; b.style = s; });
    },
  });

  /** Colours already on the page, for the colour popover. Read once: the walk is not free. */
  let usedCache: string[] | null = null;
  function usedColours(): string[] {
    usedCache ??= usedColoursIn(document);
    return usedCache;
  }

  function context(): PanelContext {
    const el = ct.selected();
    const base: PanelContext = { tabs: ["props", "code"], key: "", heading: "", freedom: 2, slots: [], values: {}, overridden: {}, outside: [], theme: [], used: usedColours(), layers: liveRows() };
    if (!el) return { ...base, empty: `<p class="de-note de-pad">Click a part of the page, or a row above. Click again to go inside it.</p>` };
    const k = keyOf(el);
    const b: BoxPatch = (k && doc.boxes[k]) || {};
    const style = b.style ?? {};
    const computed = readBox(el);
    return {
      ...base,
      key: k ?? "",
      heading: layerRole(el),
      sub: /“(.*)”$/.exec(layerName(el))?.[1],
      slots: boxSlots(el, style),
      values: styleValues(style),
      computed,
      overridden: styleOverridden(style),
      fonts: { inPage: Object.values(doc.boxes).map((x) => x.style?.font).filter((f): f is string => !!f), family: [], library: true },
      contrast: { fg: (style.color ?? computed.color) as string | undefined, bg: backgroundOf(el), size: computed.size as number, weight: computed.weight as number },
      extra: {
        appearance: (o.choosePicture
          ? `<div class="de-row" data-sync="row-image"><span class="de-label">Picture</span><div class="de-ctl de-picture">${b.image ? `<span class="de-picture-thumb" style="background-image:url(&quot;${esc(b.image)}&quot;)"></span>` : ""}<button type="button" class="de-picture-btn" data-choose data-f="choose">${b.image ? "Change" : "Choose a picture"}</button>${b.image ? `<button type="button" class="de-picture-btn" data-clear-picture data-f="clear-picture">Remove</button>` : ""}</div><span class="de-aux"></span></div>`
          : `<div class="de-row" data-sync="row-image"><label class="de-label" for="de-image">Picture</label><div class="de-ctl"><input type="text" id="de-image" data-image placeholder="Paste a picture address" value="${esc(b.image ?? "")}" spellcheck="false" data-f="image"></div><span class="de-aux"></span></div>`) +
          (b.image ? `<div class="de-row c-chips" data-sync="row-imagefit"><span class="de-label">Picture fit</span><div class="de-ctl"><div class="de-seg chips" role="group" aria-label="Picture fit"><button data-set="imageFit" data-val="&quot;cover&quot;" aria-pressed="${b.imageFit !== "contain"}" data-f="fit-cover">Fill</button><button data-set="imageFit" data-val="&quot;contain&quot;" aria-pressed="${b.imageFit === "contain"}" data-f="fit-contain">Show all</button></div></div><span class="de-aux"></span></div>` : `<div data-sync="row-imagefit" hidden></div>`),
      },
      code: {
        written: partDecls(style, { editor: true }).concat(b.image ? [["background-image", `url("${b.image}")`]] : []),
        css: "",
        editable: false,
        readOnly: true,
        intro: "The changes saved on this box. The page's own styling is not listed.",
        sanitize: () => [],
        inherited: inheritedFrom(el),
      },
    };
  }
  const drawPanel = () => panel.render(context());

  L.on(side, "input", (ev: Event) => {
    const t = ev.target as HTMLInputElement;
    if (t.dataset.image === undefined) return;
    const el = ct.selected();
    if (el) edit(el, "image", (b) => { if (t.value.trim()) b.image = t.value.trim(); else { delete b.image; delete b.imageFit; } }, true);
  });

  L.on(side, "click", (ev: MouseEvent) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>("button");
    if (!t) return;
    if (t.dataset.choose !== undefined) openDrawer();
    else if (t.dataset.clearPicture !== undefined) {
      const el = ct.selected();
      if (el) edit(el, "image", (b) => { delete b.image; delete b.imageFit; });
    }
  });
  // ---------------------------------------------------------------- canvas
  const write = (el: HTMLElement, fn: (s: PartStyle) => void) => {
    const k = keyOf(el);
    if (!k) return;
    const b: BoxPatch = doc.boxes[k] ?? {};
    const s: PartStyle = b.style ?? {};
    fn(s);
    b.style = s;
    doc.boxes[k] = b;
  };

  /** Put a parent's children in a new order. Plain block parents become a column: order only works in flex and grid. */
  function applySequence(target: HTMLElement, sequence: HTMLElement[]) {
    history.remember(null);
    const parent = target.parentElement!;
    const display = getComputedStyle(parent).display;
    if (!display.includes("flex") && !display.includes("grid")) write(parent, (s) => { s.layout = "stack"; s.dir = "column"; s.items = "stretch"; });
    sequence.forEach((k, i) => write(k, (s) => { s.order = i; }));
    paint();
    ct.refresh();
    drawPanel();
    drawTop();
  }
  /** The box as it moves, and its siblings in drawn order; null when it cannot move. */
  function neighbours(el: HTMLElement): { target: HTMLElement; all: HTMLElement[] } | null {
    const section = sectionOf(el);
    const target = section && movableOf(el, section);
    if (!target?.parentElement) return null;
    const all = drawnOrder(target.parentElement).filter((k) => k.getBoundingClientRect().width > 0);
    return all.length > 1 ? { target, all } : null;
  }
  function moveToEnd(el: HTMLElement, end: "first" | "last") {
    const n = neighbours(el);
    if (!n) return;
    const rest = n.all.filter((k) => k !== n.target);
    applySequence(n.target, end === "first" ? [n.target, ...rest] : [...rest, n.target]);
  }

  /** Copy style: how a box looks, not where it sits. */
  let styleClip: PartStyle | null = null;
  const LOOK_ONLY = ["order", "cspan", "w", "h", "self", "grow", "hide"] as const;

  function menuTools(el: HTMLElement): MenuItem[] {
    const section = sectionOf(el);
    const k = keyOf(el);
    const b = (k && doc.boxes[k]) || {};
    const n = neighbours(el);
    return [
      { id: "parent", label: "Select parent", hint: "Esc", disabled: !section || !parentLayer(el, section) },
      { id: "copy-style", label: "Copy style", sep: true, disabled: !b.style },
      { id: "paste-style", label: "Paste style", disabled: !styleClip },
      { id: "first", label: "Move to first", hint: "[", sep: true, disabled: !n || n.all[0] === n.target },
      { id: "last", label: "Move to last", hint: "]", disabled: !n || n.all[n.all.length - 1] === n.target },
      ...(o.choosePicture ? [{ id: "picture", label: b.image ? "Change picture" : "Choose a picture", sep: true }] : []),
      { id: "hide", label: b.style?.hide ? "Show" : "Hide", sep: !o.choosePicture },
      { id: "reset", label: "Reset changes", disabled: !Object.keys(b).length, danger: true },
    ];
  }

  function runTool(id: string, el: HTMLElement) {
    const k = keyOf(el);
    const section = sectionOf(el);
    switch (id) {
      case "parent": if (section) ct.select(parentLayer(el, section)); break;
      case "copy-style": {
        const c: PartStyle = clone((k && doc.boxes[k]?.style) || {});
        for (const key of LOOK_ONLY) delete c[key];
        styleClip = c;
        drawTop("Style copied. Select another box and paste it.");
        break;
      }
      case "paste-style": if (styleClip) { const clip = styleClip; edit(el, "paste", (b) => { b.style = { ...(b.style ?? {}), ...clone(clip) }; }); } break;
      case "first": moveToEnd(el, "first"); break;
      case "last": moveToEnd(el, "last"); break;
      case "picture": openDrawer(); break;
      case "hide": edit(el, "hide", (b) => { const s: PartStyle = b.style ?? {}; if (s.hide) delete s.hide; else s.hide = true; b.style = s; }); break;
      case "reset": edit(el, "reset", (b) => { for (const key of Object.keys(b)) delete (b as Record<string, unknown>)[key]; }); break;
    }
  }

  const ct = mountClickThrough({
    menu: menuTools,
    onMenu: runTool,
    onSelect: () => { closeDrawer(); panel.render(context(), true); drawTop(); },
    handles: () => ["e", "s", "se"],
    onHandle(ev, handle, el) {
      history.remember(null);
      const before = clone(doc);
      ct.hold(true);
      startBoxResize({
        ev, el, handle,
        onChange(c) {
          write(el, (s) => {
            if (c.cspan !== undefined) s.cspan = c.cspan;
            if (c.w !== undefined) s.w = c.w;
            if (c.h !== undefined) s.h = c.h;
          });
          paint();
          ct.hold(true, c.label);
        },
        onEnd(commit) {
          if (!commit) { doc = before; history.undo(); paint(); }
          ct.hold(false);
          drawPanel();
          drawTop();
        },
      });
    },
    onPull(ev, el) {
      const section = sectionOf(el);
      const target = section && movableOf(el, section);
      if (!section || !target || !target.parentElement) return;
      ct.hold(true);
      startBoxMove({
        ev, el: target, name: layerRole(el),
        onDrop(sequence) { applySequence(target, sequence); },
        onEnd() { ct.hold(false); },
      });
    },
  });

  L.on(document, "keydown", (ev: KeyboardEvent) => {
    if ((ev.target as Element).closest?.("input, textarea, select, [data-de-menu]")) return;
    if ((ev.key === "[" || ev.key === "]") && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      const el = ct.selected();
      if (el) { ev.preventDefault(); moveToEnd(el, ev.key === "[" ? "first" : "last"); }
    }
  }, true);

  readTree();
  paint();
  drawPanel();
  drawTop();

  const handle: VisualEditorHandle = {
    doc: () => doc,
    dispose() {
      shell.dispose();
      L.dispose(); ct.dispose(); panel.destroy(); sheet.remove(); side.remove();
      document.documentElement.classList.remove("de-vpanel-open");
      // What the page shows after editing is what was saved. Without a saved copy on the page, add one.
      const css = patchCss(savedDoc);
      if (publicSheet) { publicSheet.textContent = css; publicSheet.media = ""; }
      else if (css) { const s = document.createElement("style"); s.dataset.editPatchesPublic = ""; s.textContent = css; document.head.appendChild(s); }
    },
  };
  return handle;
}

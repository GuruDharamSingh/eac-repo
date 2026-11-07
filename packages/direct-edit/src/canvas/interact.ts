// ============================================================================
// Canvas interactions, plain DOM: click-deeper selection and hover, right-click,
// inline text (plain or rich), wheel shortcuts (Alt = cycle fonts, Shift =
// size), grid-span resize from edge handles, and ghost drags (graft a part onto
// another block; move a block with an insertion line, here or in the layer
// tree). The host owns the data; these only report.
// ============================================================================

import { deeper, hitChain, hitTest, ROOT, sameRef, type NodeRef } from "../model/nodes";
import { sanitizeRich, type RichOpts } from "../model/richtext";

/** Collects listeners so a mounted editor can remove all of them at once. */
export class Listeners {
  private offs: Array<() => void> = [];
  on<K extends string>(el: EventTarget, type: K, fn: (ev: any) => void, opts?: AddEventListenerOptions | boolean): void {
    el.addEventListener(type, fn as EventListener, opts);
    this.offs.push(() => el.removeEventListener(type, fn as EventListener, opts));
  }
  add(off: () => void): void { this.offs.push(off); }
  dispose(): void { for (const off of this.offs.splice(0)) off(); }
}

export interface CanvasOptions {
  /** Element holding the rendered nodes. */
  scope: HTMLElement;
  /** Scroll container receiving wheel shortcuts. */
  canvas: HTMLElement;
  getSel(): NodeRef | null;
  select(r: NodeRef | null): void;
  getHover(): NodeRef | null;
  setHover(r: NodeRef | null): void;
  /** True while a drag is running or a tool other than Select is active (hover is frozen). */
  busy(): boolean;
  /** Double-click on a part, or Enter on a selected part. */
  onInline?(r: NodeRef): void;
  /** Alt + wheel (font) or Shift + wheel (size) over a part. */
  onWheel?(r: NodeRef, kind: "font" | "size", dir: 1 | -1): void;
  /** A click on a node. Return true when a tool handled it (no selection change). */
  onClick?(ev: MouseEvent, hit: NodeRef): boolean;
  /** Right-click on a node (the browser's menu is already suppressed). */
  onContext?(ev: MouseEvent, hit: NodeRef): void;
  /** Click on empty space around the nodes. Return true when handled. */
  onEmptyClick?(ev: MouseEvent): boolean;
  /**
   * Nested parts (pass 3): what a click selects, given the parts around the
   * target (outermost first). Default: block, then the part (one level).
   */
  deeper?(current: NodeRef | null, node: string, chain: string[]): NodeRef;
  /** Press and pull (more than a few px) on a node: the host starts a drag. */
  onPressDrag?(ev: PointerEvent, hit: NodeRef, chain: string[]): void;
}

export function bindCanvas(o: CanvasOptions, L: Listeners): { suppressNextClick(): void } {
  let suppress = false;
  const suppressNext = () => { suppress = true; setTimeout(() => { suppress = false; }, 0); };
  L.on(o.scope, "click", (ev: MouseEvent) => {
    if (suppress) { suppress = false; return; }
    const t = ev.target as HTMLElement;
    if (t.closest('[contenteditable="true"]')) return;
    const hit = hitTest(t);
    if (!hit) { if (o.busy()) return; if (!o.onEmptyClick?.(ev)) o.select(null); return; }
    ev.preventDefault();
    if (o.onClick?.(ev, { node: hit.node, part: hit.part })) return;
    const c = o.deeper ? hitChain(t) : null;
    // Alt goes straight to the deepest box under the pointer.
    if (ev.altKey && c) { o.select({ node: c.node, part: c.chain[c.chain.length - 1] ?? ROOT }); return; }
    o.select(o.deeper && c ? o.deeper(o.getSel(), c.node, c.chain) : deeper(o.getSel(), hit));
  });
  if (o.onPressDrag) {
    L.on(o.scope, "pointerdown", (ev: PointerEvent) => {
      if (ev.button !== 0 || o.busy() || ev.altKey) return;
      const t = ev.target as HTMLElement;
      if (t.closest('[contenteditable="true"]')) return;
      const c = hitChain(t);
      if (!c) return;
      const x0 = ev.clientX, y0 = ev.clientY;
      const move = (m: PointerEvent) => {
        if (Math.hypot(m.clientX - x0, m.clientY - y0) < 5) return;
        stop();
        suppressNext();
        o.onPressDrag!(m, { node: c.node, part: c.chain[c.chain.length - 1] ?? ROOT }, c.chain);
      };
      const stop = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", stop); };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", stop);
    });
  }
  L.on(o.scope, "contextmenu", (ev: MouseEvent) => {
    const hit = hitTest(ev.target);
    if (!hit) return;
    ev.preventDefault();
    o.onContext?.(ev, { node: hit.node, part: hit.part });
  });
  L.on(o.scope, "dblclick", (ev: MouseEvent) => {
    if (o.busy()) return;
    const hit = hitTest(ev.target);
    if (hit && hit.part !== ROOT) o.onInline?.({ node: hit.node, part: hit.part });
  });
  L.on(o.scope, "mousemove", (ev: MouseEvent) => {
    if (o.busy()) return;
    const hit = hitTest(ev.target);
    const sel = o.getSel();
    const c = hit && o.deeper ? hitChain(ev.target) : null;
    // Hover outlines what a click would select.
    const h: NodeRef | null = !hit ? null : c && o.deeper ? o.deeper(sel, c.node, c.chain) : sel && sel.node === hit.node ? { node: hit.node, part: hit.part } : { node: hit.node, part: ROOT };
    if (!sameRef(h, o.getHover())) o.setHover(h);
  });
  L.on(o.scope, "mouseleave", () => { if (o.getHover()) o.setHover(null); });
  if (o.onWheel) {
    L.on(o.canvas, "wheel", (ev: WheelEvent) => {
      if (!(ev.altKey || ev.shiftKey) || ev.ctrlKey) return;
      const hit = hitTest(ev.target);
      if (!hit || hit.part === ROOT) return;
      ev.preventDefault();
      const dir = ((ev.deltaY || ev.deltaX) > 0 ? 1 : -1) as 1 | -1;
      o.onWheel!({ node: hit.node, part: hit.part }, ev.altKey ? "font" : "size", dir);
    }, { passive: false });
  }
  return { suppressNextClick: suppressNext };
}

// ---------------------------------------------------------------------------
// Inline text
// ---------------------------------------------------------------------------

export type InlineCommand = "bold" | "italic" | "underline" | "list" | "unlink";

export interface InlineOptions {
  /** The stored words: plain text, or (rich) the allow-listed markup. */
  initial: string;
  /** Shift+Enter makes a line break instead of committing. */
  multiline?: boolean;
  /** The part takes b / i / u / links / (list) markup. Off = plain text. */
  rich?: RichOpts | false;
  onCommit(text: string): void;
  onCancel(): void;
  /** Focus moving to this element (the floating toolbar's link field) must not end the edit. */
  keepFocus?(to: Element | null): boolean;
  /** The selection inside the part changed (the floating toolbar follows it). */
  onSelection?(): void;
}

export interface InlineState { bold: boolean; italic: boolean; underline: boolean; list: boolean; link: boolean; range: boolean }
export interface InlineSession {
  el: HTMLElement;
  rich: boolean;
  command(cmd: InlineCommand): void;
  link(href: string): void;
  state(): InlineState;
  /** Remember / put back the selection (before and after the toolbar's link field). */
  saveRange(): void;
  restoreRange(): void;
  /** Commit (or with cancel, abandon) the edit now. */
  finish(cancel?: boolean): void;
  active(): boolean;
}

const escText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const TAG_OF: Record<string, string> = { b: "b", strong: "b", i: "i", em: "i", u: "u", a: "a", ul: "ul", li: "li" };

/** Walk an editable element and write the allow-listed markup (the host's sanitiser has the last word). */
export function domToRich(root: Node): string {
  let out = "";
  const walk = (n: Node): void => {
    if (n.nodeType === 3) { out += escText(n.nodeValue ?? ""); return; }
    if (n.nodeType !== 1) return;
    const e = n as HTMLElement, t = e.tagName.toLowerCase();
    if (t === "br") { out += "<br>"; return; }
    if (t === "div" || t === "p") {
      if (out && !out.endsWith("<br>") && !out.endsWith("</li>") && !out.endsWith("<ul>")) out += "<br>";
      e.childNodes.forEach(walk);
      return;
    }
    const tag = TAG_OF[t];
    if (!tag) { e.childNodes.forEach(walk); return; }
    out += tag === "a" ? `<a href="${escText(e.getAttribute("href") ?? "").replace(/"/g, "&quot;")}">` : `<${tag}>`;
    e.childNodes.forEach(walk);
    out += `</${tag}>`;
  };
  root.childNodes.forEach(walk);
  return out;
}

/** Type straight into a part. Enter commits, Escape cancels, blur commits. */
export function startInlineText(el: HTMLElement, o: InlineOptions): InlineSession {
  const rich = o.rich !== undefined && o.rich !== false;
  const richOpts: RichOpts = rich ? (o.rich as RichOpts) : {};
  if (rich) el.innerHTML = o.initial ? sanitizeRich(o.initial, richOpts) : "";
  else if (!o.initial) el.textContent = "";
  el.style.opacity = "1";
  el.setAttribute("contenteditable", "true");
  el.focus();
  const r = document.createRange();
  r.selectNodeContents(el);
  const s = getSelection();
  s?.removeAllRanges();
  s?.addRange(r);
  let cancel = false, over = false, saved: Range | null = null;
  // A list typed inside the part, not one the part sits in (a step of a numbered list, 2026-11-06).
  const inList = () => { const a = getSelection()?.anchorNode; const li = a ? (a.nodeType === 1 ? (a as Element) : a.parentElement)?.closest("li") : null; return !!li && li !== el && el.contains(li); };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); finish(true); }
    else if (ev.key === "Enter" && ev.ctrlKey) { ev.preventDefault(); ev.stopPropagation(); finish(false); }
    else if (ev.key === "Enter" && !(o.multiline && ev.shiftKey) && !(rich && inList())) { ev.preventDefault(); ev.stopPropagation(); finish(false); }
  };
  // Pasted text is plain text, whatever the clipboard holds.
  const onPaste = (ev: ClipboardEvent) => {
    ev.preventDefault();
    const text = ev.clipboardData?.getData("text/plain") ?? "";
    document.execCommand("insertText", false, o.multiline ? text : text.replace(/\s*\n\s*/g, " "));
  };
  const onBlur = (ev: FocusEvent) => { if (o.keepFocus?.(ev.relatedTarget as Element | null)) { saveRange(); return; } finish(false); };
  const onSel = () => { if (!over && (getSelection()?.anchorNode && el.contains(getSelection()!.anchorNode))) o.onSelection?.(); };
  el.addEventListener("keydown", onKey);
  el.addEventListener("paste", onPaste);
  el.addEventListener("blur", onBlur);
  document.addEventListener("selectionchange", onSel);

  function saveRange() { const sel = getSelection(); if (sel && sel.rangeCount && el.contains(sel.anchorNode)) saved = sel.getRangeAt(0).cloneRange(); }
  function restoreRange() { el.focus({ preventScroll: true }); if (saved) { const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(saved); } }
  function finish(c = false) {
    if (over) return;
    over = true; cancel = c;
    el.removeEventListener("keydown", onKey);
    el.removeEventListener("paste", onPaste);
    el.removeEventListener("blur", onBlur);
    document.removeEventListener("selectionchange", onSel);
    el.removeAttribute("contenteditable");
    if (el === document.activeElement) el.blur();
    if (rich) {
      const text = sanitizeRich(domToRich(el), richOpts);
      if (cancel || text === sanitizeRich(o.initial, richOpts)) o.onCancel(); else o.onCommit(text);
    } else {
      const text = el.innerText.replace(/\s+/g, " ").trim();
      if (cancel || text === o.initial) o.onCancel(); else o.onCommit(text);
    }
  }
  const exec = (cmd: string, val?: string) => { document.execCommand("styleWithCSS", false, "false"); document.execCommand(cmd, false, val); };
  return {
    el, rich,
    command(cmd) {
      restoreRange();
      if (cmd === "bold") exec("bold");
      else if (cmd === "italic") exec("italic");
      else if (cmd === "underline") exec("underline");
      else if (cmd === "list" && richOpts.list) exec("insertUnorderedList");
      else if (cmd === "unlink") exec("unlink");
      saveRange();
      o.onSelection?.();
    },
    link(href) { restoreRange(); exec("createLink", href); saveRange(); o.onSelection?.(); },
    state() {
      const sel = getSelection();
      const inside = !!sel && sel.rangeCount > 0 && !!sel.anchorNode && el.contains(sel.anchorNode);
      const q = (c: string) => { try { return inside && document.queryCommandState(c); } catch { return false; } };
      const anchor = inside ? (sel!.anchorNode!.nodeType === 1 ? (sel!.anchorNode as Element) : sel!.anchorNode!.parentElement) : null;
      return { bold: q("bold"), italic: q("italic"), underline: q("underline"), list: !!anchor?.closest("ul"), link: !!anchor?.closest("a"), range: inside && !sel!.isCollapsed };
    },
    saveRange, restoreRange, finish, active: () => !over,
  };
}

// ---------------------------------------------------------------------------
// Resize and drags
// ---------------------------------------------------------------------------

export interface GridResizeOptions {
  handle: string;          // "e" | "s" | "se"
  span: [number, number];
  cols: number;
  colStep: number;
  rowStep: number;
  minRows: number;
  maxRows: number;
  onMove(span: [number, number]): void;
  onEnd(span: [number, number] | null): void;
}

/** Drag an edge handle to change a grid span (columns, rows). */
export function startGridResize(ev: PointerEvent, o: GridResizeOptions): void {
  const x0 = ev.clientX, y0 = ev.clientY;
  let now: [number, number] = [...o.span];
  const move = (e: PointerEvent) => {
    let [c, r] = o.span;
    if (o.handle !== "s") c = Math.max(1, Math.min(o.cols, Math.round(o.span[0] + (e.clientX - x0) / o.colStep)));
    if (o.handle !== "e") r = Math.max(o.minRows, Math.min(o.maxRows, Math.round(o.span[1] + (e.clientY - y0) / o.rowStep)));
    if (c !== now[0] || r !== now[1]) { now = [c, r]; o.onMove(now); }
  };
  document.body.classList.add("de-resizing", "de-resize-" + o.handle);
  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", () => {
    document.removeEventListener("pointermove", move);
    document.body.classList.remove("de-resizing", "de-resize-" + o.handle);
    o.onEnd(now[0] !== o.span[0] || now[1] !== o.span[1] ? now : null);
  }, { once: true });
}

export interface GhostDragOptions {
  label: string;
  /** Where the ghost and insertion line are drawn (position: fixed children). */
  host: HTMLElement;
  /** The drop target under the pointer, or null. */
  target(under: HTMLElement): HTMLElement | null;
  /** Draw an insertion line (before / after the target) instead of an outline. */
  insertion?: boolean;
  /** Which way the targets are laid out: "x" (before = left half, the sheet) or "y" (before = top half, a list). */
  axis?: "x" | "y";
  /**
   * With `insertion` and axis "y": may this target also take the drop INSIDE it (a box's layer row)? Then the
   * middle half of the target outlines it instead of drawing a line, and `onDrop` gets `inside` true.
   */
  inside?(target: HTMLElement): boolean;
  onDrop(target: HTMLElement, before: boolean, inside: boolean): void;
  onEnd?(): void;
}

/** A labelled ghost follows the pointer; the target is outlined or gets an insertion line. Escape cancels. */
export function startGhostDrag(ev: PointerEvent, o: GhostDragOptions): void {
  const ghost = document.createElement("div");
  ghost.className = "de-ghost";
  ghost.textContent = o.label;
  o.host.appendChild(ghost);
  const line = document.createElement("div");
  line.className = "de-insert";
  line.hidden = true;
  o.host.appendChild(line);
  document.body.classList.add("de-dragging");
  let target: HTMLElement | null = null, before = false, inside = false;
  const place = (e: PointerEvent) => {
    ghost.style.left = e.clientX + 12 + "px";
    ghost.style.top = e.clientY + 12 + "px";
    const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const t = under ? o.target(under) : null;
    if (t !== target) { target?.classList.remove("de-drop"); if (!o.insertion) t?.classList.add("de-drop"); target = t; }
    inside = false;
    if (o.insertion && t && o.axis === "y" && o.inside?.(t)) {
      const r = t.getBoundingClientRect();
      inside = e.clientY > r.top + r.height / 4 && e.clientY < r.bottom - r.height / 4;
      t.classList.toggle("de-drop", inside);
    }
    if (inside) line.hidden = true;
    else if (o.insertion && t) {
      const r = t.getBoundingClientRect();
      if (o.axis === "y") {
        before = e.clientY < r.top + r.height / 2;
        Object.assign(line.style, { left: r.left + "px", width: r.width + "px", height: "3px", top: (before ? r.top - 2 : r.bottom - 1) + "px" });
      } else {
        before = e.clientX < r.left + r.width / 2;
        Object.assign(line.style, { left: (before ? r.left - 6 : r.right + 3) + "px", width: "3px", top: r.top + "px", height: r.height + "px" });
      }
      line.hidden = false;
    } else line.hidden = true;
  };
  place(ev);
  const finish = (drop: boolean) => {
    document.removeEventListener("pointermove", place);
    document.removeEventListener("pointerup", up);
    document.removeEventListener("keydown", key, true);
    ghost.remove();
    line.remove();
    document.body.classList.remove("de-dragging");
    target?.classList.remove("de-drop");
    if (drop && target) o.onDrop(target, before, inside);
    o.onEnd?.();
  };
  const up = () => finish(true);
  const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(false); } };
  document.addEventListener("pointermove", place);
  document.addEventListener("pointerup", up);
  document.addEventListener("keydown", key, true);
}

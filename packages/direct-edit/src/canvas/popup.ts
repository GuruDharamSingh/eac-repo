// ============================================================================
// A sealed block, large, over the dimmed page (2026-11-04, synthesis 4.1, stone 4).
//
// A second mount of the same tree editor on a working copy of one block. This file
// is only the frame: the dim, the stage at the width the block has on the page,
// Esc, and the question before discarding. Editor chrome in a fixed layer, not a
// <dialog>: Esc goes up a level here and a surface opened by a live control still
// stacks above it. Undo inside is the mount's own, so discarding is free. Nothing
// reaches the page until "Use on this page", and nothing is public until the page's
// own Save.
// ============================================================================

import { backgroundOf } from "./box-panel";
import { Listeners } from "./interact";

export interface PopupHost {
  /** Where the page is drawn. */
  stage: HTMLElement;
  /** Where the panel, pills, thin bar and menus go. */
  chrome: HTMLElement;
  /** Where selection boxes go: clipped to the stage's area. */
  layers: HTMLElement;
  /** The width a fitted page may take. */
  fitWidth(): number;
  /** Draws the stage at this size. A transform, not CSS zoom: browsers disagree on what a rectangle under zoom measures. */
  applyZoom(z: number): void;
  /** The Close button was pressed: asks first when something changed. */
  close(): void;
}

export interface PopupEditor { up(): boolean; dirty(): boolean; fit(): void; refresh(): void; save(): void; dispose(): void }

export interface PopupOptions {
  /** The block's name. */
  name: string;
  /** Where the page is drawn now: its classes and text setting carry over, so the block's CSS reads the same. */
  scope: HTMLElement;
  /** The block's width on the page, in the page's own pixels. */
  width: number;
  /** Measures the block inside the stage. */
  measure(stage: HTMLElement): HTMLElement | null;
  mount(host: PopupHost): PopupEditor;
  /** The frame is gone. */
  onClosed(): void;
}

export interface PopupHandle { close(): void }

const SIDE_PAD = 20;

export function openBlockPopup(o: PopupOptions): PopupHandle {
  const L = new Listeners();
  const returnTo = document.activeElement as HTMLElement | null;
  const root = document.createElement("div");
  root.className = "de-popup";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", `Editing ${o.name}`);
  root.innerHTML = `<div class="de-popup-dim" data-de-ui></div><div class="de-popup-frame" tabindex="-1"><div class="de-popup-main"><div class="de-popup-fit"><div class="de-popup-stage"></div></div></div><div class="de-popup-sheet"></div><div class="de-popup-ask" data-de-ui role="alertdialog" aria-label="Changes not used" hidden><p>Your changes to this block are not on the page yet.</p><div><button type="button" data-ask="use" class="primary">Use on this page</button><button type="button" data-ask="discard">Discard them</button><button type="button" data-ask="keep">Keep editing</button></div></div></div>`;
  document.body.append(root);
  const frame = root.querySelector<HTMLElement>(".de-popup-frame")!;
  const main = root.querySelector<HTMLElement>(".de-popup-main")!;
  const fitBox = root.querySelector<HTMLElement>(".de-popup-fit")!;
  const stage = root.querySelector<HTMLElement>(".de-popup-stage")!;
  const sheet = root.querySelector<HTMLElement>(".de-popup-sheet")!;
  const ask = root.querySelector<HTMLElement>(".de-popup-ask")!;

  // The block's CSS may read its host's classes. The host's own room around the page is not the stage's.
  const page = getComputedStyle(o.scope);
  stage.className = `${o.scope.className} de-popup-stage`.trim();
  // A computed line height is in pixels, which a larger title would inherit as is and overlap itself. As a ratio it follows each element's own size.
  const lineHeight = parseFloat(page.lineHeight) / parseFloat(page.fontSize);
  Object.assign(stage.style, { width: `${o.width}px`, background: backgroundOf(o.scope) ?? "", color: page.color, fontFamily: page.fontFamily, fontSize: page.fontSize, lineHeight: Number.isFinite(lineHeight) ? String(lineHeight) : page.lineHeight });
  // A site's stylesheet may read classes further out (`.ifs .ifs-btn`) and tokens set there. They go on the box around the stage, with their room and background taken off, so they reach the block and do not lay out the frame.
  const outer: string[] = [];
  for (let e = o.scope.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) if (e.className && typeof e.className === "string") outer.unshift(e.className);
  if (outer.length) {
    fitBox.className = `${outer.join(" ")} ${fitBox.className}`;
    Object.assign(fitBox.style, { display: "block", minHeight: "0", padding: "0", background: "none", border: "0", overflow: "visible" });
  }

  let scale = 1;
  /** A transform leaves the stage's layout size alone, so the box around it takes the scaled size. */
  const sizeBox = () => { fitBox.style.width = `${stage.offsetWidth * scale}px`; fitBox.style.height = `${stage.offsetHeight * scale}px`; };
  const applyZoom = (z: number) => { scale = z; stage.style.transform = `scale(${z})`; sizeBox(); };
  // A setting that changes the block's height moves everything under the fitted box, selection boxes included.
  const watch = new ResizeObserver(() => { sizeBox(); ed?.refresh(); });
  watch.observe(stage);

  let ed: PopupEditor | null = null;
  let closed = false;
  function finish() {
    if (closed) return;
    closed = true;
    watch.disconnect();
    L.dispose();
    ed?.dispose();
    root.remove();
    o.onClosed();
    if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
  }
  const askClose = () => {
    if (!ed?.dirty()) { finish(); return; }
    ask.hidden = false;
    ask.querySelector<HTMLElement>('[data-ask="keep"]')!.focus();
  };

  // Registered before the mount, so these run before its own keys: Esc here goes up a level, then closes.
  L.on(document, "keydown", (ev: KeyboardEvent) => {
    if (ev.key !== "Escape") return;
    const t = ev.target as Element;
    const stop = () => { ev.preventDefault(); ev.stopImmediatePropagation(); };
    if (!ask.hidden) { stop(); ask.hidden = true; frame.focus({ preventScroll: true }); return; }
    // What is open on top keeps its own Esc: a menu, a colour or font list, the thin bar's fields, the picture drawer, typing in place.
    if (frame.querySelector("[data-de-menu], .de-pop") || t.closest?.(".de-mb, [contenteditable='true']") || document.documentElement.classList.contains("de-moving")) return;
    const drawer = frame.querySelector<HTMLElement>(".de-vdrawer");
    if (drawer && !drawer.hidden) return;
    stop();
    if (t.closest?.("input, textarea, select")) { (t as HTMLElement).blur(); return; }
    if (!ed?.up()) askClose();
  }, true);
  L.on(ask, "click", (ev: MouseEvent) => {
    const a = (ev.target as HTMLElement).closest<HTMLElement>("[data-ask]")?.dataset.ask;
    if (a === "keep") { ask.hidden = true; frame.focus({ preventScroll: true }); }
    else if (a === "discard") finish();
    else if (a === "use") { ask.hidden = true; ed?.save(); }
  });
  // A press and release both on the dim: the same as Close.
  const dim = root.querySelector<HTMLElement>(".de-popup-dim")!;
  let pressedDim = false;
  L.on(dim, "pointerdown", () => { pressedDim = true; });
  L.on(dim, "click", () => { if (pressedDim) askClose(); pressedDim = false; });

  const fitWidth = () => Math.max(120, main.clientWidth - 2 * SIDE_PAD);
  ed = o.mount({ stage, chrome: frame, layers: sheet, fitWidth, applyZoom, close: askClose });
  // The block itself takes the width it has on the page, whatever room the page's root draws around it.
  const at = o.measure(stage);
  if (at) {
    const drawn = at.getBoundingClientRect().width;
    if (drawn > 0 && Math.abs(drawn - o.width) > 0.5) stage.style.width = `${o.width + (o.width - drawn)}px`;
  }
  ed.fit();
  frame.focus({ preventScroll: true });

  return { close: finish };
}

// ============================================================================
// What both edit modes share (2026-11-02): the two floating pills, as on the
// canvas (page and tools at the left; present, panel, zoom, then undo and save at
// the right), saving, the keyboard's undo, the warning before leaving with unsaved
// work, and the drawer that holds the host's picture chooser.
// ============================================================================

import type { History } from "../model/history";
import { icon } from "../panel/icons";
import { Listeners } from "./interact";
import { openMenu, type MenuItem } from "./menu";

/** Opens the host's picture chooser inside `host` (React or not); returns how to close it. */
export type PictureChooser = (host: HTMLElement, o: { value?: string; onPick(url: string): void }) => () => void;

/** A media path with a Private segment is not served to visitors, so it cannot be a page's picture. */
export function isPrivatePicture(url: string): boolean {
  let path = url;
  try { path = decodeURIComponent(url); } catch { /* keep the raw text */ }
  return /(^|\/)Private(\/|$)/.test(path.split("?")[0] ?? "");
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

export interface ShellTool { id: string; label: string; icon: string; key?: string; disabled?: boolean; /** Stays pressed while it is the tool in use. */ toggle?: boolean }

export interface ShellOptions<D> {
  /** Where the pills and the picture drawer go. Default: the document's body. */
  host?: HTMLElement;
  /** Words on the save and done buttons. Default: Save, Done. */
  saveLabel?: string;
  doneLabel?: string;
  /** Done only reports, and the host decides whether to ask. Absent: Done asks with confirm(). */
  onClose?(): void;
  history: History<D>;
  /** The document to save, already cleaned. */
  save(): D;
  onSave(doc: D): Promise<{ ok: boolean; error?: string }>;
  onSaved?(doc: D): void;
  /** Said once before the first save, with a way out: what this save does that a person cannot see from here. */
  saveNotice?: string;
  onDone(): void;
  /** The hint in the middle. */
  hint(): string;
  /** A warning shown after the hint, or null. */
  warning?(): string | null;
  /** The page's name, on the left pill. */
  pageName?(): string;
  /** Its menu. */
  pageMenu?(): MenuItem[];
  onPageMenu?(id: string): void;
  /** Tools after the page name. */
  tools?: ShellTool[];
  onTool?(id: string): void;
  /** The tool in use. */
  activeTool?(): string | null;
  panel?: { open(): boolean; toggle(): void };
  zoom?: { value(): number; set(z: number | "fit"): void };
  present?: { on(): boolean; toggle(): void };
  choosePicture?: PictureChooser;
}

export interface EditShell {
  drawTop(message?: string): void;
  openPicture(value: string | undefined, title: string, onPick: (url: string) => void): void;
  closePicture(): void;
  openDrawer(title: string, mount: (body: HTMLElement, close: () => void) => () => void): void;
  /** Undo and the shell's other keys stop while a second mount over this one has the keyboard. */
  pause(on: boolean): void;
  dispose(): void;
}

export function mountEditShell<D>(o: ShellOptions<D>): EditShell {
  const L = new Listeners();
  let saving = false;
  let paused = false;
  let closeChooser: (() => void) | null = null;

  const top = document.createElement("div");
  top.className = "de-editbar";
  top.dataset.deUi = "";
  const drawer = document.createElement("div");
  drawer.className = "de-vdrawer";
  drawer.dataset.deUi = "";
  drawer.hidden = true;
  drawer.setAttribute("role", "region");
  drawer.setAttribute("aria-label", "Choose a picture");
  (o.host ?? document.body).append(top, drawer);

  function drawTop(message?: string) {
    const warn = o.warning?.();
    const active = o.activeTool?.();
    const name = o.pageName?.() ?? "This page";
    const tools = (o.tools ?? []).map((t) => `<button type="button" class="de-pill-ico" data-a="${esc(t.id)}" title="${esc(t.label)}${t.key ? ` (${esc(t.key)})` : ""}" aria-label="${esc(t.label)}"${t.toggle ? ` aria-pressed="${active === t.id}"` : ""}${t.disabled ? " disabled" : ""}>${icon(t.icon)}</button>`).join("");
    const view = (o.present ? `<button type="button" class="de-pill-ico" data-a="present" title="Preview the page" aria-label="Preview the page" aria-pressed="${o.present.on()}">${icon("play")}</button>` : "") +
      (o.panel ? `<button type="button" class="de-pill-ico" data-a="panel" title="Panel" aria-label="Panel" aria-pressed="${o.panel.open()}">${icon("panel")}</button>` : "") +
      (o.zoom ? `<button type="button" class="de-pill-zoom" data-a="zoom" title="Zoom" aria-haspopup="menu">${Math.round(o.zoom.value() * 100)}%${icon("down")}</button>` : "");
    top.innerHTML = `<div class="de-pill de-pill-tools"><button type="button" class="de-pill-page" data-a="page"${o.pageMenu ? ' aria-haspopup="menu"' : ""} title="${esc(name)}"><span>${esc(name)}</span>${o.pageMenu ? icon("down") : ""}</button>${tools ? `<span class="de-pill-sep"></span>${tools}` : ""}</div>
      <div class="de-pill-note"><span class="de-editbar-hint">${esc(message ?? o.hint())}</span>${warn ? `<span class="de-editbar-warn">${esc(warn)}</span>` : ""}</div>
      <div class="de-pill de-pill-view">${view}${view ? '<span class="de-pill-sep"></span>' : ""}<button type="button" class="de-pill-ico" data-a="undo" title="Undo (Ctrl+Z)" aria-label="Undo"${o.history.canUndo ? "" : " disabled"}>${icon("undo")}</button><button type="button" class="de-pill-ico" data-a="redo" title="Redo (Ctrl+Shift+Z)" aria-label="Redo"${o.history.canRedo ? "" : " disabled"}>${icon("redo")}</button><button type="button" class="de-pill-text primary" data-a="save"${o.history.dirty() && !saving ? "" : " disabled"}>${saving ? "Saving…" : esc(o.saveLabel ?? "Save")}</button><button type="button" class="de-pill-text" data-a="done">${esc(o.doneLabel ?? "Done")}</button></div>`;
  }

  let noticed = false;
  async function save() {
    if (o.saveNotice && !noticed) {
      if (!confirm(o.saveNotice)) return;
      noticed = true;
    }
    saving = true;
    drawTop();
    const clean = o.save();
    let res: { ok: boolean; error?: string };
    try { res = await o.onSave(clean); } catch (e) { res = { ok: false, error: e instanceof Error ? e.message : "The save did not reach the server." }; }
    saving = false;
    if (res.ok) { o.history.markSaved(); o.onSaved?.(clean); }
    drawTop(res.ok ? "Saved." : `Not saved: ${res.error ?? "try again."}`);
  }

  function closePicture() {
    closeChooser?.();
    closeChooser = null;
    drawer.hidden = true;
    drawer.innerHTML = "";
  }
  /** The side drawer, with anything the caller draws in it (a record chooser, 2026-11-06). Closed by its button, Escape, or the next drawer. */
  function openDrawer(title: string, mount: (body: HTMLElement, close: () => void) => () => void) {
    closePicture();
    drawer.innerHTML = `<div class="de-vdrawer-head"><b>${esc(title)}</b><button type="button" data-a="close-drawer">Close</button></div><div class="de-vdrawer-body"></div>`;
    drawer.hidden = false;
    closeChooser = mount(drawer.querySelector<HTMLElement>(".de-vdrawer-body")!, closePicture);
  }
  function openPicture(value: string | undefined, title: string, onPick: (url: string) => void) {
    if (!o.choosePicture) return;
    closePicture();
    drawer.innerHTML = `<div class="de-vdrawer-head"><b>${esc(title)}</b><button type="button" data-a="close-drawer">Close</button></div><div class="de-vdrawer-body"></div>`;
    drawer.hidden = false;
    closeChooser = o.choosePicture(drawer.querySelector<HTMLElement>(".de-vdrawer-body")!, {
      value,
      onPick(url) {
        if (!url) return;
        if (isPrivatePicture(url)) { drawTop("That picture is private, so visitors could not see it. Choose a public one."); return; }
        onPick(url);
        closePicture();
      },
    });
  }

  function zoomMenu(b: HTMLElement) {
    const r = b.getBoundingClientRect();
    const levels = [0.5, 0.75, 1, 1.25, 1.5, 2];
    openMenu({
      x: r.left, y: r.bottom + 6,
      host: o.host,
      items: [...levels.map((z) => ({ id: String(z), label: `${z * 100}%`, hint: Math.abs(o.zoom!.value() - z) < 0.01 ? "✓" : undefined })), { id: "fit", label: "Fit to window", sep: true }],
      onPick(id) { o.zoom!.set(id === "fit" ? "fit" : Number(id)); drawTop(); },
    });
  }

  L.on(top, "click", (ev: MouseEvent) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-a]");
    const a = b?.dataset.a;
    if (!a) return;
    if (a === "undo") o.history.undo();
    else if (a === "redo") o.history.redo();
    else if (a === "save") void save();
    else if (a === "done") {
      if (o.onClose) { o.onClose(); return; }
      if (o.history.dirty() && !confirm("Leave without saving your changes?")) return;
      o.history.markSaved();
      o.onDone();
    } else if (a === "panel") { o.panel?.toggle(); drawTop(); }
    else if (a === "present") { o.present?.toggle(); drawTop(); }
    else if (a === "zoom") zoomMenu(b!);
    else if (a === "page") {
      if (!o.pageMenu) return;
      const r = b!.getBoundingClientRect();
      openMenu({ x: r.left, y: r.bottom + 6, host: o.host, items: o.pageMenu(), onPick: (id) => o.onPageMenu?.(id) });
    } else o.onTool?.(a);
  });
  L.on(drawer, "click", (ev: MouseEvent) => {
    if ((ev.target as HTMLElement).closest<HTMLElement>("[data-a=close-drawer]")) closePicture();
  });
  L.on(document, "keydown", (ev: KeyboardEvent) => {
    if (paused) return;
    if (ev.key === "Escape" && o.present?.on()) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      o.present.toggle();
      drawTop();
      return;
    }
    if (ev.key !== "Escape" || drawer.hidden) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    closePicture();
  }, true);
  L.on(document, "keydown", (ev: KeyboardEvent) => {
    if (paused || !(ev.ctrlKey || ev.metaKey) || (ev.target as Element).closest?.("input, textarea, [contenteditable='true']")) return;
    if (ev.key.toLowerCase() === "z") { ev.preventDefault(); if (ev.shiftKey) o.history.redo(); else o.history.undo(); }
  }, true);
  L.on(window, "beforeunload", (ev: BeforeUnloadEvent) => { if (o.history.dirty()) ev.preventDefault(); });

  return {
    drawTop,
    openPicture,
    closePicture,
    openDrawer,
    pause(on) { paused = on; },
    dispose() { closePicture(); L.dispose(); top.remove(); drawer.remove(); },
  };
}

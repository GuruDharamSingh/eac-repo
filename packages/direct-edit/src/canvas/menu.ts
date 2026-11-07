// ============================================================================
// The right-click menu. Same behaviour as page-builder's canvas-menu: kept on
// screen, the keyboard goes into it (arrows, Enter, Escape), it closes on a
// press elsewhere, on scroll and when the window loses focus. Items are data
// so a host decides what a block or a part offers. A row with `kids` opens in
// place (click, or Right arrow; Left closes it): nothing flies out past the
// screen edge, which matters on a phone and beside the panel.
// ============================================================================

export interface MenuItem {
  id: string;
  label: string;
  /** The shortcut shown at the right. */
  hint?: string;
  disabled?: boolean;
  danger?: boolean;
  /** A rule before this item. */
  sep?: boolean;
  /** Opens in place instead of being picked. */
  kids?: MenuItem[];
}

export interface MenuHandle { el: HTMLElement; close(): void }

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const CHEV = '<svg class="de-menu-chev" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 4l4 4-4 4"/></svg>';

function itemHtml(it: MenuItem): string {
  const rule = it.sep ? '<hr role="separator">' : "";
  if (it.kids) {
    return `${rule}<button type="button" role="menuitem" aria-haspopup="true" aria-expanded="false" data-open="${esc(it.id)}"${it.disabled ? " disabled" : ""}><span>${esc(it.label)}</span>${CHEV}</button>` +
      `<div class="de-menu-sub" role="group" aria-label="${esc(it.label)}" data-sub="${esc(it.id)}" hidden>${it.kids.map(itemHtml).join("")}</div>`;
  }
  return `${rule}<button type="button" role="menuitem" data-mi="${esc(it.id)}"${it.disabled ? " disabled" : ""}${it.danger ? ' class="danger"' : ""}><span>${esc(it.label)}</span>${it.hint ? `<kbd>${esc(it.hint)}</kbd>` : ""}</button>`;
}

export function openMenu(o: { x: number; y: number; title?: string; items: MenuItem[]; host?: HTMLElement; onPick(id: string): void; onClose?(): void; /** Pointer or focus is on an item (null: on none). */ onActive?(id: string | null): void; /** A scroll here does not move what the menu points at, so it stays open. Absent: any scroll outside the menu closes it. */ keepOnScroll?(target: Node): boolean }): MenuHandle {
  const host = o.host ?? document.body;
  const el = document.createElement("div");
  el.className = "de-menu";
  el.setAttribute("role", "menu");
  el.dataset.deMenu = "";
  el.innerHTML = (o.title ? `<p class="de-menu-title">${esc(o.title)}</p>` : "") + o.items.map(itemHtml).join("");
  host.appendChild(el);
  // On screen, then focus. Again whenever a row opens: the menu just grew.
  const keepOnScreen = () => {
    const r = el.getBoundingClientRect();
    el.style.left = Math.max(4, Math.min(o.x, window.innerWidth - r.width - 4)) + "px";
    el.style.top = Math.max(4, Math.min(o.y, window.innerHeight - r.height - 4)) + "px";
  };
  keepOnScreen();
  const setOpen = (row: HTMLButtonElement, open: boolean) => {
    row.setAttribute("aria-expanded", String(open));
    const sub = el.querySelector<HTMLElement>(`[data-sub="${CSS.escape(row.dataset.open!)}"]`);
    if (sub) sub.hidden = !open;
    keepOnScreen();
  };
  el.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();

  let closed = false;
  const offs: Array<() => void> = [];
  const on = (t: EventTarget, type: string, fn: (e: any) => void, cap = false) => { t.addEventListener(type, fn, cap); offs.push(() => t.removeEventListener(type, fn, cap)); };
  const close = () => {
    if (closed) return;
    closed = true;
    offs.forEach((f) => f());
    el.remove();
    o.onClose?.();
  };
  on(document, "pointerdown", (e: Event) => { if (!(e.target instanceof Node && el.contains(e.target))) close(); }, true);
  // The page moving would leave the menu behind; the menu's own list scrolling must not close it.
  on(document, "scroll", (e: Event) => { if (!(e.target instanceof Node && (el.contains(e.target) || o.keepOnScroll?.(e.target)))) close(); }, true);
  on(window, "blur", close);
  on(el, "contextmenu", (e: Event) => e.preventDefault());
  on(el, "click", (e: MouseEvent) => {
    const row = (e.target as HTMLElement).closest("button[data-open]") as HTMLButtonElement | null;
    if (row && !row.disabled) { setOpen(row, row.getAttribute("aria-expanded") !== "true"); return; }
    const b = (e.target as HTMLElement).closest("button[data-mi]") as HTMLButtonElement | null;
    if (!b || b.disabled) return;
    const id = b.dataset.mi!;
    close();
    o.onPick(id);
  });
  on(document, "keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
    const active = document.activeElement as HTMLButtonElement | null;
    if (e.key === "ArrowRight" && active?.dataset.open) {
      e.preventDefault();
      setOpen(active, true);
      el.querySelector<HTMLElement>(`[data-sub="${CSS.escape(active.dataset.open)}"] button:not(:disabled)`)?.focus();
      return;
    }
    if (e.key === "ArrowLeft") {
      const sub = active?.closest<HTMLElement>("[data-sub]");
      const row = sub ? el.querySelector<HTMLButtonElement>(`[data-open="${CSS.escape(sub.dataset.sub!)}"]`) : active?.dataset.open ? active : null;
      if (row) { e.preventDefault(); setOpen(row, false); row.focus(); }
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...el.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")].filter((b) => !b.closest("[hidden]"));
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
  }, true);
  if (o.onActive) {
    const report = (e: Event) => o.onActive!((e.target as HTMLElement).closest<HTMLElement>("button[data-mi]")?.dataset.mi ?? null);
    on(el, "mouseover", report);
    on(el, "focusin", report);
  }
  return { el, close };
}

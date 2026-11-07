// ============================================================================
// The floating bar over a selection, built to the canvas's (developer's
// screenshots, 2026-11-02): a thin white pill centred just above the box.
//
//   text:  [Tt Heading 2 v] [swatch] B I U link | list align | comment ...
//   box:   [swatch] | comment ...
//   other: comment ...
//
// The style chip opens Theme (the page's type scale, each row in its own face,
// searchable) and Custom (font, weight, size, line height, letter spacing). The
// swatch opens Theme and Custom too. Which buttons are live follows the host: a
// control it does not offer is disabled.
//
// The bar never takes focus from the text being edited: presses on it are
// cancelled (mousedown), so the selection and the caret survive; only its own
// fields take focus, and the host's `keepFocus` lets that through.
// ============================================================================

import { icon } from "../panel/icons";

/** null = not available for this part (shown disabled). */
export type Tri = boolean | null;
export interface MiniBarStyle { id: string; label: string; group?: string; size?: number; family?: string; weight?: number }
export interface MiniBarContext {
  /** Identity of the selection: menus close when it changes. */
  key?: string;
  /** What the bar is over. Default text. */
  mode?: "text" | "box" | "plain";
  styles?: MiniBarStyle[];
  /** The preset the part matches ("" = Custom). */
  styleId?: string;
  /** The Custom tab of the style menu. Absent: a plain list of styles. */
  custom?: { fonts: Array<{ label: string; names: string[] }>; font?: string; weight?: number; size?: number; leading?: number; tracking?: number };
  color?: { value: string; swatches: string[] } | null;
  bold: Tri; italic: Tri; underline: Tri; link: Tri; list: Tri;
  align?: { value: string; options: string[] } | null;
  /** Whether B / I / U act on a typed selection (editing) or on the whole part. */
  editing: boolean;
  /** The link under the caret, to prefill the link field. */
  href?: string;
  /** A note left on this box. Absent with no comment handler. */
  comment?: string;
}
export interface MiniBarHandlers {
  style(id: string): void;
  /** A Custom tab field changed. */
  custom?(key: "font" | "weight" | "size" | "leading" | "tracking", value: string | number): void;
  color(hex: string): void;
  format(f: "b" | "i" | "u" | "list"): void;
  /** Apply a link (a string) or remove it (null). */
  link(href: string | null): void;
  align(v: string): void;
  more(x: number, y: number): void;
  /** Keep a note on this box (a string) or remove it (null). */
  comment?(text: string | null): void;
  /** The link field took focus (true) or gave it back (false). */
  linkField?(open: boolean): void;
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const ALIGN_ICON: Record<string, string> = { left: "ta-left", center: "ta-center", right: "ta-right", justify: "ta-justify" };
const WEIGHTS: Array<[number, string]> = [[100, "Thin"], [200, "Extra light"], [300, "Light"], [400, "Regular"], [500, "Medium"], [600, "Semibold"], [700, "Bold"], [800, "Extra bold"], [900, "Black"]];
const FIELD = "input, select, textarea";

type Pop = "style" | "color" | "comment" | null;

export class MiniBar {
  readonly el: HTMLElement;
  /** Space kept free at the top of the window, for a host's own toolbars. */
  topInset = 4;
  private ctx: MiniBarContext | null = null;
  private anchor: DOMRect | null = null;
  private pop: Pop = null;
  private tab: "theme" | "custom" = "theme";
  private q = "";
  private linkMode = false;
  /** What is in the bar now. */
  private drawn = "";
  private offs: Array<() => void> = [];

  constructor(host: HTMLElement, private h: MiniBarHandlers) {
    this.el = document.createElement("div");
    this.el.className = "de-mb";
    this.el.setAttribute("role", "toolbar");
    this.el.setAttribute("aria-label", "Selection");
    this.el.hidden = true;
    host.appendChild(this.el);
    const on = (t: EventTarget, type: string, fn: (e: any) => void, cap = false) => { t.addEventListener(type, fn, cap); this.offs.push(() => t.removeEventListener(type, fn, cap)); };
    // Keep the text's focus and selection: only the bar's own fields may take focus.
    on(this.el, "mousedown", (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(FIELD)) e.preventDefault(); });
    on(this.el, "click", (e: MouseEvent) => this.onClick(e));
    on(this.el, "keydown", (e: KeyboardEvent) => this.onKey(e));
    on(this.el, "input", (e: Event) => this.onInput(e));
    on(this.el, "change", (e: Event) => this.onChange(e));
    on(document, "pointerdown", (e: PointerEvent) => {
      if (this.pop && !this.el.contains(e.target as Node)) { this.pop = null; if (this.ctx && !this.el.hidden) { this.draw(); this.place(); } }
    }, true);
  }

  destroy(): void { this.offs.forEach((f) => f()); this.el.remove(); }
  get visible(): boolean { return !this.el.hidden; }
  contains(n: Node | null): boolean { return !!n && this.el.contains(n); }
  get linkFieldOpen(): boolean { return this.linkMode; }

  /** Show over `anchor` (viewport coordinates), or hide with a null context. */
  update(ctx: MiniBarContext | null, anchor: DOMRect | null): void {
    if (!ctx || !anchor) { this.hide(); return; }
    if (this.ctx?.key !== ctx.key) { this.pop = null; this.q = ""; }
    this.ctx = ctx; this.anchor = anchor;
    // Someone is typing in one of the bar's fields: it stays as it is and only follows the box.
    const active = document.activeElement as HTMLElement | null;
    if (this.linkMode || (active && this.el.contains(active) && active.matches(FIELD))) {
      // The chip still says what the typing has made of the style.
      const name = this.el.querySelector(".de-mb-stylename");
      const cur = ctx.styles?.find((s) => s.id === ctx.styleId);
      if (name) name.textContent = cur ? cur.label.split(" · ")[0]! : "Custom";
      this.place();
      return;
    }
    this.draw();
    this.el.hidden = false;
    this.place();
  }
  hide(): void {
    if (this.el.hidden && !this.linkMode) return;
    this.el.hidden = true; this.pop = null;
    if (this.linkMode) { this.linkMode = false; this.h.linkField?.(false); }
  }

  private btn(id: string, inner: string, state: Tri, title: string, extra = ""): string {
    return `<button type="button" data-mb="${id}" title="${esc(title)}" aria-label="${esc(title)}" aria-pressed="${state === true}" ${state === null ? "disabled" : ""} ${extra}>${inner}</button>`;
  }

  private swatch(c: MiniBarContext): string {
    return c.color
      ? `<button type="button" class="de-mb-swatch" data-mb="color" aria-haspopup="dialog" aria-expanded="${this.pop === "color"}" title="Colour" aria-label="Colour"><span class="de-sw" style="--sw:${esc(c.color.value)}"></span></button>`
      : `<button type="button" class="de-mb-swatch" data-mb="color" disabled title="Colour (not offered here)" aria-label="Colour"><span class="de-sw none"></span></button>`;
  }

  private tail(c: MiniBarContext): string {
    const note = this.h.comment ? `<button type="button" data-mb="comment" aria-haspopup="dialog" aria-expanded="${this.pop === "comment"}" aria-pressed="${!!c.comment}" title="Comment" aria-label="Comment">${icon("comment")}</button>` : "";
    return note + `<button type="button" data-mb="more" title="More" aria-label="More" aria-haspopup="menu">${icon("more")}</button>`;
  }

  private draw(): void {
    const c = this.ctx!;
    const sep = '<span class="de-mb-sep"></span>';
    const mode = c.mode ?? "text";
    let h = "";
    if (mode === "text") {
      const cur = c.styles?.find((s) => s.id === c.styleId);
      h += c.styles?.length ? `<button type="button" class="de-mb-style" data-mb="style" aria-haspopup="dialog" aria-expanded="${this.pop === "style"}" title="Text style"><span class="de-mb-tt">${icon("tt")}</span><span class="de-mb-stylename">${esc(cur ? cur.label.split(" · ")[0] : "Custom")}</span>${icon("down")}</button>` : "";
      h += this.swatch(c);
      h += this.btn("b", "<b>B</b>", c.bold, c.editing ? "Bold (Ctrl+B)" : "Bold: the whole part");
      h += this.btn("i", '<i class="de-mb-i">I</i>', c.italic, c.editing ? "Italic (Ctrl+I)" : "Italic: the whole part");
      h += this.btn("u", "<u>U</u>", c.underline, c.editing ? "Underline (Ctrl+U)" : "Underline: the whole part");
      h += this.btn("link", icon("link"), c.link, "Link");
      h += sep;
      h += this.btn("list", icon("list"), c.list, "Bulleted list");
      if (c.align) {
        const nx = c.align.options[(c.align.options.indexOf(c.align.value) + 1) % c.align.options.length]!;
        h += `<button type="button" data-mb="align" data-next="${esc(nx)}" title="Align: ${esc(c.align.value)} (click for ${esc(nx)})" aria-label="Align">${icon(ALIGN_ICON[c.align.value] ?? "ta-left")}</button>`;
      } else h += '<button type="button" disabled title="Align (not offered)" aria-label="Align">' + icon("ta-left") + "</button>";
      h += sep;
    } else if (mode === "box") {
      h += this.swatch(c) + sep;
    }
    h += this.tail(c);
    if (this.pop === "style" && c.styles) h += this.stylePop(c);
    if (this.pop === "color" && c.color) h += this.colorPop(c);
    if (this.pop === "comment") h += this.commentPop(c);
    // Only when something changed: replacing a button between press and release loses the click.
    if (h !== this.drawn) { this.el.innerHTML = h; this.drawn = h; }
  }

  private tabs(): string {
    return `<div class="de-mb-tabs" role="tablist"><button type="button" role="tab" data-mb-tab="theme" aria-selected="${this.tab === "theme"}">Theme</button><button type="button" role="tab" data-mb-tab="custom" aria-selected="${this.tab === "custom"}">Custom</button></div>`;
  }

  private stylePop(c: MiniBarContext): string {
    if (!c.custom) {
      const groups = new Map<string, MiniBarStyle[]>();
      for (const s of c.styles!) groups.set(s.group ?? "Styles", [...(groups.get(s.group ?? "Styles") ?? []), s]);
      return `<div class="de-mb-pop de-mb-stylepop" role="listbox" aria-label="Text style"><div class="de-mb-list">` + [...groups].map(([g, ss]) => `<p>${esc(g)}</p>` + ss.map((s) => this.styleRow(s, c)).join("")).join("") + "</div></div>";
    }
    let h = `<div class="de-mb-pop de-mb-stylepop" role="dialog" aria-label="Text style">` + this.tabs();
    if (this.tab === "theme") {
      h += `<div class="de-mb-search">${icon("search")}<input type="search" data-mb-q placeholder="Search styles" aria-label="Search styles" value="${esc(this.q)}"></div>`;
      h += `<div class="de-mb-list" role="listbox">` + c.styles!.filter((s) => s.label.toLowerCase().includes(this.q.toLowerCase())).map((s) => this.styleRow(s, c)).join("") + "</div>";
    } else {
      const u = c.custom;
      const inList = u.fonts.some((g) => g.names.includes(u.font ?? ""));
      h += `<div class="de-mb-custom"><select data-mb-c="font" aria-label="Font">${inList ? "" : `<option value="" selected>${esc(u.font || "Page font")}</option>`}` +
        u.fonts.map((g) => `<optgroup label="${esc(g.label)}">${g.names.map((n) => `<option value="${esc(n)}" ${n === u.font ? "selected" : ""}>${esc(n)}</option>`).join("")}</optgroup>`).join("") + "</select>" +
        `<div class="de-mb-pair"><select data-mb-c="weight" aria-label="Weight">${WEIGHTS.map(([w, n]) => `<option value="${w}" ${w === u.weight ? "selected" : ""}>${n}</option>`).join("")}</select>` +
        `<label class="de-mb-num"><input type="text" inputmode="decimal" data-mb-c="size" aria-label="Size" value="${esc(u.size ?? "")}"><span>px</span></label></div>` +
        `<div class="de-mb-pair"><label class="de-mb-num"><span class="de-mb-ico" title="Line height">${icon("line-height")}</span><input type="text" inputmode="decimal" data-mb-c="leading" aria-label="Line height" value="${esc(u.leading ?? "")}"></label>` +
        `<label class="de-mb-num"><span class="de-mb-ico" title="Letter spacing">${icon("tracking")}</span><input type="text" inputmode="decimal" data-mb-c="tracking" aria-label="Letter spacing" value="${esc(u.tracking ?? "")}"></label></div></div>`;
    }
    return h + "</div>";
  }

  private styleRow(s: MiniBarStyle, c: MiniBarContext): string {
    const on = s.id === c.styleId;
    const size = s.size ? Math.max(11, Math.min(15, 10 + s.size / 16)) : 12.5;
    const face = `font-family:${esc(s.family ?? "inherit")};font-size:${size}px;font-weight:${s.weight ?? 400}`;
    return `<button type="button" role="option" data-mb-style="${esc(s.id)}" aria-selected="${on}" data-mb-row="${esc(s.label)}"><span class="de-mb-face" style="${face}">${esc(s.label)}</span>${s.size ? `<small>${esc(s.size)}px</small>` : ""}${on ? `<span class="de-mb-check">${icon("check")}</span>` : ""}</button>`;
  }

  private colorPop(c: MiniBarContext): string {
    const v = c.color!;
    let h = `<div class="de-mb-pop de-mb-colorpop" role="dialog" aria-label="Colour">` + this.tabs();
    if (this.tab === "theme") {
      h += `<div class="de-mb-colors" role="listbox">` + v.swatches.map((s) => `<button type="button" role="option" data-mb-color="${esc(s)}" aria-selected="${s.toLowerCase() === v.value.toLowerCase()}" title="${esc(s)}" aria-label="${esc(s)}"><span class="de-sw" style="--sw:${esc(s)}"></span></button>`).join("") + "</div>";
    } else {
      h += `<div class="de-mb-custom"><div class="de-mb-pair"><input type="color" data-mb-pick value="${esc(v.value)}" aria-label="Pick a colour"><input type="text" data-mb-hex value="${esc(v.value.toUpperCase())}" aria-label="Colour value" spellcheck="false"></div></div>`;
    }
    return h + "</div>";
  }

  private commentPop(c: MiniBarContext): string {
    return `<div class="de-mb-pop de-mb-commentpop" role="dialog" aria-label="Comment"><textarea data-mb-note rows="3" placeholder="Leave a note about this box. Visitors do not see it." aria-label="Comment">${esc(c.comment ?? "")}</textarea><div class="de-mb-actions">${c.comment ? '<button type="button" data-mb="note-remove">Remove</button>' : ""}<button type="button" class="primary" data-mb="note-save">Save</button></div></div>`;
  }

  private drawLink(): void {
    const c = this.ctx!;
    this.el.innerHTML = `<input type="text" inputmode="url" class="de-mb-url" placeholder="https://… or #anchor" value="${esc(c.href ?? "")}" aria-label="Link address" spellcheck="false" data-mb-field>` +
      `<button type="button" data-mb="link-apply" title="Apply (Enter)" aria-label="Apply">${icon("check")}</button>` +
      (c.href ? `<button type="button" data-mb="link-remove" title="Remove link" aria-label="Remove link">${icon("unlink")}</button>` : "") +
      `<button type="button" data-mb="link-cancel" title="Cancel (Esc)" aria-label="Cancel">${icon("close")}</button>`;
    this.drawn = "";
  }

  /** Centred just above the anchor when there is room, else below it; kept inside the window. Menus open away from the box. */
  private place(): void {
    const a = this.anchor!;
    this.el.style.visibility = "hidden";
    const r = this.el.getBoundingClientRect();
    const gap = 5;
    const above = a.top - r.height - gap >= this.topInset;
    const top = above ? a.top - r.height - gap : Math.min(a.bottom + gap, window.innerHeight - r.height - 4);
    const left = Math.max(4, Math.min(a.left + a.width / 2 - r.width / 2, window.innerWidth - r.width - 4));
    this.el.dataset.side = above ? "above" : "below";
    this.el.style.left = left + "px";
    this.el.style.top = Math.max(this.topInset, top) + "px";
    const pop = this.el.querySelector<HTMLElement>(".de-mb-pop");
    if (pop) {
      const ph = pop.getBoundingClientRect().height;
      this.el.dataset.pop = Math.max(this.topInset, top) - ph - 6 >= 4 ? "up" : "down";
    }
    this.el.style.visibility = "";
  }

  private redraw() { this.draw(); this.place(); }

  private onClick(e: MouseEvent) {
    const t = e.target as HTMLElement;
    const b = t.closest("button") as HTMLButtonElement | null;
    if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.mbStyle !== undefined) { this.pop = null; this.h.style(d.mbStyle); return; }
    if (d.mbColor !== undefined) { this.pop = null; this.h.color(d.mbColor); return; }
    if (d.mbTab) { this.tab = d.mbTab as "theme" | "custom"; this.redraw(); return; }
    switch (d.mb) {
      case "style": case "color": case "comment": {
        const next = d.mb as Pop;
        this.pop = this.pop === next ? null : next;
        this.tab = "theme";
        this.q = "";
        this.redraw();
        if (this.pop === "comment") this.el.querySelector<HTMLTextAreaElement>("[data-mb-note]")?.focus();
        break;
      }
      case "b": case "i": case "u": case "list": this.pop = null; this.h.format(d.mb); break;
      case "align": this.pop = null; this.h.align(d.next!); break;
      case "more": { const r = b.getBoundingClientRect(); this.pop = null; this.h.more(r.left, r.bottom + 4); break; }
      case "link": this.pop = null; this.linkMode = true; this.h.linkField?.(true); this.drawLink(); this.place(); this.el.querySelector<HTMLInputElement>(".de-mb-url")?.focus(); break;
      case "link-apply": this.applyLink(); break;
      case "link-remove": this.endLink(); this.h.link(null); break;
      case "link-cancel": this.endLink(); break;
      case "note-save": {
        const v = this.el.querySelector<HTMLTextAreaElement>("[data-mb-note]")?.value.trim() ?? "";
        this.pop = null;
        (document.activeElement as HTMLElement | null)?.blur();
        this.h.comment?.(v || null);
        break;
      }
      case "note-remove": this.pop = null; (document.activeElement as HTMLElement | null)?.blur(); this.h.comment?.(null); break;
    }
  }

  private onInput(e: Event) {
    const t = e.target as HTMLInputElement;
    const d = t.dataset;
    if (d.mbQ !== undefined) {
      this.q = t.value;
      const needle = t.value.toLowerCase();
      this.el.querySelectorAll<HTMLElement>("[data-mb-row]").forEach((row) => { row.hidden = !row.dataset.mbRow!.toLowerCase().includes(needle); });
      return;
    }
    if (d.mbPick !== undefined) { this.h.color(t.value); return; }
    if (d.mbHex !== undefined) { if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(t.value.trim())) this.h.color(t.value.trim().toLowerCase()); return; }
    if (d.mbC && t.tagName !== "SELECT") {
      const n = parseFloat(t.value);
      if (Number.isFinite(n)) this.h.custom?.(d.mbC as "size", n);
    }
  }

  private onChange(e: Event) {
    const t = e.target as HTMLSelectElement;
    if (t.tagName !== "SELECT" || !t.dataset.mbC) return;
    const key = t.dataset.mbC as "font" | "weight";
    if (t.value) this.h.custom?.(key, key === "weight" ? Number(t.value) : t.value);
    t.blur();
  }

  private applyLink() {
    const v = (this.el.querySelector(".de-mb-url") as HTMLInputElement | null)?.value.trim() ?? "";
    this.endLink();
    if (v) this.h.link(/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(v) ? v : "https://" + v);
  }
  private endLink() { this.linkMode = false; this.h.linkField?.(false); if (this.ctx) { this.draw(); this.place(); } }

  private onKey(e: KeyboardEvent) {
    if (!this.linkMode) {
      if (e.key === "Escape" && this.pop) { e.stopPropagation(); e.preventDefault(); this.pop = null; (document.activeElement as HTMLElement | null)?.blur(); this.draw(); this.place(); }
      return;
    }
    if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); this.applyLink(); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); this.endLink(); }
  }
}

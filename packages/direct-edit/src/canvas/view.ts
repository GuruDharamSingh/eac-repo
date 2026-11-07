// ============================================================================
// The viewport: zoom, fit, phone-width preview and hand (pan) over a scrolling
// canvas. The page is scaled with a transform inside a wrapper that is NOT
// scaled and is sized to the scaled page, so the canvas scrolls naturally and
// the selection overlay (a sibling of the page in that wrapper) measures in
// screen pixels. Zoom is clamped to 25%..300%.
// ============================================================================

export interface ViewportOptions {
  /** The page's width at 100% on a desktop screen (it never exceeds the canvas). */
  desktopWidth: number;
  /** The page's width in the phone preview. */
  phoneWidth: number;
  /** Space kept around the page inside the canvas, per side. */
  gutter?: number;
  /** Zoom, phone preview or size changed: redraw the overlay. */
  onChange(): void;
}

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 3;
export const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 2, 3];

export class Viewport {
  zoom = 1;
  phone = false;
  private ro: ResizeObserver | null = null;

  constructor(private canvas: HTMLElement, private wrap: HTMLElement, private page: HTMLElement, private o: ViewportOptions) {
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => this.apply());
      this.ro.observe(page);
      this.ro.observe(canvas);
    }
  }
  destroy(): void { this.ro?.disconnect(); }

  /** The page's layout width in unscaled px (what its grid is laid out in). */
  baseWidth(): number {
    return this.phone ? this.o.phoneWidth : this.o.desktopWidth;
  }

  /** Lay the page out at the current zoom (idempotent). */
  apply(): void {
    const w = this.baseWidth();
    this.page.style.width = w + "px";
    this.page.style.transformOrigin = "0 0";
    this.page.style.transform = this.zoom === 1 ? "" : `scale(${this.zoom})`;
    this.wrap.style.width = w * this.zoom + "px";
    this.wrap.style.height = this.page.offsetHeight * this.zoom + "px";
    this.wrap.dataset.zoom = String(Math.round(this.zoom * 100));
    this.o.onChange();
  }

  setZoom(z: number): void {
    this.zoom = Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)) * 100) / 100;
    this.apply();
  }
  /** The next preset step in or out. */
  step(dir: 1 | -1): void {
    const cur = this.zoom;
    const next = dir > 0 ? ZOOM_STEPS.find((s) => s > cur + 0.005) : [...ZOOM_STEPS].reverse().find((s) => s < cur - 0.005);
    this.setZoom(next ?? cur);
  }
  /** Fit the page's width into the canvas (never above 100%). */
  fit(): void {
    const avail = this.canvas.clientWidth - 2 * (this.o.gutter ?? 24);
    const w = this.phone ? this.o.phoneWidth : this.o.desktopWidth;
    this.setZoom(Math.min(1, avail / w));
  }
  setPhone(on: boolean): void {
    this.phone = on;
    this.apply();
  }

  /** Hand tool: drag the canvas to scroll it. Returns a function that stops it. */
  startPan(ev: PointerEvent): void {
    const x0 = ev.clientX, y0 = ev.clientY, sl = this.canvas.scrollLeft, st = this.canvas.scrollTop;
    document.body.classList.add("de-panning");
    const move = (e: PointerEvent) => { this.canvas.scrollLeft = sl - (e.clientX - x0); this.canvas.scrollTop = st - (e.clientY - y0); };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", () => { document.removeEventListener("pointermove", move); document.body.classList.remove("de-panning"); }, { once: true });
  }
}

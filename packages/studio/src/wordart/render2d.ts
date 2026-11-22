// 2D word art onto a canvas: background, then the fill gradient cut to the mark, with a soft shadow.
// Used for PNG export, list thumbnails and (record mode, 2026-11-18) every recorded frame:
// `composite2D` takes its layers as sources, so export passes painted gradients and the recorder
// passes the live shader canvases. Shaders export as their painted (CSS-equivalent) gradient.
import { paintGradient } from "@elkdonis/gradients";
import type { Mark } from "./mark";
import type { WordArtDoc } from "./doc";

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((ok, fail) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => fail(new Error("image"));
    i.src = src;
  });

/** Where the mark sits in a W x H frame (CSS px or canvas px alike): `size`% of the frame, fitted in both directions. */
export function layout(doc: Pick<WordArtDoc, "size">, mark: Mark, W: number, H: number) {
  const [, , bw, bh] = mark.box;
  // fit within both dimensions, so a wide two-line wordmark fills a 16:9 frame instead of shrinking to its height
  const s = (doc.size / 100) * Math.min(W / bw, H / bh);
  const w = bw * s, h = bh * s;
  return { s, w, h, x: (W - w) / 2, y: (H - h) / 2 };
}

const fillBox = (L: ReturnType<typeof layout>) => [Math.max(1, Math.ceil(L.w)), Math.max(1, Math.ceil(L.h))] as const;

/**
 * The mark as an alpha mask at the fill's size (build once per mark and size; it's reused per frame).
 * The mask is drawn whole (every path, each with its own fill rule), so it cuts the fill once:
 * cutting path by path with destination-in would keep only where all paths overlap.
 */
export async function markMask(mark: Mark, L: ReturnType<typeof layout>): Promise<HTMLCanvasElement> {
  const [fw, fh] = fillBox(L);
  const m = document.createElement("canvas");
  m.width = fw;
  m.height = fh;
  const mx = m.getContext("2d")!;
  const [bx, by] = mark.box;
  if (mark.image) {
    mx.drawImage(await loadImage(mark.image.src), 0, 0, fw, fh);
  } else {
    mx.setTransform(L.s, 0, 0, L.s, -bx * L.s, -by * L.s);
    for (const p of mark.paths) mx.fill(new Path2D(p.d), p.rule);
  }
  return m;
}

/** Scratch canvases a caller can keep between frames (the recorder), so nothing is allocated per frame. */
export interface CompositeScratch { fill?: HTMLCanvasElement }

/**
 * The 2D layering, synchronous: background (W×H source, or none for transparent), the fill source
 * cut to `mask`, the shadow. Sources are drawn scaled to their boxes.
 */
export function composite2D(
  ctx: CanvasRenderingContext2D,
  doc: WordArtDoc,
  mark: Mark,
  W: number,
  H: number,
  src: { background: CanvasImageSource | null; fill: CanvasImageSource; mask: HTMLCanvasElement },
  scratch: CompositeScratch = {},
): void {
  if (src.background) ctx.drawImage(src.background, 0, 0, W, H);
  const L = layout(doc, mark, W, H);
  const [fw, fh] = fillBox(L);
  const f = scratch.fill ?? (scratch.fill = document.createElement("canvas"));
  if (f.width !== fw || f.height !== fh) { f.width = fw; f.height = fh; }
  const fx = f.getContext("2d")!;
  fx.globalCompositeOperation = "source-over";
  fx.clearRect(0, 0, fw, fh);
  fx.drawImage(src.fill, 0, 0, fw, fh);
  fx.globalCompositeOperation = "destination-in";
  fx.drawImage(src.mask, 0, 0, fw, fh);
  fx.globalCompositeOperation = "source-over";

  ctx.save();
  if (doc.shadow > 0) {
    const a = doc.shadow / 100;
    ctx.shadowColor = `rgba(0,0,0,${0.25 + a * 0.5})`;
    ctx.shadowBlur = (8 + a * 40) * (Math.min(W, H) / 1080);
    ctx.shadowOffsetY = (2 + a * 14) * (Math.min(W, H) / 1080);
  }
  ctx.drawImage(f, L.x, L.y);
  ctx.restore();
}

/** A gradient painted onto its own canvas (export's layer source). */
export function paintedSource(spec: unknown, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  paintGradient(c.getContext("2d")!, spec, c.width, c.height);
  return c;
}

export async function renderCanvas2D(doc: WordArtDoc, mark: Mark, W: number, H: number): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const L = layout(doc, mark, W, H);
  const [fw, fh] = fillBox(L);
  composite2D(ctx, doc, mark, W, H, {
    background: doc.background ? paintedSource(doc.background, W, H) : null,
    fill: paintedSource(doc.fill, fw, fh),
    mask: await markMask(mark, L),
  });
  return c;
}

export async function renderPng2D(doc: WordArtDoc, mark: Mark, W: number, H: number): Promise<Blob> {
  const c = await renderCanvas2D(doc, mark, W, H);
  return new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("PNG"))), "image/png"));
}

export async function thumb2D(doc: WordArtDoc, mark: Mark): Promise<string> {
  const c = await renderCanvas2D(doc, mark, 160, 160);
  return c.toDataURL("image/png");
}

export function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

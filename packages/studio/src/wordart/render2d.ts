// 2D word art onto a canvas: background, then the fill gradient cut to the mark, with a soft shadow.
// Used for PNG export and list thumbnails. Shaders export as their painted (CSS-equivalent) gradient.
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

export async function renderCanvas2D(doc: WordArtDoc, mark: Mark, W: number, H: number): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  if (doc.background) paintGradient(ctx, doc.background, W, H);

  const L = layout(doc, mark, W, H);
  const fw = Math.max(1, Math.ceil(L.w)), fh = Math.max(1, Math.ceil(L.h));
  const f = document.createElement("canvas");
  f.width = fw;
  f.height = fh;
  const fx = f.getContext("2d")!;
  paintGradient(fx, doc.fill, fw, fh);
  // The mask is drawn whole first (every path, each with its own fill rule), then cuts the fill
  // once: cutting path by path with destination-in would keep only where all paths overlap.
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
  fx.globalCompositeOperation = "destination-in";
  fx.drawImage(m, 0, 0);

  if (doc.shadow > 0) {
    const a = doc.shadow / 100;
    ctx.shadowColor = `rgba(0,0,0,${0.25 + a * 0.5})`;
    ctx.shadowBlur = (8 + a * 40) * (Math.min(W, H) / 1080);
    ctx.shadowOffsetY = (2 + a * 14) * (Math.min(W, H) / 1080);
  }
  ctx.drawImage(f, L.x, L.y);
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

// ============================================================================
// The rendered loop (record mode shot 2, 2026-11-18): frame by frame, frame n
// shows moment n/30 s exactly, so it is smooth on any machine (a slow frame
// only makes the render take longer). Reuses the take's compositor; encodes
// with WebCodecs through mediabunny 1.65.1 (MPL-2.0): MP4/H.264 where the
// browser can, else WebM (VP9, then VP8).
//
// Seamless loop: the moments just after the end (0.5 s) are rendered first
// and cross-faded into the opening frames, so the last frame runs on into the
// first.
// ============================================================================

import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, QUALITY_LOW, WebMOutputFormat, canEncodeVideo } from "mediabunny";
import { createCompositor, type TakeResult } from "./capture";
import type { Playback } from "./playback";

export const RENDER_FPS = 30;
const LOOP_FRAMES = 15;
const READY_TIMEOUT = 10_000;

/** High = the frame as designed (1080 on the short side); Low = 720 on the short side, a smaller file. */
export type RenderRes = "high" | "low";
export const LOW_SHORT_SIDE = 720;

/** The encoded size for a W×H frame: the frame itself, or scaled so the short side is 720; both even (H.264 needs it). */
export function renderSize(W: number, H: number, res: RenderRes): [number, number] {
  const k = res === "low" ? Math.min(1, LOW_SHORT_SIDE / Math.min(W, H)) : 1;
  const even = (n: number) => Math.max(2, Math.round((n * k) / 2) * 2);
  return [even(W), even(H)];
}

export interface RenderStage {
  drawFrame(ctx: CanvasRenderingContext2D): boolean;
  /** Every shader layer has drawn (Paper loads lazily). */
  ready(): boolean;
}

const raf = () => new Promise<void>((ok) => requestAnimationFrame(() => ok()));

/** The best codec this browser can encode at W×H: H.264 in MP4, else VP9/VP8 in WebM; null when none. */
export async function pickRenderCodec(W: number, H: number): Promise<{ codec: "avc" | "vp9" | "vp8"; mp4: boolean } | null> {
  if (typeof VideoEncoder === "undefined") return null;
  if (await canEncodeVideo("avc", { width: W, height: H }).catch(() => false)) return { codec: "avc", mp4: true };
  if (await canEncodeVideo("vp9", { width: W, height: H }).catch(() => false)) return { codec: "vp9", mp4: false };
  if (await canEncodeVideo("vp8", { width: W, height: H }).catch(() => false)) return { codec: "vp8", mp4: false };
  return null;
}

export async function renderLoop(opts: {
  stage: RenderStage;
  playback: Playback;
  W: number;
  H: number;
  /** Length in ms (frames = round(ms / 1000 × 30)). */
  ms: number;
  loop: boolean;
  /** Output size: high (default) or low (720 on the short side). */
  res?: RenderRes;
  signal?: AbortSignal;
  onProgress?(done: number): void;
  /** How long to wait for lazy shader layers before giving up (default 10 s). */
  readyTimeout?: number;
}): Promise<TakeResult> {
  const { stage, playback, W, H, signal } = opts;
  const res = opts.res ?? "high";
  const [OW, OH] = renderSize(W, H, res);
  const pick = await pickRenderCodec(OW, OH);
  if (!pick) throw new Error("This browser can't render video files here; ● Record still works.");
  const n = Math.max(1, Math.round((opts.ms / 1000) * RENDER_FPS));
  const F = opts.loop ? Math.min(LOOP_FRAMES, Math.floor(n / 2)) : 0;
  const comp = createCompositor({ W, H, draw: (ctx) => stage.drawFrame(ctx) });
  const ctx = comp.canvas.getContext("2d")!;
  // the stage draws at the design's frame size; a low render scales each finished frame down into the encoder's canvas
  const out = OW === W && OH === H ? comp.canvas : Object.assign(document.createElement("canvas"), { width: OW, height: OH });
  const outCtx = out === comp.canvas ? null : out.getContext("2d")!;
  if (outCtx) { outCtx.imageSmoothingEnabled = true; outCtx.imageSmoothingQuality = "high"; }
  const tail: ImageBitmap[] = [];
  let output: Output | null = null;
  const aborted = () => { if (signal?.aborted) throw new DOMException("The render was cancelled.", "AbortError"); };
  // a moment on the stage: set the playhead, then let React commit and every layer draw
  const moment = async (frame: number) => {
    playback.set({ ms: (frame * 1000) / RENDER_FPS });
    await raf();
    await raf();
  };
  playback.set({ take: "rendering", playing: false });
  try {
    await moment(0);
    const t0 = performance.now();
    const limit = opts.readyTimeout ?? READY_TIMEOUT;
    while (!stage.ready() && performance.now() - t0 < limit) { aborted(); await raf(); }
    // never encode frames with a shader layer missing
    if (!stage.ready()) throw new Error("The shaders didn't finish loading in time; try Render again.");
    // the moments just past the end, for the seamless join
    for (let j = 0; j < F; j++) {
      aborted();
      await moment(n + j);
      comp.frame();
      tail.push(await createImageBitmap(comp.canvas));
    }
    // MP4 with its index first (fastStart): what WhatsApp, Instagram and phones play
    output = new Output({ format: pick.mp4 ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(), target: new BufferTarget() });
    const src = new CanvasSource(out, { codec: pick.codec, quality: res === "low" ? QUALITY_LOW : QUALITY_HIGH, keyFrameInterval: 2, latencyMode: "quality" });
    output.addVideoTrack(src, { frameRate: RENDER_FPS });
    await output.start();
    for (let i = 0; i < n; i++) {
      aborted();
      await moment(i);
      comp.frame();
      if (i < F) {
        ctx.save();
        ctx.globalAlpha = 1 - i / F;
        ctx.drawImage(tail[i], 0, 0, W, H);
        ctx.restore();
      }
      if (outCtx) { outCtx.clearRect(0, 0, OW, OH); outCtx.drawImage(comp.canvas, 0, 0, OW, OH); }
      await src.add(i / RENDER_FPS, 1 / RENDER_FPS);
      opts.onProgress?.((i + 1) / n);
    }
    src.close();
    await output.finalize();
    const buffer = (output.target as BufferTarget).buffer;
    if (!buffer) throw new Error("The render produced no file.");
    const mime = pick.mp4 ? "video/mp4" : "video/webm";
    return { blob: new Blob([buffer], { type: mime }), mime, ms: (n * 1000) / RENDER_FPS, fps: RENDER_FPS, reason: "Rendered frame by frame (smooth on any machine)." };
  } catch (e) {
    if (output && output.state !== "finalized" && output.state !== "canceled") await output.cancel().catch(() => {});
    throw e;
  } finally {
    for (const b of tail) b.close();
    comp.dispose();
    if (outCtx) out.width = out.height = 0;
    playback.set({ take: "idle", playing: false });
  }
}

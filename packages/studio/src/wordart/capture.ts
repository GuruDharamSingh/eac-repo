// ============================================================================
// Record mode's capture (2026-11-18): a detached W×H canvas re-drawn every
// frame from the live preview, and (Task 6) the take that encodes it.
//
// layerSource() flattens one GradientBackground element into a canvas the way
// the browser composites it: the painted gradient (the CSS layer), then each
// shader canvas in DOM order (Paper's paper surface multiplied at its
// opacity), then grain. A shader that hasn't drawn yet leaves the painted
// gradient showing, so a fresh preset never flashes blank.
// ============================================================================

import { cleanGradient, paintGradient, paintGrain, type GradientSpec } from "@elkdonis/gradients";
import { pickRecordingMime } from "../capture/upload";

export interface LayerCache { canvas?: HTMLCanvasElement; paintedKey?: string; painted?: HTMLCanvasElement }

export function layerSource(host: Element | null, spec: GradientSpec, w: number, h: number, cache: LayerCache = {}): CanvasImageSource {
  const W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h));
  const g = cleanGradient(spec) ?? spec;
  // the painted (CSS) layer, without grain (grain goes on top, after the shaders); cached per spec and size
  const key = `${W}x${H}:${JSON.stringify({ ...g, grain: 0 })}`;
  if (cache.paintedKey !== key || !cache.painted) {
    const p = cache.painted ?? document.createElement("canvas");
    p.width = W; p.height = H;
    paintGradient(p.getContext("2d")!, { ...g, grain: 0 }, W, H);
    cache.painted = p;
    cache.paintedKey = key;
  }
  const canvases = host ? Array.from(host.querySelectorAll("canvas")) : [];
  if (!canvases.length && !g.grain) return cache.painted;
  const c = cache.canvas ?? (cache.canvas = document.createElement("canvas"));
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  const ctx = c.getContext("2d")!;
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(cache.painted, 0, 0);
  for (const cv of canvases) {
    if (cv.width < 2 || cv.height < 2 || cv.style.display === "none") continue;
    // Paper wraps its canvas in an element carrying the style (blend, opacity); ours is the canvas itself
    const styled = cv.parentElement && cv.parentElement !== host ? cv.parentElement : cv;
    const cs = getComputedStyle(styled);
    ctx.globalCompositeOperation = cs.mixBlendMode === "multiply" ? "multiply" : "source-over";
    ctx.globalAlpha = Number(cs.opacity) || 1;
    ctx.drawImage(cv, 0, 0, W, H);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  if (g.grain > 0) paintGrain(ctx, W, H, g.grain / 100, g.seed);
  return c;
}

/** Whether a layer's shader canvases (shader, paper surface) exist and have drawn a size. */
export function layerReady(host: Element | null, spec: GradientSpec | null | undefined): boolean {
  if (!spec) return true;
  const need = (spec.shader !== "none" ? 1 : 0) + (spec.paper > 0 ? 1 : 0);
  if (!need) return true;
  const sized = host ? Array.from(host.querySelectorAll("canvas")).filter((c) => c.width > 1 && c.height > 1).length : 0;
  return sized >= need;
}

export interface Compositor {
  canvas: HTMLCanvasElement;
  /** Draw one frame now; false when the preview wasn't ready (the canvas keeps its last frame). */
  frame(): boolean;
  dispose(): void;
}

/** `draw` checks the preview is ready, then clears and draws the whole frame (so a not-ready frame keeps the last one). */
export function createCompositor(opts: { W: number; H: number; draw(ctx: CanvasRenderingContext2D): boolean }): Compositor {
  const canvas = document.createElement("canvas");
  canvas.width = opts.W;
  canvas.height = opts.H;
  const ctx = canvas.getContext("2d", { alpha: true })!;
  return {
    canvas,
    frame() {
      ctx.save();
      const ok = opts.draw(ctx);
      ctx.restore();
      return ok;
    },
    dispose() { canvas.width = canvas.height = 0; },
  };
}

// ── a take: the compositor's canvas, encoded live ────────────────────────────

export interface TakeResult { blob: Blob; mime: string; ms: number; fps: number; reason?: string }
export interface Take { stop(reason?: string): Promise<TakeResult> }

const FPS = 30;

/**
 * Record the compositor: one composite per ~1/30 s (requestAnimationFrame), `captureStream(30)`
 * into MediaRecorder (MP4 where the browser can, else WebM), video only. `onTick` gets the
 * take's elapsed ms every frame (the caller stops at the cap).
 */
export function startTake(c: Compositor, opts: { W: number; H: number; onTick(ms: number): void }): Take {
  c.frame();
  // captureStream(0) + requestFrame(): exactly one video frame per composite, stamped when it's made
  const stream = (c.canvas as HTMLCanvasElement & { captureStream(fps?: number): MediaStream }).captureStream(0);
  const track = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void };
  const mime = pickRecordingMime();
  const rec = new MediaRecorder(stream, {
    ...(mime ? { mimeType: mime } : {}),
    videoBitsPerSecond: Math.round((12_000_000 * (opts.W * opts.H)) / (1920 * 1080)),
  });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.start(1000);
  track.requestFrame?.();
  const t0 = performance.now();
  let frames = 0, ticks = 0, tries = 0, last = -Infinity, raf = 0, stopped = false;
  const stats = (window as unknown as { __waTest?: boolean; __waTakeStats?: unknown });
  const tick = (now: number) => {
    if (stopped) return;
    ticks++;
    if (now - last >= 1000 / FPS - 4) { tries++; if (c.frame()) { frames++; track.requestFrame?.(); } last = now; }
    if (stats.__waTest) stats.__waTakeStats = { ticks, tries, frames, ms: Math.round(now - t0) };
    opts.onTick(now - t0);
    if (!stopped) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  let result: Promise<TakeResult> | null = null;
  return {
    stop(reason) {
      if (result) return result;
      stopped = true;
      cancelAnimationFrame(raf);
      const ms = performance.now() - t0;
      result = new Promise((ok) => {
        const done = () => {
          stream.getTracks().forEach((t) => t.stop());
          const type = (rec.mimeType || mime || "video/webm").split(";")[0];
          ok({ blob: new Blob(chunks, { type }), mime: type, ms, fps: Math.min(FPS, frames / Math.max(0.001, ms / 1000)), reason });
        };
        if (rec.state === "inactive") return done();
        rec.onstop = done;
        rec.stop();
      });
      return result;
    },
  };
}

// ============================================================================
// MP4 for sharing (2026-11-21): WhatsApp, Instagram and most phones play
// H.264 in MP4 with its index (moov) at the front, and not WebM. Chrome's
// MediaRecorder writes WebM, so a live take is converted here, in the
// browser, with mediabunny 1.65.1 (WebCodecs; the GPU's H.264 encoder where
// there is one). Renders are written as MP4 directly (render.ts).
// ============================================================================

import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, QUALITY_HIGH, canEncodeVideo } from "mediabunny";

/** Whether this browser can encode H.264 at W×H (Chrome and Edge can; some Firefox builds can't). */
export async function canMakeMp4(W: number, H: number): Promise<boolean> {
  if (typeof VideoEncoder === "undefined") return false;
  return canEncodeVideo("avc", { width: W, height: H }).catch(() => false);
}

/** A video (WebM from MediaRecorder) re-encoded as a phone-friendly MP4: H.264, index first, no audio. */
export async function toMp4(blob: Blob, opts: { onProgress?(done: number): void } = {}): Promise<Blob> {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
  try {
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      video: { codec: "avc", quality: QUALITY_HIGH, forceTranscode: true },
      audio: { discard: true },
      showWarnings: false,
    });
    if (!conversion.isValid) throw new Error("This take couldn't be made into an MP4.");
    conversion.onProgress = (p) => opts.onProgress?.(p);
    await conversion.execute();
    const buffer = (output.target as BufferTarget).buffer;
    if (!buffer) throw new Error("The MP4 came out empty.");
    return new Blob([buffer], { type: "video/mp4" });
  } finally {
    input.dispose();
  }
}

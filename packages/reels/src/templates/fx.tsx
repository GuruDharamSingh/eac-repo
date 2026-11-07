// Drawing the Collect Art FX on the clip template (overlay kind `fx` in
// templates/clip.tsx; the list of FX is templates/fx-catalog.ts). Each FX is
// a 1920x1080 video with alpha laid over the reel: the whole frame in 16:9,
// cropped to the middle (cover) in 9:16 and 1:1.
//
//   overlay     plays once from the item's start
//   loop        repeats for the item's length
//   transition  a stacked track-matte stinger at a cut: the part before the
//               cut carries on (source time runs past its cut end) where the
//               matte is black, the next part shows where it is white, and
//               the stinger's own layer plays on top, as OBS does it.
//
// The matte is blended with CSS (multiply, then plus-lighter), so the
// browser Player and the renderer's Chrome draw the same picture. Every
// extra copy of the recording is muted: the clip's sound comes from the
// edit underneath.

import React from 'react';
import { AbsoluteFill, continueRender, delayRender, Loop, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { FX_CALL_LINE, FX_DIR, FX_FONTS, FX_SIZE, type FxEntry } from './fx-catalog';

export const fxSrc = (file: string) => staticFile(`${FX_DIR}/${file}`);

/** The FX frame scaled to cover the reel's frame, centred. */
function useCover() {
  const { width, height } = useVideoConfig();
  const scale = Math.max(width / FX_SIZE.width, height / FX_SIZE.height);
  const w = FX_SIZE.width * scale;
  const h = FX_SIZE.height * scale;
  return { scale, w, h, left: (width - w) / 2, top: (height - h) / 2 };
}

let fontsLoaded: Promise<unknown> | null = null;
/** The call line's faces, once, into document.fonts; a face that fails falls back to DejaVu. */
function loadFxFonts(): Promise<unknown> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return Promise.resolve();
  fontsLoaded ??= Promise.all(
    FX_FONTS.map(async (f) => {
      try {
        document.fonts.add(await new FontFace(f.family, `url(${fxSrc(f.file)})`, { weight: '600' }).load());
      } catch {
        /* fallback face */
      }
    })
  );
  return fontsLoaded;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A call's price line, under its word, on the call's own timing (frame 0 = the FX's first frame). */
function CallLine({ entry, text }: { entry: FxEntry; text: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCover();
  const [handle] = React.useState(() => delayRender('Collect Art FX fonts'));
  React.useEffect(() => {
    void loadFxFonts().then(() => continueRender(handle));
  }, [handle]);
  if (!entry.call) return null;
  const line = FX_CALL_LINE[entry.call];
  const t = frame / fps;
  const k = smooth(line.fadeIn[0], line.fadeIn[1], t) * (1 - smooth(line.fadeOut[0], line.fadeOut[1], t));
  return (
    <div style={{ position: 'absolute', left: c.left, top: c.top, width: FX_SIZE.width, height: FX_SIZE.height, transform: `scale(${c.scale})`, transformOrigin: '0 0' }}>
      <div
        style={{
          position: 'absolute', left: 0, right: 0, top: line.top, textAlign: 'center', whiteSpace: 'nowrap',
          fontFamily: line.serif ? '"CA Fraunces", "Fraunces", "DejaVu Serif", Georgia, serif' : '"CA Inter", "Inter", "DejaVu Sans", Arial, sans-serif',
          fontWeight: 600, fontSize: line.size, letterSpacing: line.spacing, color: line.color, textShadow: line.glow,
          opacity: k, transform: `translateY(${(1 - k) * 14}px)`,
        }}
      >
        {text}
      </div>
    </div>
  );
}

/** An overlay or a loop, over the whole frame. */
export function FxOverlay({ entry, sub }: { entry: FxEntry; sub?: string }) {
  const c = useCover();
  const { fps } = useVideoConfig();
  const video = (
    <OffthreadVideo src={fxSrc(entry.file)} muted transparent={entry.alpha} style={{ position: 'absolute', left: c.left, top: c.top, width: c.w, height: c.h }} />
  );
  return (
    <AbsoluteFill>
      {entry.category === 'loop' ? <Loop durationInFrames={Math.max(1, Math.round(entry.seconds * fps))}>{video}</Loop> : video}
      {entry.call && sub?.trim() ? <CallLine entry={entry} text={sub.trim()} /> : null}
    </AbsoluteFill>
  );
}

/**
 * A stacked track-matte stinger across a cut. `outFrom` and `inFrom` are the
 * source frames the recording shows at the FX's first frame: the part before
 * the cut, carried on, and the part after it.
 */
export function FxStinger({
  entry,
  clipSrc,
  fit,
  background,
  outFrom,
  inFrom,
}: {
  entry: FxEntry;
  clipSrc: string;
  fit: 'cover' | 'contain';
  background: string;
  outFrom: number;
  inFrom: number;
}) {
  const c = useCover();
  const src = fxSrc(entry.file);
  // One half of the stacked file, cropped to the frame: the stinger on top, the matte below.
  const half = (matte: boolean, style: React.CSSProperties = {}) => (
    <div style={{ position: 'absolute', left: c.left, top: c.top, width: c.w, height: c.h, overflow: 'hidden', ...style }}>
      <OffthreadVideo
        src={src}
        muted
        transparent={!matte && entry.alpha}
        style={{ position: 'absolute', left: 0, top: matte ? -c.h : 0, width: c.w, height: c.h * 2 }}
      />
    </div>
  );
  const picture = (from: number) =>
    clipSrc ? <OffthreadVideo src={clipSrc} muted trimBefore={from} style={{ width: '100%', height: '100%', objectFit: fit }} /> : null;
  return (
    <AbsoluteFill style={{ isolation: 'isolate', background }}>
      {/* outgoing × (1 − matte) */}
      {picture(outFrom)}
      {half(true, { filter: 'invert(1)', mixBlendMode: 'multiply' })}
      {/* + incoming × matte */}
      <AbsoluteFill style={{ isolation: 'isolate', background, mixBlendMode: 'plus-lighter' }}>
        {picture(inFrom)}
        {half(true, { mixBlendMode: 'multiply' })}
      </AbsoluteFill>
      {/* the stinger's own layer */}
      {half(false)}
    </AbsoluteFill>
  );
}

// Artwork reel, 9:16: logo (1 s) dissolving into the artwork with a slow pan,
// then the artist's clip, an optional second clip, an optional "something
// else", and an end card. Music runs under everything and is lowered while a
// clip with speech plays.

import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  OffthreadVideo,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import {
  isClip,
  toArtworkReelProps,
  type ArtworkReelProps,
  type ReelBrand,
  type ReelClip,
  type ReelInput,
} from '../types';

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

const SEC = {
  intro: 1,
  artwork: 4,
  clipMax: 15,
  clip2Max: 10,
  extraImage: 3,
  extraClipMax: 8,
  endCard: 3,
  /** Logo into artwork: the dissolve the template is named for. */
  dissolve: 0.5,
  /** Between the later segments. */
  cut: 0.3,
};

const DEFAULT_BG = '#111111';
const DEFAULT_FG = '#f4f1ea';

type Segment =
  | { kind: 'intro'; frames: number }
  | { kind: 'image'; src: string; frames: number; label: string }
  | { kind: 'clip'; clip: ReelClip; frames: number; label: string }
  | { kind: 'end'; frames: number };

interface Plan {
  segments: Segment[];
  /** transitions[i] sits between segments[i] and segments[i + 1]. */
  transitions: number[];
  /** Absolute frame ranges where a clip with speech plays. */
  voice: Array<[number, number]>;
  durationInFrames: number;
}

function clipFrames(clip: ReelClip, maxSec: number): number {
  // An empty slot previews at 5 s rather than the maximum.
  const sec = Math.min(clip.duration ?? (clip.src ? maxSec : 5), maxSec);
  // At least one second: a segment must outlast the transitions on both sides.
  return Math.max(FPS, Math.round(sec * FPS));
}

/** Pure: the timeline the props produce. Used for the duration and the music ducking. */
export function planArtworkReel(props: ArtworkReelProps): Plan {
  const segments: Segment[] = [
    { kind: 'intro', frames: SEC.intro * FPS },
    { kind: 'image', src: props.artwork.src, frames: SEC.artwork * FPS, label: 'Artwork' },
    { kind: 'clip', clip: props.clip, frames: clipFrames(props.clip, SEC.clipMax), label: 'Clip' },
  ];
  if (props.clip2) {
    segments.push({ kind: 'clip', clip: props.clip2, frames: clipFrames(props.clip2, SEC.clip2Max), label: 'Second clip' });
  }
  if (props.extra) {
    segments.push(
      isClip(props.extra)
        ? { kind: 'clip', clip: props.extra, frames: clipFrames(props.extra, SEC.extraClipMax), label: 'Something else' }
        : { kind: 'image', src: props.extra.src, frames: SEC.extraImage * FPS, label: 'Something else' }
    );
  }
  segments.push({ kind: 'end', frames: SEC.endCard * FPS });

  const transitions = segments
    .slice(1)
    .map((_, i) => Math.round((i === 0 ? SEC.dissolve : SEC.cut) * FPS));

  const voice: Array<[number, number]> = [];
  let at = 0;
  segments.forEach((s, i) => {
    if (s.kind === 'clip' && s.clip.src && s.clip.voice !== false) voice.push([at, at + s.frames]);
    at += s.frames - (transitions[i] ?? 0);
  });

  const total =
    segments.reduce((n, s) => n + s.frames, 0) - transitions.reduce((n, t) => n + t, 0);
  return { segments, transitions, voice, durationInFrames: total };
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Intro({ brand }: { brand: ReelBrand }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 }, durationInFrames: Math.round(fps * 0.7) });
  const scale = interpolate(s, [0, 1], [0.86, 1]);
  const fg = brand.foreground ?? DEFAULT_FG;
  return (
    <AbsoluteFill
      style={{
        background: brand.background ?? DEFAULT_BG,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ opacity: s, transform: `scale(${scale})` }}>
        {brand.logo ? (
          <Img src={brand.logo.src} style={{ width: 600, height: 600, objectFit: 'contain' }} />
        ) : (
          <div
            style={{
              color: fg,
              fontFamily: 'Georgia, serif',
              fontSize: 96,
              textAlign: 'center',
              padding: '0 80px',
              lineHeight: 1.1,
            }}
          >
            {brand.name}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}

/** An unfilled slot, in the preview. The renderer refuses to start without the required ones. */
function Placeholder({ label }: { label: string }) {
  return (
    <AbsoluteFill
      style={{
        background: 'repeating-linear-gradient(135deg, #1d1d1d 0 40px, #242424 40px 80px)',
        color: '#9a958c',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Helvetica, Arial, sans-serif',
        fontSize: 56,
        letterSpacing: 2,
      }}
    >
      {label}
    </AbsoluteFill>
  );
}

function PanImage({ src, label }: { src: string; label: string }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / Math.max(1, durationInFrames - 1);
  const scale = interpolate(t, [0, 1], [1.04, 1.16]);
  const y = interpolate(t, [0, 1], [1.5, -1.5]);
  if (!src) return <Placeholder label={label} />;
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <Img
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale}) translateY(${y}%)`,
        }}
      />
    </AbsoluteFill>
  );
}

function Clip({ clip, label }: { clip: ReelClip; label: string }) {
  if (!clip.src) return <Placeholder label={label} />;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <OffthreadVideo
        src={clip.src}
        trimBefore={Math.round((clip.trimStart ?? 0) * FPS)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </AbsoluteFill>
  );
}

function EndCard({ brand, card }: { brand: ReelBrand; card: ArtworkReelProps['endCard'] }) {
  const frame = useCurrentFrame();
  const fg = brand.foreground ?? DEFAULT_FG;
  const rise = (delay: number) => ({
    opacity: interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    transform: `translateY(${interpolate(frame, [delay, delay + 12], [24, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
  });
  return (
    <AbsoluteFill
      style={{
        background: brand.background ?? DEFAULT_BG,
        color: fg,
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '0 90px',
        gap: 36,
        fontFamily: 'Georgia, serif',
      }}
    >
      {brand.logo ? (
        <Img src={brand.logo.src} style={{ width: 260, height: 260, objectFit: 'contain', ...rise(0) }} />
      ) : null}
      <div style={{ fontSize: 84, lineHeight: 1.1, ...rise(4) }}>{card.title}</div>
      {card.subtitle ? (
        <div style={{ fontSize: 48, ...rise(8) }}>
          <span style={{ opacity: 0.85 }}>{card.subtitle}</span>
        </div>
      ) : null}
      {card.link ? (
        <div style={{ fontSize: 40, fontFamily: 'Helvetica, Arial, sans-serif', letterSpacing: 1, ...rise(12) }}>
          {card.link}
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

function musicVolume(frame: number, total: number, base: number, voice: Array<[number, number]>): number {
  const ramp = 8;
  const ducked = base * 0.22;
  let v = base;
  for (const [a, b] of voice) {
    if (frame >= a - ramp && frame <= b + ramp) {
      const into = interpolate(frame, [a - ramp, a], [base, ducked], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      const out = interpolate(frame, [b, b + ramp], [ducked, base], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      v = Math.min(v, Math.max(into, out));
    }
  }
  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [total - FPS, total - 1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return v * fadeIn * fadeOut;
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

export const ArtworkReel: React.FC<ArtworkReelProps> = (props) => {
  const plan = planArtworkReel(props);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <TransitionSeries>
        {plan.segments.flatMap((s, i) => {
          const seq = (
            <TransitionSeries.Sequence key={`s${i}`} durationInFrames={s.frames}>
              {s.kind === 'intro' ? <Intro brand={props.brand} /> : null}
              {s.kind === 'image' ? <PanImage src={s.src} label={s.label} /> : null}
              {s.kind === 'clip' ? <Clip clip={s.clip} label={s.label} /> : null}
              {s.kind === 'end' ? <EndCard brand={props.brand} card={props.endCard} /> : null}
            </TransitionSeries.Sequence>
          );
          const t = plan.transitions[i];
          return t
            ? [
                seq,
                <TransitionSeries.Transition
                  key={`t${i}`}
                  presentation={fade()}
                  timing={linearTiming({ durationInFrames: t })}
                />,
              ]
            : [seq];
        })}
      </TransitionSeries>
      {props.music ? (
        <Audio
          src={props.music.src}
          loop
          volume={(f) => musicVolume(f, plan.durationInFrames, props.music?.volume ?? 0.7, plan.voice)}
        />
      ) : null}
    </AbsoluteFill>
  );
};

/** The composition: an edit plus its URL map, converted in the bundle. */
export const ArtworkReelComposition: React.FC<ReelInput> = (input) => (
  <ArtworkReel {...toArtworkReelProps(input)} />
);

export const artworkReelDuration = (input: ReelInput): number =>
  planArtworkReel(toArtworkReelProps(input)).durationInFrames;

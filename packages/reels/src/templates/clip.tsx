// Clip with overlays: one recording, with parts cut out, in a 16:9, 9:16 or
// 1:1 frame, and the collective's graphics drawn over it on a timeline
// (editor/Timeline.tsx): title cards, lower thirds (the same four styles as
// the booth's OGraf graphic, docker/obs/overlay/graphics/eac-lower-third),
// captions, quotes, corner labels, pictures and a ticker, and Collect Art's
// fire and lightning video FX (templates/fx.tsx, catalog fx-catalog.ts). An
// end card follows the clip. Music, if any, runs under it and is lowered
// while the clip has speech.

import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, Sequence, Series, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ReelClipRef, ReelFormat, ReelInput, ReelMediaRef, ReelOverlayItem, ReelOverlayKind, ReelOverlays, ReelSegment } from '../types';
import { fxEntry } from './fx-catalog';
import { FxOverlay, FxStinger } from './fx';
import { cueAt, cueWordsMatch } from './subtitles';

export const FPS = 30;
const END_SEC = 3;
const DEFAULT_ACCENT = '#8a6d1f';
const PANEL = 'rgba(20, 17, 16, 0.88)';
const INK = '#f3efe7';
const MUTED = '#cfc7b8';
const SERIF = '"Newsreader", "DejaVu Serif", Georgia, serif';
const SANS = '"IBM Plex Sans", "DejaVu Sans", Helvetica, Arial, sans-serif';

export const FORMAT_SIZE: Record<ReelFormat, { width: number; height: number }> = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

/** Shortest part kept or cut, in seconds. */
export const MIN_SEGMENT = 0.3;

/**
 * The parts of the source kept, sorted, clamped to the source. An edit made
 * before cuts existed has one part: trimStart for duration (10 s while the
 * slot is empty).
 */
export function clipSegments(clip?: ReelClipRef): ReelSegment[] {
  const total = clip?.sourceSeconds && clip.sourceSeconds > 0 ? clip.sourceSeconds : Infinity;
  const start = Math.max(0, Number(clip?.trimStart) || 0);
  const raw = clip?.segments?.length ? clip.segments : [{ from: start, to: start + Math.max(1, Number(clip?.duration) || 10) }];
  return raw
    .map((g) => ({ from: Math.max(0, Math.min(g.from, total)), to: Math.min(g.to, total) }))
    .filter((g) => g.to - g.from >= 0.1)
    .sort((a, b) => a.from - b.from);
}
export const segmentFrames = (g: ReelSegment) => Math.max(1, Math.round((g.to - g.from) * FPS));

/** Overlays as timeline items; edits from before items had one of each. */
export function overlayItems(o?: ReelOverlays): ReelOverlayItem[] {
  if (!o) return [];
  if (o.items) return o.items;
  const out: ReelOverlayItem[] = [];
  if (o.title?.text) out.push({ id: 'title', kind: 'title', at: 0, seconds: o.title.seconds ?? 3, text: o.title.text, sub: o.title.subtitle });
  if (o.lowerThird?.name) {
    const l = o.lowerThird;
    out.push({ id: 'lower', kind: 'lower', at: l.at ?? 1, seconds: l.seconds ?? 5, text: l.name, sub: l.role, style: l.style });
  }
  if (o.bug?.text) out.push({ id: 'bug', kind: 'bug', at: 0.5, seconds: 0, text: o.bug.text, corner: o.bug.corner });
  return out;
}

export const OVERLAY_KINDS: Array<{ kind: ReelOverlayKind; label: string; seconds: number }> = [
  { kind: 'title', label: 'Title card', seconds: 3 },
  { kind: 'lower', label: 'Lower third', seconds: 5 },
  { kind: 'caption', label: 'Caption', seconds: 4 },
  { kind: 'quote', label: 'Quote', seconds: 6 },
  { kind: 'bug', label: 'Corner label', seconds: 0 },
  { kind: 'image', label: 'Picture', seconds: 0 },
  { kind: 'ticker', label: 'Ticker', seconds: 15 },
  // Length set from the chosen FX (fx-catalog.ts).
  { kind: 'fx', label: 'FX', seconds: 0 },
  { kind: 'text', label: 'Text', seconds: 4 },
  // One item over the whole clip; its cues carry their own times.
  { kind: 'subtitles', label: 'Subtitles', seconds: 0 },
  // A sound effect; its length is set from the file when it is picked.
  { kind: 'sound', label: 'Sound', seconds: 1 },
];

export interface ClipReelProps {
  clip: { src: string; segments: ReelSegment[]; voice: boolean };
  fit: 'cover' | 'contain';
  items: Array<ReelOverlayItem & { src?: string }>;
  accent: string;
  endCard: { title: string; subtitle?: string; link?: string } | null;
  music?: { src: string; volume: number };
  background: string;
}

/** Edit → props, shared by the preview and the renderer. */
export function toClipProps({ edit, urls, fallbackName }: ReelInput): ClipReelProps {
  const src = (ref?: ReelMediaRef) => (ref?.path ? urls[ref.path] ?? '' : '');
  const name = edit.brand?.name?.trim() || fallbackName || 'Elkdonis Arts Collective';
  const end = edit.endCard;
  const accent = edit.overlays?.accent ?? '';
  return {
    clip: { src: src(edit.clip), segments: clipSegments(edit.clip), voice: edit.clip?.voice ?? true },
    fit: edit.fit === 'contain' ? 'contain' : 'cover',
    items: overlayItems(edit.overlays).map((i) => (i.kind === 'image' ? { ...i, src: src(i.image) } : i.kind === 'sound' ? { ...i, src: src(i.sound) } : i)),
    accent: /^#[0-9a-f]{6}$/i.test(accent) ? accent : DEFAULT_ACCENT,
    // The end card is there when it has a title (or a link), not by default.
    endCard: end && (end.title?.trim() || end.link?.trim()) ? { title: end.title?.trim() || name, subtitle: end.subtitle?.trim() || undefined, link: end.link?.trim() || undefined } : null,
    music: edit.music && src(edit.music) ? { src: src(edit.music), volume: edit.music.volume ?? 0.7 } : undefined,
    background: edit.brand?.background || '#111111',
  };
}

export const clipFrames = (p: Pick<ClipReelProps, 'clip'>) => p.clip.segments.reduce((n, g) => n + segmentFrames(g), 0) || FPS;
export function clipReelDuration(input: ReelInput): number {
  const p = toClipProps(input);
  return clipFrames(p) + (p.endCard ? END_SEC * FPS : 0);
}
export const clipReelSize = (input: ReelInput) => FORMAT_SIZE[input.edit.format ?? 'landscape'] ?? FORMAT_SIZE.landscape;

type SpanItem = Pick<ReelOverlayItem, 'at' | 'seconds'> & Partial<Pick<ReelOverlayItem, 'kind' | 'fx'>>;

/** An item's length in seconds, 0 = to the end. A one-shot FX or a transition lasts its own length. */
export function itemSeconds(i: SpanItem): number {
  if (i.kind === 'fx') {
    const e = fxEntry(i.fx);
    if (e && e.category !== 'loop') return e.seconds;
  }
  return Number(i.seconds) > 0 ? Number(i.seconds) : 0;
}

/** An item's first frame and length on the clip, clamped to it; null when it falls outside. */
export function itemSpan(i: SpanItem, total: number): { from: number; frames: number } | null {
  const from = Math.max(0, Math.round((Number(i.at) || 0) * FPS));
  if (from >= total) return null;
  const sec = itemSeconds(i);
  const want = sec > 0 ? Math.round(sec * FPS) : total - from;
  return { from, frames: Math.max(1, Math.min(want, total - from)) };
}

/** The source frame the edit shows at output frame `frame` (past the end: the last part carried on). */
export function sourceFrame(segments: ReelSegment[], frame: number): number {
  let n = 0;
  for (const g of segments) {
    const f = segmentFrames(g);
    if (frame < n + f) return Math.round(g.from * FPS) + Math.max(0, frame - n);
    n += f;
  }
  const last = segments[segments.length - 1];
  return last ? Math.round(last.from * FPS) + segmentFrames(last) + (frame - n) : frame;
}

/** Output frames where one kept part ends and the next begins: where a transition belongs. */
export function cutFrames(segments: ReelSegment[]): number[] {
  const out: number[] = [];
  let n = 0;
  for (const g of segments.slice(0, -1)) out.push((n += segmentFrames(g)));
  return out;
}

/** 0 → 1 over `len` frames from `start`, and back to 0 over `len` frames before `end`. */
function inOut(frame: number, start: number, end: number, len: number) {
  const a = interpolate(frame, [start, start + len], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const b = interpolate(frame, [end - len, end], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return Math.min(a, b);
}
/** Like inOut but with a delay inside, for staggered parts of one graphic. */
const stage = (frame: number, start: number, end: number, len: number, delay: number) => inOut(frame, start + delay, end - delay, len);
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

// Each overlay draws inside its own <Sequence>: frame 0 is its first frame, `len` its length.
interface Part {
  o: ReelOverlayItem & { src?: string };
  u: number;
  accent: string;
  len: number;
  /** For FX transitions, which blend the recording itself: the clip, how it fills the frame, and the item's first frame. */
  clip?: ClipReelProps['clip'];
  fit?: ClipReelProps['fit'];
  background?: string;
  from?: number;
}

const cornerPos = (corner: ReelOverlayItem['corner'], u: number, y = 54): React.CSSProperties =>
  ({
    tl: { top: y * u, left: 96 * u },
    tr: { top: y * u, right: 96 * u },
    bl: { bottom: y * u, left: 96 * u },
    br: { bottom: y * u, right: 96 * u },
  })[corner ?? 'tr'];

function LowerThird({ o, u, accent, len }: Part) {
  const frame = useCurrentFrame();
  const style = o.style ?? 'panel';
  const L = 14; // frames per move
  const whole = ease(inOut(frame, 0, len, L));
  const bg = ease(stage(frame, 0, len, L, style === 'panel' ? 0 : 4));
  const mark = ease(stage(frame, 0, len, L, 0));
  const t1 = ease(stage(frame, 0, len, L, style === 'panel' ? 0 : 10));
  const t2 = ease(stage(frame, 0, len, L, style === 'panel' ? 0 : 13));

  const box: React.CSSProperties = { position: 'absolute', left: 96 * u, bottom: 108 * u, display: 'inline-block', maxWidth: '75%' };
  if (style === 'panel') Object.assign(box, { opacity: whole, transform: `translateX(${(1 - whole) * -60 * u}px)` });
  const bgStyle: React.CSSProperties = { position: 'absolute', inset: 0, background: PANEL, transformOrigin: 'left' };
  if (style === 'slash' || style === 'reveal') bgStyle.transform = `scaleX(${bg})`;
  if (style === 'fade') bgStyle.opacity = bg;
  const markStyle: React.CSSProperties = { position: 'absolute', top: 0, bottom: 0, left: -10 * u, width: 10 * u, background: accent };
  if (style === 'slash') Object.assign(markStyle, { left: -30 * u, width: 14 * u, opacity: mark, transform: `translateX(${(1 - mark) * 160 * u}px) skewX(-18deg)` });
  if (style === 'reveal') markStyle.transform = `scale(${mark}) rotate(${(1 - mark) * 90}deg)`;
  if (style === 'fade') markStyle.opacity = bg;
  // slash: lines slide in from the left; reveal: the name rises, the role
  // drops; fade: both rise. `name` tells the two lines apart.
  const line = (t: number, name: boolean): React.CSSProperties => {
    if (style === 'slash') return { transform: `translateX(${(t - 1) * 102}%)` };
    if (style === 'reveal') return { transform: `translateY(${(1 - t) * (name ? 110 : -110)}%)` };
    if (style === 'fade') return { transform: `translateY(${(1 - t) * 110}%)` };
    return {};
  };
  return (
    <div style={box}>
      <div style={markStyle} />
      <div style={bgStyle} />
      <div style={{ position: 'relative', padding: `${20 * u}px ${40 * u}px ${22 * u}px ${34 * u}px` }}>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontFamily: SERIF, fontSize: 58 * u, lineHeight: 1.12, color: INK, whiteSpace: 'nowrap', ...line(t1, true) }}>{o.text}</div>
        </div>
        {o.sub ? (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontFamily: SANS, fontSize: 30 * u, lineHeight: 1.3, color: MUTED, marginTop: 2 * u, whiteSpace: 'nowrap', ...line(t2, false) }}>{o.sub}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TitleCard({ o, u, accent, len }: Part) {
  const frame = useCurrentFrame();
  // A title at the very start is already there on frame 0.
  const t = ease(inOut(frame, o.at > 0 ? 0 : -12, len, 12));
  return (
    <AbsoluteFill style={{ background: `rgba(12, 10, 9, ${0.8 * t})`, display: 'grid', placeContent: 'center', textAlign: 'center', padding: `0 ${120 * u}px` }}>
      <div style={{ opacity: t, transform: `scale(${1.02 - 0.02 * t})` }}>
        <div style={{ fontFamily: SERIF, fontSize: 104 * u, lineHeight: 1.08, color: INK }}>{o.text}</div>
        <div style={{ width: 120 * u, height: 6 * u, background: accent, margin: `${32 * u}px auto` }} />
        {o.sub ? <div style={{ fontFamily: SANS, fontSize: 40 * u, color: MUTED }}>{o.sub}</div> : null}
      </div>
    </AbsoluteFill>
  );
}

function Caption({ o, u, len }: Part) {
  const frame = useCurrentFrame();
  const t = ease(inOut(frame, 0, len, 8));
  const top = o.place === 'top';
  return (
    <AbsoluteFill style={{ justifyContent: top ? 'flex-start' : 'flex-end', alignItems: 'center', padding: `${(top ? 80 : 96) * u}px ${96 * u}px` }}>
      <div
        style={{
          maxWidth: '82%', padding: `${14 * u}px ${28 * u}px`, background: 'rgba(12, 10, 9, 0.78)', color: INK, textAlign: 'center',
          fontFamily: SANS, fontSize: 44 * u, lineHeight: 1.3, whiteSpace: 'pre-line', opacity: t, transform: `translateY(${(1 - t) * (top ? -16 : 16) * u}px)`,
        }}
      >
        {o.text}
      </div>
    </AbsoluteFill>
  );
}

function Quote({ o, u, accent, len }: Part) {
  const frame = useCurrentFrame();
  const t = ease(inOut(frame, 0, len, 14));
  const by = ease(stage(frame, 0, len, 14, 8));
  return (
    <AbsoluteFill style={{ background: `rgba(12, 10, 9, ${0.72 * t})`, display: 'grid', placeContent: 'center', padding: `0 ${150 * u}px` }}>
      <div style={{ opacity: t, transform: `translateY(${(1 - t) * 20 * u}px)`, maxWidth: 1500 * u }}>
        <div style={{ fontFamily: SERIF, fontSize: 200 * u, lineHeight: 0.6, color: accent, height: 90 * u }}>“</div>
        <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 70 * u, lineHeight: 1.22, color: INK, whiteSpace: 'pre-line' }}>{o.text}</div>
        {o.sub ? <div style={{ fontFamily: SANS, fontSize: 34 * u, color: MUTED, marginTop: 30 * u, opacity: by }}>— {o.sub}</div> : null}
      </div>
    </AbsoluteFill>
  );
}

function Bug({ o, u, accent, len }: Part) {
  const frame = useCurrentFrame();
  const t = inOut(frame, 0, len, 12);
  return (
    <div
      style={{
        position: 'absolute', ...cornerPos(o.corner, u), opacity: t, padding: `${12 * u}px ${22 * u}px`, background: PANEL, borderLeft: `${6 * u}px solid ${accent}`,
        fontFamily: SANS, fontSize: 26 * u, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK,
      }}
    >
      {o.text}
    </div>
  );
}

function Picture({ o, u, len }: Part) {
  const frame = useCurrentFrame();
  const t = inOut(frame, 0, len, 12);
  const size = Math.max(5, Math.min(60, Number(o.size) || 14));
  if (!o.src) return null;
  return <Img src={o.src} style={{ position: 'absolute', ...cornerPos(o.corner, u, 60), width: size * 10.8 * u, height: 'auto', opacity: t }} />;
}

function Ticker({ o, u, accent, len }: Part) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const t = ease(inOut(frame, 0, len, 10));
  const font = 34 * u;
  const speed = 4 * u; // px a frame
  // Repeat the text far enough that the band never runs out; no measuring,
  // so the render is the same on every machine.
  const text = (o.text ?? '').trim();
  const est = Math.max(1, text.length * font * 0.55 + 120 * u);
  const copies = Math.min(60, Math.ceil((speed * len + width) / est) + 1);
  const label = o.sub?.trim();
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 76 * u, display: 'flex', background: PANEL, opacity: t, transform: `translateY(${(1 - t) * 76 * u}px)` }}>
      {label ? (
        <div style={{ flex: 'none', zIndex: 1, display: 'grid', placeContent: 'center', padding: `0 ${28 * u}px`, background: accent, color: '#fff', fontFamily: SANS, fontWeight: 600, fontSize: 28 * u, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {label}
        </div>
      ) : null}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', transform: `translateX(${width * 0.6 - frame * speed}px)`, fontFamily: SANS, fontSize: font, color: INK }}>
          {Array.from({ length: copies }, (_, k) => (
            <span key={k} style={{ paddingRight: 120 * u }}>
              {text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Fx({ o, clip, fit, background, from = 0 }: Part) {
  const e = fxEntry(o.fx);
  if (!e) return null;
  if (e.category === 'transition' && e.matte === 'stacked' && clip) {
    // The part before the cut carries on under the stinger; the next part comes in through the matte.
    const outFrom = from > 0 ? sourceFrame(clip.segments, from - 1) + 1 : sourceFrame(clip.segments, 0);
    return <FxStinger entry={e} clipSrc={clip.src} fit={fit ?? 'cover'} background={background ?? '#111111'} outFrom={outFrom} inFrom={sourceFrame(clip.segments, from)} />;
  }
  return <FxOverlay entry={e} sub={o.sub} />;
}

const FONTS = { serif: SERIF, sans: SANS, mono: '"IBM Plex Mono", "DejaVu Sans Mono", monospace' } as const;
const hex = (c: string | undefined, d: string) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : d);
const letters = (o: ReelOverlayItem, d: number) => Math.max(2, Math.min(20, Number(o.size) || d)) * 10.8;

/** Free text anywhere in the frame: x/y are the centre in % of the frame. */
function TextBox({ o, u, len }: Part) {
  const frame = useCurrentFrame();
  const t = ease(inOut(frame, 0, len, 8));
  const x = Math.max(0, Math.min(100, o.x ?? 50));
  const y = Math.max(0, Math.min(100, o.y ?? 50));
  return (
    <div
      style={{
        position: 'absolute', left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%) translateY(${(1 - t) * 10 * u}px)`, opacity: t,
        maxWidth: '88%', width: 'max-content', textAlign: o.align ?? 'center', whiteSpace: 'pre-line',
        fontFamily: FONTS[o.font ?? 'sans'], fontWeight: o.weight === 'bold' ? 700 : 400, fontSize: letters(o, 6) * u, lineHeight: 1.2,
        color: hex(o.color, INK), ...(o.box ? { background: 'rgba(12, 10, 9, 0.78)', padding: `${0.25 * letters(o, 6) * u}px ${0.5 * letters(o, 6) * u}px` } : { textShadow: `0 ${2 * u}px ${8 * u}px rgba(0,0,0,0.7)` }),
      }}
    >
      {o.text}
    </div>
  );
}

/**
 * Subtitles: one item over the whole clip. The output frame is mapped back
 * to source time (the cuts), and the cue covering that time is shown; a cue
 * with its transcript words colours the word being spoken.
 */
function Subtitles({ o, u, clip, from = 0 }: Part) {
  const frame = useCurrentFrame();
  const t = clip ? sourceFrame(clip.segments, from + frame) / FPS : (from + frame) / FPS;
  const cue = cueAt(o.cues, t);
  if (!cue) return null;
  const top = o.place === 'top';
  const size = letters(o, 4.2) * u;
  const color = hex(o.color, INK);
  const hi = o.highlight && /^#[0-9a-f]{6}$/i.test(o.highlight) ? o.highlight : null;
  const words = hi && cueWordsMatch(cue) ? cue.words! : null;
  return (
    <AbsoluteFill style={{ justifyContent: top ? 'flex-start' : 'flex-end', alignItems: 'center', padding: `${(top ? 70 : 84) * u}px ${90 * u}px` }}>
      <div
        style={{
          maxWidth: '86%', textAlign: 'center', fontFamily: FONTS[o.font ?? 'sans'], fontWeight: o.weight === 'bold' ? 700 : 500, fontSize: size, lineHeight: 1.28, color,
          ...(o.box === false ? { textShadow: `0 ${2 * u}px ${6 * u}px rgba(0,0,0,0.85), 0 0 ${2 * u}px rgba(0,0,0,0.9)` } : { background: 'rgba(12, 10, 9, 0.72)', padding: `${0.22 * size}px ${0.5 * size}px`, borderRadius: 4 * u }),
        }}
      >
        {words
          ? words.map((w, k) => (
              <span key={k} style={{ color: t >= w.s ? hi! : color }}>
                {k ? ' ' : ''}
                {w.w}
              </span>
            ))
          : cue.text}
      </div>
    </AbsoluteFill>
  );
}

const PARTS: Record<ReelOverlayKind, React.FC<Part>> = {
  title: TitleCard,
  lower: LowerThird,
  caption: Caption,
  quote: Quote,
  bug: Bug,
  image: Picture,
  ticker: Ticker,
  fx: Fx,
  text: TextBox,
  subtitles: Subtitles,
  sound: () => null,
};
/** Drawn from the bottom up: full-frame cards over the bands and labels, FX over everything. */
const LAYER: Record<ReelOverlayKind, number> = { sound: 0, image: 0, bug: 1, ticker: 2, lower: 3, caption: 4, subtitles: 4, text: 5, quote: 6, title: 7, fx: 8 };
/** FX transitions blend the recording itself, so they go under every graphic. */
const layerOf = (i: ReelOverlayItem) => (i.kind === 'fx' && fxEntry(i.fx)?.category === 'transition' ? -1 : LAYER[i.kind]);
const isEmpty = (i: ReelOverlayItem & { src?: string }) =>
  i.kind === 'image' || i.kind === 'sound' ? !i.src : i.kind === 'fx' ? !fxEntry(i.fx) : i.kind === 'subtitles' ? !i.cues?.length : !i.text?.trim();

function EndCard({ card, u, background, accent }: { card: NonNullable<ClipReelProps['endCard']>; u: number; background: string; accent: string }) {
  const frame = useCurrentFrame();
  const rise = (d: number): React.CSSProperties => ({
    opacity: interpolate(frame, [d, d + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    transform: `translateY(${interpolate(frame, [d, d + 12], [24 * u, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
  });
  return (
    <AbsoluteFill style={{ background, display: 'grid', placeContent: 'center', textAlign: 'center', padding: `0 ${100 * u}px`, color: INK }}>
      <div style={{ fontFamily: SERIF, fontSize: 92 * u, lineHeight: 1.1, ...rise(0) }}>{card.title}</div>
      <div style={{ width: 100 * u, height: 5 * u, background: accent, margin: `${28 * u}px auto`, ...rise(6) }} />
      {card.subtitle ? <div style={{ fontFamily: SANS, fontSize: 40 * u, color: MUTED, ...rise(10) }}>{card.subtitle}</div> : null}
      {card.link ? <div style={{ fontFamily: SANS, fontSize: 34 * u, marginTop: 24 * u, letterSpacing: 1, ...rise(14) }}>{card.link}</div> : null}
    </AbsoluteFill>
  );
}

export function ClipReel(p: ClipReelProps) {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  // Sizes are drawn for 1080 on the short side.
  const u = Math.min(width, height) / 1080;
  const frames = clipFrames(p);
  const musicBase = p.music?.volume ?? 0;
  const musicVolume = p.clip.voice && frame < frames ? musicBase * 0.25 : musicBase;
  const items = p.items
    .filter((i) => !isEmpty(i))
    .map((i, n) => ({ i, n, span: itemSpan(i, frames) }))
    .filter((x) => x.span)
    .sort((a, b) => layerOf(a.i) - layerOf(b.i) || a.n - b.n);
  return (
    <AbsoluteFill style={{ background: p.background }}>
      <Sequence durationInFrames={frames}>
        {p.clip.src ? (
          // One sequence per kept part; the next part loads a second ahead.
          <Series>
            {p.clip.segments.map((g, k) => (
              <Series.Sequence key={k} durationInFrames={segmentFrames(g)} premountFor={FPS}>
                <OffthreadVideo src={p.clip.src} trimBefore={Math.round(g.from * FPS)} style={{ width: '100%', height: '100%', objectFit: p.fit }} />
              </Series.Sequence>
            ))}
          </Series>
        ) : (
          <AbsoluteFill style={{ display: 'grid', placeContent: 'center', color: MUTED, fontFamily: SANS, fontSize: 40 * u }}>Your clip</AbsoluteFill>
        )}
        {items.map(({ i, span }) => {
          const Draw = PARTS[i.kind];
          if (i.kind === 'sound') {
            return (
              <Sequence key={i.id} from={span!.from} durationInFrames={span!.frames} premountFor={FPS}>
                <Audio src={i.src!} volume={Math.max(0, Math.min(1.5, i.volume ?? 1))} />
              </Sequence>
            );
          }
          if (i.kind === 'fx') {
            // Full-frame video: mounted a second early so the Player has it loaded.
            return (
              <Sequence key={i.id} from={span!.from} durationInFrames={span!.frames} premountFor={FPS}>
                <Draw o={i} u={u} accent={p.accent} len={span!.frames} clip={p.clip} fit={p.fit} background={p.background} from={span!.from} />
              </Sequence>
            );
          }
          return (
            <Sequence key={i.id} from={span!.from} durationInFrames={span!.frames} layout="none">
              {/* Subtitles map frames back to source time, so they get the clip and their first frame. */}
              <Draw o={i} u={u} accent={p.accent} len={span!.frames} clip={i.kind === 'subtitles' ? p.clip : undefined} from={span!.from} />
            </Sequence>
          );
        })}
      </Sequence>
      {p.endCard ? (
        <Sequence from={frames} durationInFrames={END_SEC * FPS}>
          <EndCard card={p.endCard} u={u} background={p.background} accent={p.accent} />
        </Sequence>
      ) : null}
      {p.music ? <Audio src={p.music.src} volume={musicVolume} /> : null}
    </AbsoluteFill>
  );
}

/** The registry's component: ReelInput in. */
export const ClipReelComposition: React.FC<ReelInput> = (input) => <ClipReel {...toClipProps(input)} />;

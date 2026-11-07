'use client';

// The clip template's timeline, under the preview (templates/clip.tsx).
//
//   Recording   the whole source file with a filmstrip; the parts kept are
//               bright, the parts cut out grey. Drag a part's edges to trim
//               it; click a grey part to put it back.
//   Edit        the kept parts back to back, as the reel plays them, then
//               the end card.
//   Overlays    one bar per overlay, in the edit's time: drag to move, drag
//               the right edge to lengthen, click to edit it below.
//
// The playhead follows the Player; clicking a track seeks it. Cutting:
// "Split" at the playhead, or "Cut from here" … "to here" across any span;
// both work on the source, so nothing is lost until it is rendered.
// Keys while the timeline has focus: space plays, S splits, Delete removes
// the selected part or overlay.

import * as React from 'react';
import type { PlayerRef } from '@remotion/player';
import {
  clipSegments,
  cutFrames,
  FPS,
  itemSpan,
  MIN_SEGMENT,
  OVERLAY_KINDS,
  overlayItems,
  segmentFrames,
} from '../templates/clip';
import { FX_CATEGORY_LABEL, fxAvailable, fxEntry, type FxCategory } from '../templates/fx-catalog';
import type { ReelEdit, ReelMediaRef, ReelOverlayItem, ReelOverlayKind, ReelSegment } from '../types';
import { SlotLibrary } from './SlotLibrary';
import { findPauses, keptOf, PausesPanel } from './Pauses';
import { Waveform, WordsPanel } from './Words';
import { SoundFields, type SoundLibrary } from './Sounds';
import { cueOutput, SubtitlesPanel, TextFields, useTranscript } from './TextFields';
import type { VideoTranscript } from './types';

interface Props {
  edit: ReelEdit;
  change(e: ReelEdit): void;
  player: React.RefObject<PlayerRef | null>;
  /** The clip's file, for its length and the filmstrip. */
  srcUrl?: string;
  library?: { endpoint: string; mediaBase: string };
  /** Upload a picture for an overlay into the project's folder. */
  uploadImage?(file: File): Promise<ReelMediaRef | null>;
  /** Undo and redo of the whole edit (VideoKind keeps the history). */
  history?: { undo(): void; redo(): void; canUndo: boolean; canRedo: boolean };
  /** Open a stored picture in the picture editor; resolves with the edited copy, or null. */
  editImage?(ref: ReelMediaRef): Promise<ReelMediaRef | null>;
  /** Speech-to-text of the clip's recording (the reel-render worker); absent = lines by hand only. */
  transcript?: { start(): Promise<VideoTranscript | null>; get(): Promise<VideoTranscript | null> };
  /** The reel's title, for the .srt file name. */
  name?: string;
  /** Sound effects (Sounds.tsx); without it there is no Sound overlay. */
  sounds?: SoundLibrary;
}

type Selection = { type: 'seg'; index: number } | { type: 'gap'; from: number; to: number } | { type: 'item'; id: string } | null;

const END_SEC = 3;
const KIND_LABEL = Object.fromEntries(OVERLAY_KINDS.map((k) => [k.kind, k.label])) as Record<ReelOverlayKind, string>;

/** A bar's text: an FX shows its name (and a call's price line). */
const itemLabel = (i: ReelOverlayItem) => {
  if (i.kind === 'fx') {
    const e = fxEntry(i.fx);
    return e ? `${e.label}${e.call && i.sub?.trim() ? ` · ${i.sub.trim()}` : ''}` : KIND_LABEL.fx;
  }
  if (i.kind === 'subtitles') return `${KIND_LABEL.subtitles} · ${i.cues?.length ?? 0} lines`;
  if (i.kind === 'sound') return `♪ ${i.sound?.name?.replace(/\.[a-z0-9]{2,4}$/i, '') ?? KIND_LABEL.sound}`;
  return i.text?.trim() || i.image?.name || KIND_LABEL[i.kind];
};
const emptyItem = (i: ReelOverlayItem) =>
  i.kind === 'image' ? !i.image?.path : i.kind === 'sound' ? !i.sound?.path : i.kind === 'fx' ? !fxEntry(i.fx) : i.kind === 'subtitles' ? !i.cues?.length : !i.text?.trim();
/** One-shot FX and transitions last their own length: no length handle, no "For". */
const fixedLength = (i: ReelOverlayItem) => i.kind === 'fx' && fxEntry(i.fx)?.category !== 'loop';

/** The cut nearest to `sec` (edit seconds), if one is within `within` seconds. */
function nearestCut(cuts: number[], sec: number, within = Infinity): number | null {
  let best: number | null = null;
  for (const c of cuts) if (Math.abs(c - sec) <= within && (best === null || Math.abs(c - sec) < Math.abs(best - sec))) best = c;
  return best;
}

export function fmtTime(s: number): string {
  const t = Math.max(0, s);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = (t % 60).toFixed(1).padStart(4, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Read "1:23.4", "83.4" or "1:02:03" as seconds; null when unreadable. */
function parseTime(v: string): number | null {
  const parts = v.trim().split(':').map(Number);
  if (!parts.length || parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/** Remove [a, b] (source seconds) from the kept parts. */
export function cutRange(segs: ReelSegment[], a: number, b: number): ReelSegment[] {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  const out: ReelSegment[] = [];
  for (const g of segs) {
    if (hi <= g.from || lo >= g.to) out.push(g);
    else {
      if (lo - g.from >= MIN_SEGMENT) out.push({ from: g.from, to: lo });
      if (g.to - hi >= MIN_SEGMENT) out.push({ from: hi, to: g.to });
    }
  }
  return out;
}

/** Add [a, b] back and merge what touches. */
function keepRange(segs: ReelSegment[], a: number, b: number): ReelSegment[] {
  const all = [...segs, { from: Math.min(a, b), to: Math.max(a, b) }].sort((x, y) => x.from - y.from);
  const out: ReelSegment[] = [];
  for (const g of all) {
    const last = out[out.length - 1];
    if (last && g.from <= last.to + 0.05) last.to = Math.max(last.to, g.to);
    else out.push({ ...g });
  }
  return out;
}

/** The parts cut out between and around the kept ones. */
function gapsOf(segs: ReelSegment[], total: number): ReelSegment[] {
  const out: ReelSegment[] = [];
  let at = 0;
  for (const g of segs) {
    if (g.from - at > 0.05) out.push({ from: at, to: g.from });
    at = g.to;
  }
  if (total - at > 0.05) out.push({ from: at, to: total });
  return out;
}

/** Output frame ↔ source seconds, through the kept parts. */
function mapper(segs: ReelSegment[]) {
  const starts: number[] = [];
  let n = 0;
  for (const g of segs) {
    starts.push(n);
    n += segmentFrames(g);
  }
  return {
    total: n,
    starts,
    toSource(frame: number): number {
      for (let i = segs.length - 1; i >= 0; i--) if (frame >= starts[i]) return Math.min(segs[i].to, segs[i].from + (frame - starts[i]) / FPS);
      return segs[0]?.from ?? 0;
    },
    /** The output frame showing source second `x`, or the next kept part's first frame. */
    toFrame(x: number): number {
      for (let i = 0; i < segs.length; i++) {
        if (x < segs[i].from) return starts[i];
        if (x <= segs[i].to) return starts[i] + Math.round((x - segs[i].from) * FPS);
      }
      return Math.max(0, n - 1);
    },
  };
}

/** Pictures from across a video, for the recording track. */
const strips = new Map<string, string[]>();
function useFilmstrip(url: string | undefined, seconds: number, count: number): string[] {
  const key = url ? `${url}#${count}` : '';
  const [frames, setFrames] = React.useState<string[]>(() => strips.get(key) ?? []);
  React.useEffect(() => {
    if (!url || !(seconds > 0)) return;
    if (strips.has(key)) return setFrames(strips.get(key)!);
    let stop = false;
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.src = url;
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext('2d');
    const seek = (t: number) =>
      new Promise<boolean>((ok) => {
        const timer = window.setTimeout(() => ok(false), 4000);
        v.onseeked = () => {
          window.clearTimeout(timer);
          ok(true);
        };
        v.currentTime = t;
      });
    (async () => {
      await new Promise((ok) => {
        v.onloadeddata = ok;
        v.onerror = ok;
      });
      const out: string[] = [];
      for (let i = 0; i < count && !stop; i++) {
        const okSeek = await seek(((i + 0.5) / count) * seconds);
        if (stop) return;
        if (okSeek && ctx && v.videoWidth) {
          const scale = Math.max(160 / v.videoWidth, 90 / v.videoHeight);
          const w = v.videoWidth * scale;
          const h = v.videoHeight * scale;
          ctx.drawImage(v, (160 - w) / 2, (90 - h) / 2, w, h);
          out.push(canvas.toDataURL('image/jpeg', 0.6));
        } else out.push('');
        setFrames([...out]);
      }
      if (!stop) strips.set(key, out);
    })();
    return () => {
      stop = true;
      v.removeAttribute('src');
      v.load();
    };
  }, [url, seconds, count, key]);
  return frames;
}

/** Drag on a track: seconds under the pointer, from the track's own box; `perPx` = seconds per pixel, `free` = Alt held (no snapping). */
function useDrag(onMove: (sec: number, dx: number, perPx: number, free: boolean) => void, onEnd?: () => void) {
  return React.useCallback(
    (e: React.PointerEvent, track: HTMLElement | null, length: number) => {
      if (!track) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = track.getBoundingClientRect();
      const x0 = e.clientX;
      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        const sec = Math.max(0, Math.min(length, ((ev.clientX - rect.left) / rect.width) * length));
        onMove(sec, ((ev.clientX - x0) / rect.width) * length, length / rect.width, ev.altKey);
      };
      const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        onEnd?.();
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    },
    [onMove, onEnd]
  );
}

/** Snap distance on screen. */
const SNAP_PX = 8;
/** The target nearest to `x` within `within`, or null. */
function snapTo(x: number, targets: number[], within: number): number | null {
  let best: number | null = null;
  for (const t of targets) if (Math.abs(t - x) <= within && (best === null || Math.abs(t - x) < Math.abs(best - x))) best = t;
  return best;
}

/** Overlays laid out in rows so that bars never overlap. */
function lanes(items: ReelOverlayItem[], total: number) {
  const rows: number[] = [];
  const placed = items
    .map((i) => ({ i, span: itemSpan(i, total) }))
    .sort((a, b) => (a.span?.from ?? 0) - (b.span?.from ?? 0))
    .map(({ i, span }) => {
      const from = span?.from ?? total;
      const to = span ? span.from + span.frames : total;
      let row = rows.findIndex((end) => end <= from);
      if (row < 0) row = rows.push(0) - 1;
      rows[row] = to;
      return { i, from, to, row };
    });
  return { placed, count: Math.max(1, rows.length) };
}

export function Timeline({ edit, change, player, srcUrl, library, uploadImage, editImage, history, transcript, name, sounds }: Props) {
  const clip = edit.clip;
  const segs = React.useMemo(() => clipSegments(clip), [clip]);
  const source = clip?.sourceSeconds ?? Math.max(0, ...segs.map((g) => g.to));
  const map = React.useMemo(() => mapper(segs), [segs]);
  const total = map.total || FPS;
  const endCard = Boolean(edit.endCard?.title?.trim() || edit.endCard?.link?.trim());
  const outLen = total + (endCard ? END_SEC * FPS : 0);
  const items = React.useMemo(() => overlayItems(edit.overlays), [edit.overlays]);

  const [frame, setFrame] = React.useState(0);
  const [sel, setSel] = React.useState<Selection>(null);
  const [zoom, setZoom] = React.useState(1);
  const [markIn, setMarkIn] = React.useState<number | null>(null);
  const [imageFor, setImageFor] = React.useState<string | null>(null);
  // Suggested cuts (Pauses.tsx): the panel, and its two settings.
  const [pausesOpen, setPausesOpen] = React.useState(false);
  const [pauseMin, setPauseMin] = React.useState(0.8);
  const [pauseKeep, setPauseKeep] = React.useState(0.15);
  // The recording as text (Words.tsx).
  const [wordsOpen, setWordsOpen] = React.useState(false);
  const trState = useTranscript(transcript);
  // Snapping: drags stick to the playhead, cuts, other overlays and (when
  // trimming) the edges of words and pauses. Alt while dragging, or the
  // Snap button, turns it off. `snapLine` draws the guide.
  const [snapOn, setSnapOn] = React.useState(true);
  const [snapLine, setSnapLine] = React.useState<{ row: 'src' | 'out'; x: number } | null>(null);
  const srcTrack = React.useRef<HTMLDivElement>(null);
  const outTrack = React.useRef<HTMLDivElement>(null);
  const strip = useFilmstrip(srcUrl, source, 24);

  // A clip picked by path (Recordings, the booth, a phone) may come without
  // its length: read it from the file. MediaRecorder WebM reports Infinity
  // until it is seeked to the end.
  React.useEffect(() => {
    if (!srcUrl || !clip?.path || clip.sourceSeconds) return;
    const v = document.createElement('video');
    v.preload = 'metadata';
    const done = (d: number) => {
      if (!Number.isFinite(d) || d <= 0) return;
      const keep = clip.segments?.length ? clip.segments : [{ from: clip.trimStart ?? 0, to: Math.min(d, (clip.trimStart ?? 0) + (clip.duration && clip.duration > 0 ? clip.duration : d)) }];
      change({ ...edit, clip: { ...clip, sourceSeconds: Number(d.toFixed(2)), segments: keep } });
    };
    v.onloadedmetadata = () => {
      if (v.duration === Infinity) {
        v.currentTime = 1e9;
        v.ontimeupdate = () => {
          v.ontimeupdate = null;
          done(v.duration);
        };
      } else done(v.duration);
    };
    v.src = srcUrl;
    return () => {
      v.onloadedmetadata = null;
      v.ontimeupdate = null;
      v.removeAttribute('src');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcUrl, clip?.path, clip?.sourceSeconds]);

  // Follow the Player, which may mount after this does.
  React.useEffect(() => {
    let bound: PlayerRef | null = null;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const attach = () => {
      const p = player.current;
      if (p === bound) return;
      bound?.removeEventListener('frameupdate', onFrame);
      bound?.removeEventListener('seeked', onFrame);
      bound = p;
      if (p) {
        p.addEventListener('frameupdate', onFrame);
        p.addEventListener('seeked', onFrame);
        setFrame(p.getCurrentFrame());
      }
    };
    attach();
    const t = window.setInterval(attach, 500);
    return () => {
      window.clearInterval(t);
      bound?.removeEventListener('frameupdate', onFrame);
      bound?.removeEventListener('seeked', onFrame);
    };
  }, [player]);

  const seek = (f: number) => {
    const to = Math.max(0, Math.min(outLen - 1, Math.round(f)));
    player.current?.seekTo(to);
    setFrame(to);
  };
  const inClip = frame < total;
  const srcAt = map.toSource(Math.min(frame, total - 1));

  const setSegs = (next: ReelSegment[]) => {
    if (!clip || !next.length) return;
    const clean = next.map((g) => ({ from: Number(g.from.toFixed(2)), to: Number(g.to.toFixed(2)) }));
    const kept = clean.reduce((n, g) => n + g.to - g.from, 0);
    change({ ...edit, clip: { ...clip, segments: clean, trimStart: clean[0].from, duration: Number(kept.toFixed(2)) } });
  };
  const setItems = (next: ReelOverlayItem[]) => {
    const { title: _t, lowerThird: _l, bug: _b, ...rest } = edit.overlays ?? {};
    change({ ...edit, overlays: { ...rest, items: next } });
  };
  const patchItem = (id: string, patch: Partial<ReelOverlayItem>) => setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  function split() {
    const i = segs.findIndex((g) => srcAt > g.from + MIN_SEGMENT && srcAt < g.to - MIN_SEGMENT);
    if (i < 0) return;
    setSegs([...segs.slice(0, i), { from: segs[i].from, to: srcAt }, { from: srcAt, to: segs[i].to }, ...segs.slice(i + 1)]);
    setSel({ type: 'seg', index: i + 1 });
  }
  function removeSelected() {
    if (sel?.type === 'seg' && segs.length > 1) {
      setSegs(segs.filter((_, k) => k !== sel.index));
      setSel(null);
    } else if (sel?.type === 'item') {
      setItems(items.filter((i) => i.id !== sel.id));
      setSel(null);
    }
  }
  function cutMarked() {
    if (markIn === null) return;
    const next = cutRange(segs, markIn, srcAt);
    setMarkIn(null);
    if (!next.length) return;
    setSegs(next);
    seek(mapper(next).toFrame(Math.max(markIn, srcAt)));
  }
  function addOverlay(kind: ReelOverlayKind) {
    // One subtitles item per clip: the button opens the one there is.
    const had = kind === 'subtitles' ? items.find((i) => i.kind === 'subtitles') : undefined;
    if (had) return setSel({ type: 'item', id: had.id });
    const def = OVERLAY_KINDS.find((k) => k.kind === kind)!;
    const at = kind === 'bug' || kind === 'image' || kind === 'subtitles' ? 0 : Math.min(frame, total - FPS) / FPS;
    // An FX starts as the first overlay in the catalog; its inspector picks another.
    const fx = kind === 'fx' ? fxAvailable().find((e) => e.category === 'overlay') ?? fxAvailable()[0] : undefined;
    const item: ReelOverlayItem = {
      id: Math.random().toString(36).slice(2, 10),
      kind,
      at: Number(Math.max(0, at).toFixed(1)),
      seconds: fx ? fx.seconds : def.seconds,
      ...(fx ? { fx: fx.id } : {}),
      ...(kind === 'lower' ? { style: 'panel' as const } : {}),
      ...(kind === 'bug' || kind === 'image' ? { corner: 'tr' as const } : {}),
      ...(kind === 'caption' ? { place: 'bottom' as const } : {}),
      ...(kind === 'image' ? { size: 14 } : {}),
      ...(kind === 'text' ? { x: 50, y: 50, size: 6, align: 'center' as const } : {}),
      ...(kind === 'subtitles' ? { cues: [], place: 'bottom' as const, box: true } : {}),
      ...(kind === 'sound' ? { volume: 1 } : {}),
    };
    setItems([...items, item]);
    setSel({ type: 'item', id: item.id });
  }

  // Snap targets. Source row: playhead, the other parts' edges, and the
  // transcript's word and pause edges. Edit row: start and end, playhead,
  // cuts, and the other overlays' edges (output seconds).
  const srcTargets = React.useMemo(() => {
    // The playhead is added at drag time, so this list is not rebuilt on every frame.
    const t: number[] = [0, source, ...segs.flatMap((g) => [g.from, g.to])];
    const tr = trState.tr;
    if (tr?.status === 'done') {
      // Only real breaks between words (0.12 s or more): a boundary inside
      // running speech would clip a word (tried 2026-11-01: "arise" lost).
      const w = tr.words ?? [];
      for (let i = 0; i + 1 < w.length; i++) if (w[i + 1].s - w[i].e >= 0.12) t.push(w[i].e, w[i + 1].s);
      for (const p of tr.pauses ?? []) t.push(p.s, p.e);
    }
    return t;
  }, [segs, source, trState.tr]);
  const outTargets = (except: string) => {
    const t: number[] = [0, total / FPS, Math.min(frame, total) / FPS, ...map.starts.map((f) => f / FPS)];
    for (const i of items) {
      if (i.id === except) continue;
      const sp = itemSpan(i, total);
      if (sp) t.push(sp.from / FPS, (sp.from + sp.frames) / FPS);
    }
    return t;
  };

  // Drags. A drag edits the edit on every move; the Studio saves on its own pace.
  const drag = React.useRef<{ kind: 'from' | 'to'; index: number } | { kind: 'move' | 'len'; id: string; at: number; seconds: number } | null>(null);
  const onSrcMove = React.useCallback(
    (sec: number, _dx: number, perPx: number, free: boolean) => {
      const d = drag.current;
      if (!d || (d.kind !== 'from' && d.kind !== 'to')) return;
      const g = segs[d.index];
      if (!g) return;
      const lo = d.kind === 'from' ? (segs[d.index - 1]?.to ?? 0) : g.from + MIN_SEGMENT;
      const hi = d.kind === 'from' ? g.to - MIN_SEGMENT : (segs[d.index + 1]?.from ?? source);
      // At low zoom 8 px can be over a second of recording; never reach further than 0.4 s.
      const hit = snapOn && !free ? snapTo(sec, frame < total ? [...srcTargets, map.toSource(frame)] : srcTargets, Math.min(SNAP_PX * perPx, 0.4)) : null;
      setSnapLine(hit === null ? null : { row: 'src', x: hit });
      const v = Math.max(lo, Math.min(hi, hit ?? sec));
      setSegs(segs.map((s, k) => (k === d.index ? { ...s, [d.kind]: v } : s)));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [segs, source, clip, edit, snapOn, srcTargets, frame, total, map]
  );
  const onOutMove = React.useCallback(
    (_sec: number, dx: number, perPx: number, free: boolean) => {
      const d = drag.current;
      if (!d || (d.kind !== 'move' && d.kind !== 'len')) return;
      const len = total / FPS;
      const within = snapOn && !free ? SNAP_PX * perPx : -1;
      const targets = outTargets(d.id);
      if (d.kind === 'move') {
        const span = d.seconds > 0 ? d.seconds : 0;
        let at = d.at + dx;
        // Either edge may snap; the nearer one wins.
        const a = snapTo(at, targets, within);
        const b = span ? snapTo(at + span, targets, within) : null;
        const useB = b !== null && (a === null || Math.abs(b - (at + span)) < Math.abs(a - at));
        if (useB) at = b - span;
        else if (a !== null) at = a;
        setSnapLine(a === null && b === null ? null : { row: 'out', x: useB ? b! : a! });
        patchItem(d.id, { at: Number(Math.max(0, Math.min(len - (span || 0.5), at)).toFixed(2)) });
      } else {
        const base = d.seconds > 0 ? d.seconds : len - d.at;
        const end = snapTo(d.at + base + dx, targets, within);
        setSnapLine(end === null ? null : { row: 'out', x: end });
        const seconds = end === null ? base + dx : end - d.at;
        patchItem(d.id, { seconds: Number(Math.max(0.5, Math.min(len - d.at, seconds)).toFixed(2)) });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, total, edit, snapOn, frame]
  );
  const endDrag = React.useCallback(() => {
    drag.current = null;
    setSnapLine(null);
  }, []);
  const startSrc = useDrag(onSrcMove, endDrag);
  const startOut = useDrag(onOutMove, endDrag);

  function onKey(e: React.KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select')) return;
    if (e.key === ' ') {
      e.preventDefault();
      player.current?.toggle();
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      split();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      removeSelected();
    }
  }

  const pctSrc = (x: number) => `${(x / (source || 1)) * 100}%`;
  const pctOut = (f: number) => `${(f / outLen) * 100}%`;
  const clickTrack = (e: React.MouseEvent, length: number) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * length;
  };
  const gaps = gapsOf(segs, source);
  const { placed, count: laneCount } = lanes(items, total);
  const selItem = sel?.type === 'item' ? items.find((i) => i.id === sel.id) : undefined;
  const selSeg = sel?.type === 'seg' ? segs[sel.index] : undefined;
  const subs = items.find((i) => i.kind === 'subtitles');
  const pauseMarks = pausesOpen ? findPauses(trState, pauseMin, pauseKeep).list.filter((p) => keptOf(p, segs) > 0.05) : [];
  const width = { width: `${zoom * 100}%` };

  if (!clip?.path) return <p className="vs-faint tl-empty">Add the clip in Slots first; its timeline shows here.</p>;

  return (
    <div className="tl" tabIndex={0} onKeyDown={onKey} aria-label="Timeline">
      <div className="tl-bar">
        <button type="button" className="studio-btn" onClick={() => player.current?.toggle()} title="Play or pause (space)">
          ▶︎ ❚❚
        </button>
        <span className="tl-time">
          {fmtTime(frame / FPS)} / {fmtTime(outLen / FPS)}
          {inClip && <small> · recording {fmtTime(srcAt)}</small>}
        </span>
        <span className="tl-grow" />
        {history && (
          <>
            <button type="button" className="studio-btn" disabled={!history.canUndo} onClick={history.undo} title="Undo (Ctrl+Z)" aria-label="Undo">
              ↶
            </button>
            <button type="button" className="studio-btn" disabled={!history.canRedo} onClick={history.redo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
              ↷
            </button>
          </>
        )}
        <button type="button" className="studio-btn" aria-pressed={snapOn} onClick={() => setSnapOn(!snapOn)} title="Drags stick to the playhead, cuts, overlays and word edges (hold Alt to drag freely)">
          Snap
        </button>
        <button type="button" className="studio-btn" disabled={!inClip} onClick={split} title="Split the part under the playhead (S)">
          Split
        </button>
        {markIn === null ? (
          <button type="button" className="studio-btn" disabled={!inClip} onClick={() => setMarkIn(srcAt)} title="Mark the start of a stretch to cut out">
            Cut from here…
          </button>
        ) : (
          <>
            <button type="button" className="studio-btn studio-btn--primary" disabled={!inClip || Math.abs(srcAt - markIn) < MIN_SEGMENT} onClick={cutMarked}>
              …to here (cut {fmtTime(Math.abs(srcAt - markIn))})
            </button>
            <button type="button" className="vs-link" onClick={() => setMarkIn(null)}>
              Cancel
            </button>
          </>
        )}
        <button type="button" className="studio-btn" aria-pressed={wordsOpen} onClick={() => setWordsOpen(!wordsOpen)} title="Read, search and cut the recording by its words">
          Words…
        </button>
        <button type="button" className="studio-btn" aria-pressed={pausesOpen} onClick={() => setPausesOpen(!pausesOpen)} title="Find the silences and cut them">
          Pauses…
        </button>
        <label className="tl-zoom">
          Zoom
          <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
            {[1, 2, 4, 8, 16, 32].map((z) => (
              <option key={z} value={z}>
                {z}×
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="tl-row">
        <span className="tl-label">Recording</span>
        <div className="tl-scroll">
          <div
            className="tl-track tl-src"
            ref={srcTrack}
            style={width}
            onClick={(e) => {
              const x = clickTrack(e, source);
              const gap = gaps.find((g) => x >= g.from && x <= g.to);
              if (gap) setSel({ type: 'gap', ...gap });
              else setSel({ type: 'seg', index: segs.findIndex((g) => x >= g.from && x <= g.to) });
              seek(map.toFrame(x));
            }}
          >
            <div className="tl-strip">
              {strip.map((src, k) => (src ? <img key={k} src={src} alt="" /> : <span key={k} />))}
            </div>
            <Waveform peaks={trState.tr?.peaks} source={source} />
            {gaps.map((g) => (
              <div
                key={`g${g.from}`}
                className="tl-gap"
                data-sel={sel?.type === 'gap' && Math.abs(sel.from - g.from) < 0.01 ? 'true' : undefined}
                style={{ left: pctSrc(g.from), width: pctSrc(g.to - g.from) }}
                title={`Cut out: ${fmtTime(g.from)}–${fmtTime(g.to)}`}
              />
            ))}
            {segs.map((g, k) => (
              <div
                key={`s${k}`}
                className="tl-keep"
                data-sel={sel?.type === 'seg' && sel.index === k ? 'true' : undefined}
                style={{ left: pctSrc(g.from), width: pctSrc(g.to - g.from) }}
              >
                <span
                  className="tl-handle tl-handle--l"
                  title="Drag to trim the start"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => {
                    drag.current = { kind: 'from', index: k };
                    startSrc(e, srcTrack.current, source);
                  }}
                />
                <span
                  className="tl-handle tl-handle--r"
                  title="Drag to trim the end"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => {
                    drag.current = { kind: 'to', index: k };
                    startSrc(e, srcTrack.current, source);
                  }}
                />
              </div>
            ))}
            {pausesOpen &&
              pauseMarks.map((p) => (
                <div
                  key={`p${p.s}`}
                  className="tl-pause"
                  style={{ left: pctSrc(p.a), width: pctSrc(p.b - p.a) }}
                  title={`Pause ${fmtTime(p.s)}, ${(p.e - p.s).toFixed(1)} s: click to cut`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSegs(cutRange(segs, p.a, p.b));
                  }}
                />
              ))}
            {markIn !== null && <div className="tl-mark" style={{ left: pctSrc(Math.min(markIn, srcAt)), width: pctSrc(Math.abs(srcAt - markIn)) }} />}
            {inClip && <div className="tl-head" style={{ left: pctSrc(srcAt) }} />}
            {snapLine?.row === 'src' && <div className="tl-snap" style={{ left: pctSrc(snapLine.x) }} />}
          </div>
        </div>
      </div>

      <div className="tl-row">
        <span className="tl-label">Edit</span>
        <div className="tl-scroll">
          <div className="tl-out" style={width}>
            <div className="tl-track tl-edit" ref={outTrack} onClick={(e) => seek(clickTrack(e, outLen))}>
              {segs.map((g, k) => (
                <div
                  key={k}
                  className="tl-part"
                  data-sel={sel?.type === 'seg' && sel.index === k ? 'true' : undefined}
                  style={{ left: pctOut(map.starts[k]), width: pctOut(segmentFrames(g)) }}
                  onClick={(e) => {
                    // Seek by the whole edit track, not the part.
                    e.stopPropagation();
                    const rect = outTrack.current!.getBoundingClientRect();
                    seek(((e.clientX - rect.left) / rect.width) * outLen);
                    setSel({ type: 'seg', index: k });
                  }}
                >
                  <span>{segs.length > 1 ? `Part ${k + 1} · ` : ''}{fmtTime(g.to - g.from)}</span>
                </div>
              ))}
              {endCard && (
                <div className="tl-part tl-endcard" style={{ left: pctOut(total), width: pctOut(END_SEC * FPS) }}>
                  <span>End card</span>
                </div>
              )}
              <div className="tl-head" style={{ left: pctOut(frame) }} />
            </div>
            <div
              className="tl-track tl-lanes"
              style={{ height: `${laneCount * 30 + 6}px` }}
              onClick={(e) => {
                setSel(null);
                seek(clickTrack(e, outLen));
              }}
            >
              {snapLine?.row === 'out' && <div className="tl-snap" style={{ left: pctOut(snapLine.x * FPS) }} />}
              {placed.map(({ i, from, to, row }) => (
                <div
                  key={i.id}
                  className="tl-item"
                  data-kind={i.kind}
                  data-sel={sel?.type === 'item' && sel.id === i.id ? 'true' : undefined}
                  data-empty={emptyItem(i) ? 'true' : undefined}
                  style={{ left: pctOut(from), width: pctOut(Math.max(to - from, 6)), top: row * 30 + 3 }}
                  title={`${KIND_LABEL[i.kind]}: ${fmtTime(from / FPS)}–${fmtTime(to / FPS)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSel({ type: 'item', id: i.id });
                  }}
                  onPointerDown={(e) => {
                    setSel({ type: 'item', id: i.id });
                    drag.current = { kind: 'move', id: i.id, at: i.at, seconds: i.seconds };
                    startOut(e, outTrack.current, total / FPS);
                  }}
                >
                  <span>{itemLabel(i)}</span>
                  {!fixedLength(i) && (
                    <span
                      className="tl-handle tl-handle--r"
                      title="Drag to lengthen"
                      onPointerDown={(e) => {
                        drag.current = { kind: 'len', id: i.id, at: i.at, seconds: i.seconds };
                        startOut(e, outTrack.current, total / FPS);
                      }}
                    />
                  )}
                </div>
              ))}
              <div className="tl-head" style={{ left: pctOut(frame) }} />
            </div>
            {subs?.cues?.length ? (
              <div className="tl-track tl-cues" onClick={(e) => seek(clickTrack(e, outLen))}>
                {subs.cues.flatMap((c) =>
                  cueOutput(c, segs).map((r, k) => (
                    <div
                      key={`${c.id}-${k}`}
                      className="tl-cue"
                      style={{ left: pctOut(r.from * FPS), width: pctOut(Math.max((r.to - r.from) * FPS, 3)) }}
                      title={c.text}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSel({ type: 'item', id: subs.id });
                        seek(r.from * FPS + 1);
                      }}
                    />
                  ))
                )}
                <div className="tl-head" style={{ left: pctOut(frame) }} />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="tl-add">
        <span className="tl-label">Add</span>
        {OVERLAY_KINDS.filter((k) => k.kind !== 'sound' || sounds).map((k) => (
          <button key={k.kind} type="button" className="studio-btn" data-kind={k.kind} onClick={() => addOverlay(k.kind)}>
            + {k.label}
          </button>
        ))}
      </div>

      {wordsOpen && (
        <WordsPanel
          state={trState}
          segs={segs}
          srcAt={inClip ? srcAt : null}
          seekSource={(x) => seek(map.toFrame(x))}
          cut={(a, b) => {
            const next = cutRange(segs, a, b);
            if (next.length) setSegs(next);
          }}
          putBack={(a, b) => setSegs(keepRange(segs, a, b))}
          close={() => setWordsOpen(false)}
        />
      )}

      {pausesOpen && (
        <PausesPanel
          state={trState}
          segs={segs}
          min={pauseMin}
          keep={pauseKeep}
          setMin={setPauseMin}
          setKeep={setPauseKeep}
          cut={(ranges) => {
            const next = ranges.reduce((g, r) => cutRange(g, r.a, r.b), segs);
            if (next.length) setSegs(next);
          }}
          seekSource={(x) => seek(map.toFrame(x))}
          close={() => setPausesOpen(false)}
        />
      )}

      {sel?.type === 'gap' && (
        <section className="vs-slot tl-inspect">
          <p>
            Cut out: {fmtTime(sel.from)}–{fmtTime(sel.to)} of the recording ({fmtTime(sel.to - sel.from)}).
          </p>
          <button
            type="button"
            className="studio-btn"
            onClick={() => {
              setSegs(keepRange(segs, sel.from, sel.to));
              setSel(null);
            }}
          >
            Put it back
          </button>
        </section>
      )}

      {selSeg && sel?.type === 'seg' && (
        <section className="vs-slot tl-inspect">
          <header>
            <b>{segs.length > 1 ? `Part ${sel.index + 1}` : 'The clip'}</b>
            {segs.length > 1 && (
              <button type="button" className="vs-link" onClick={removeSelected}>
                Cut this part out
              </button>
            )}
          </header>
          <div className="vs-row">
            <TimeField
              label="From"
              value={selSeg.from}
              onChange={(v) => setSegs(segs.map((g, k) => (k === sel.index ? { ...g, from: Math.max(segs[k - 1]?.to ?? 0, Math.min(v, g.to - MIN_SEGMENT)) } : g)))}
            />
            <TimeField
              label="To"
              value={selSeg.to}
              onChange={(v) => setSegs(segs.map((g, k) => (k === sel.index ? { ...g, to: Math.min(segs[k + 1]?.from ?? source, Math.max(v, g.from + MIN_SEGMENT)) } : g)))}
            />
            <button
              type="button"
              className="studio-btn"
              disabled={!inClip || srcAt <= selSeg.from || srcAt >= selSeg.to - MIN_SEGMENT}
              onClick={() => setSegs(segs.map((g, k) => (k === sel.index ? { ...g, from: srcAt } : g)))}
            >
              Start at playhead
            </button>
            <button
              type="button"
              className="studio-btn"
              disabled={!inClip || srcAt >= selSeg.to || srcAt <= selSeg.from + MIN_SEGMENT}
              onClick={() => setSegs(segs.map((g, k) => (k === sel.index ? { ...g, to: srcAt } : g)))}
            >
              End at playhead
            </button>
          </div>
          <p className="vs-faint">Times are in the recording ({fmtTime(source)} long). Drag the part’s edges on the Recording row to trim it.</p>
        </section>
      )}

      {selItem && (
        <OverlayInspector
          item={selItem}
          total={total / FPS}
          playhead={Math.min(frame, total - 1) / FPS}
          cuts={cutFrames(segs).map((f) => f / FPS)}
          patch={(p) => patchItem(selItem.id, p)}
          remove={removeSelected}
          duplicate={() => {
            const copy = { ...selItem, id: Math.random().toString(36).slice(2, 10), at: Number(Math.min(total / FPS - 1, selItem.at + (selItem.seconds || 1)).toFixed(1)) };
            setItems([...items, copy]);
            setSel({ type: 'item', id: copy.id });
          }}
          pickImage={
            library
              ? () => setImageFor(imageFor === selItem.id ? null : selItem.id)
              : undefined
          }
          uploadImage={uploadImage ? async (f) => {
            const ref = await uploadImage(f);
            if (ref) patchItem(selItem.id, { image: ref });
          } : undefined}
          editImage={
            editImage && selItem.image?.path && /\.(jpe?g|png|webp)$/i.test(selItem.image.path)
              ? async () => {
                  const id = selItem.id;
                  const ref = await editImage(selItem.image!);
                  if (ref) patchItem(id, { image: ref });
                }
              : undefined
          }
          sound={selItem.kind === 'sound' && sounds ? <SoundFields item={selItem} patch={(p) => patchItem(selItem.id, p)} lib={sounds} /> : undefined}
          subtitles={
            selItem.kind === 'subtitles' ? (
              <SubtitlesPanel
                item={selItem}
                patch={(p) => patchItem(selItem.id, p)}
                segs={segs}
                srcAt={inClip ? srcAt : null}
                seekSource={(x) => seek(map.toFrame(x))}
                cutSource={(a, b) => {
                  const next = cutRange(segs, a, b);
                  if (next.length) setSegs(next);
                }}
                addText={(t) => {
                  const copy = { ...t, id: Math.random().toString(36).slice(2, 10) } as ReelOverlayItem;
                  setItems([...items, copy]);
                  setSel({ type: 'item', id: copy.id });
                }}
                transcript={trState}
                name={name}
              />
            ) : undefined
          }
        />
      )}
      {selItem && imageFor === selItem.id && library && (
        <SlotLibrary
          kinds={['image']}
          endpoint={library.endpoint}
          mediaBase={library.mediaBase}
          finished={null}
          onPick={(p) => {
            patchItem(selItem.id, { image: { path: p.path, name: p.name } });
            setImageFor(null);
          }}
          onClose={() => setImageFor(null)}
        />
      )}
      <p className="vs-faint tl-keys">Space plays · S splits · Delete removes the selected part or overlay · Ctrl+Z undoes · Alt while dragging turns snapping off.</p>
    </div>
  );
}

/** The FX inspector: which FX (grouped as in the catalog), a call's price line, and where a transition sits. */
function FxFields({ item, cuts, patch }: { item: ReelOverlayItem; cuts: number[]; patch(p: Partial<ReelOverlayItem>): void }) {
  const e = fxEntry(item.fx);
  const snap = nearestCut(cuts, item.at);
  const pick = (id: string) => {
    const next = fxEntry(id);
    if (!next) return;
    const p: Partial<ReelOverlayItem> = { fx: next.id, seconds: next.category === 'loop' ? (e?.category === 'loop' ? item.seconds : next.seconds) : next.seconds };
    // A transition belongs on a cut: move it to the nearest one within 2 s.
    const near = next.category === 'transition' ? nearestCut(cuts, item.at, 2) : null;
    if (near !== null) p.at = Number(near.toFixed(2));
    patch(p);
  };
  return (
    <>
      <label className="vs-field">
        FX
        <select value={e?.id ?? ''} onChange={(ev) => pick(ev.target.value)}>
          {!e && <option value="">Choose…</option>}
          {(Object.keys(FX_CATEGORY_LABEL) as FxCategory[]).map((cat) => (
            <optgroup key={cat} label={FX_CATEGORY_LABEL[cat]}>
              {fxAvailable().filter((x) => x.category === cat).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label} ({x.seconds} s)
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {e?.call && (
        <label className="vs-field">
          Price or line under the word (optional)
          <input value={item.sub ?? ''} maxLength={60} onChange={(ev) => patch({ sub: ev.target.value })} />
        </label>
      )}
      {e?.category === 'overlay' && <p className="vs-faint">Plays once, {e.seconds} s, over everything.</p>}
      {e?.category === 'loop' && <p className="vs-faint">Repeats every {e.seconds} s for as long as it is set (For, or Until the end).</p>}
      {e?.category === 'transition' && (
        <div className="vs-row">
          <p className="vs-faint">
            {e.seconds} s from a cut: the part before carries on under the effect and the next part comes in through it.
            {snap === null ? ' This clip has no cuts yet: split it first.' : Math.abs(snap - item.at) > 0.05 ? ' It is not on a cut.' : ''}
          </p>
          {snap !== null && Math.abs(snap - item.at) > 0.05 && (
            <button type="button" className="studio-btn" onClick={() => patch({ at: Number(snap.toFixed(2)) })}>
              Move to the nearest cut ({fmtTime(snap)})
            </button>
          )}
        </div>
      )}
    </>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: number; onChange(v: number): void }) {
  const [text, setText] = React.useState(fmtTime(value));
  React.useEffect(() => setText(fmtTime(value)), [value]);
  return (
    <label className="vs-field tl-timefield">
      {label}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const v = parseTime(text);
          if (v === null) setText(fmtTime(value));
          else onChange(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

function OverlayInspector({
  item,
  total,
  playhead,
  cuts = [],
  patch,
  remove,
  duplicate,
  pickImage,
  uploadImage,
  editImage,
  subtitles,
  sound,
}: {
  item: ReelOverlayItem;
  total: number;
  playhead: number;
  /** Where kept parts meet, in the edit's seconds (FX transitions snap to these). */
  cuts?: number[];
  patch(p: Partial<ReelOverlayItem>): void;
  remove(): void;
  duplicate(): void;
  pickImage?(): void;
  uploadImage?(f: File): Promise<void>;
  editImage?(): Promise<void>;
  /** The subtitles panel, built by the Timeline (it needs the cuts and the playhead). */
  subtitles?: React.ReactNode;
  /** The sound picker (Sounds.tsx). */
  sound?: React.ReactNode;
}) {
  const [uploading, setUploading] = React.useState(false);
  const k = item.kind;
  const text = (label: string, multi = false, max = 160) => (
    <label className="vs-field">
      {label}
      {multi ? (
        <textarea rows={3} maxLength={max} value={item.text ?? ''} onChange={(e) => patch({ text: e.target.value })} />
      ) : (
        <input value={item.text ?? ''} maxLength={max} onChange={(e) => patch({ text: e.target.value })} />
      )}
    </label>
  );
  const sub = (label: string, max = 120) => (
    <label className="vs-field">
      {label}
      <input value={item.sub ?? ''} maxLength={max} onChange={(e) => patch({ sub: e.target.value })} />
    </label>
  );
  const corner = (
    <label className="vs-field">
      Corner
      <select value={item.corner ?? 'tr'} onChange={(e) => patch({ corner: e.target.value as ReelOverlayItem['corner'] })}>
        <option value="tl">Top left</option>
        <option value="tr">Top right</option>
        <option value="bl">Bottom left</option>
        <option value="br">Bottom right</option>
      </select>
    </label>
  );
  return (
    <section className="vs-slot tl-inspect" data-kind={k}>
      <header>
        <b>{KIND_LABEL[k]}</b>
        <span>
          {k !== 'subtitles' && (
            <button type="button" className="vs-link" onClick={duplicate}>
              Duplicate
            </button>
          )}{' '}
          <button type="button" className="vs-link" onClick={remove}>
            Remove
          </button>
        </span>
      </header>
      {k === 'title' && (
        <>
          {text('Title', false, 120)}
          {sub('Subtitle', 160)}
        </>
      )}
      {k === 'lower' && (
        <>
          {text('Name', false, 80)}
          {sub('Role or line')}
          <label className="vs-field">
            Style
            <select value={item.style ?? 'panel'} onChange={(e) => patch({ style: e.target.value as ReelOverlayItem['style'] })}>
              <option value="panel">Panel (fade and slide)</option>
              <option value="slash">Slash</option>
              <option value="reveal">Reveal</option>
              <option value="fade">Fade</option>
            </select>
          </label>
        </>
      )}
      {k === 'caption' && (
        <>
          {text('Text', true, 300)}
          <label className="vs-field">
            Place
            <select value={item.place ?? 'bottom'} onChange={(e) => patch({ place: e.target.value as 'top' | 'bottom' })}>
              <option value="bottom">Bottom</option>
              <option value="top">Top</option>
            </select>
          </label>
        </>
      )}
      {k === 'quote' && (
        <>
          {text('Quote', true, 400)}
          {sub('Who said it')}
        </>
      )}
      {k === 'bug' && (
        <div className="vs-row">
          {text('Text', false, 60)}
          {corner}
        </div>
      )}
      {k === 'image' && (
        <>
          <p className="vs-file">{item.image?.name ?? item.image?.path?.split('/').pop() ?? 'No picture yet'}</p>
          <div className="vs-row">
            {pickImage && (
              <button type="button" className="studio-btn" onClick={pickImage}>
                From my files…
              </button>
            )}
            {editImage && (
              <button type="button" className="studio-btn" title="Crop, filters, text…" onClick={() => void editImage()}>
                Edit picture…
              </button>
            )}
            {uploadImage && (
              <label className="studio-btn">
                {uploading ? 'Uploading…' : 'Upload…'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  hidden
                  disabled={uploading}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    setUploading(true);
                    await uploadImage(f);
                    setUploading(false);
                  }}
                />
              </label>
            )}
          </div>
          <div className="vs-row">
            {corner}
            <label className="vs-field">
              Size ({item.size ?? 14}%)
              <input type="range" min={5} max={60} step={1} value={item.size ?? 14} onChange={(e) => patch({ size: Number(e.target.value) })} />
            </label>
          </div>
        </>
      )}
      {k === 'ticker' && (
        <>
          {text('Text', false, 400)}
          {sub('Label (optional, e.g. “Notice”)', 30)}
        </>
      )}
      {k === 'fx' && <FxFields item={item} cuts={cuts} patch={patch} />}
      {k === 'text' && <TextFields item={item} patch={patch} />}
      {k === 'subtitles' && subtitles}
      {k === 'sound' && sound}
      {k !== 'subtitles' && <div className="vs-row">
        <TimeField label="From" value={item.at} onChange={(v) => patch({ at: Number(Math.max(0, Math.min(total - 0.5, v)).toFixed(1)) })} />
        {item.seconds > 0 && !fixedLength(item) && (
          <label className="vs-field">
            For (s)
            <input
              type="number"
              min={k === 'sound' ? 0.1 : 0.5}
              step={k === 'sound' ? 0.1 : 0.5}
              value={item.seconds}
              onChange={(e) => patch({ seconds: Math.max(k === 'sound' ? 0.1 : 0.5, Number(e.target.value) || 0.5) })}
            />
          </label>
        )}
        {!fixedLength(item) && k !== 'sound' && (
          <label className="vs-check">
            <input
              type="checkbox"
              checked={item.seconds === 0}
              onChange={(e) => patch({ seconds: e.target.checked ? 0 : Math.max(1, Math.min(5, Number((total - item.at).toFixed(1)))) })}
            />
            Until the end
          </label>
        )}
        <button type="button" className="studio-btn" onClick={() => patch({ at: Number(playhead.toFixed(1)) })}>
          Start at playhead
        </button>
      </div>}
    </section>
  );
}

// A capture edit (the phone's <recording>.edit.json) -> a ReelEdit for the
// clip template. Pure: no I/O. The caller creates the project
// (createReelProject), fills clip.path / sound refs with real Nextcloud paths,
// saves (saveReelProject) and queues (queueReelRender).
//
// Renderer facts (templates/clip.tsx): segments are joined with HARD cuts
// (Series, no overlap), so edited time = earlier segments' length + offset;
// music volume is 0-1 (default 0.7, x0.25 while the roll has voice); a sound
// overlay's volume is 0-1.5 (default 1); ReelMediaRef = { path, name? };
// there is no fade-in or crossfade.

import type { ReelEdit, ReelMediaRef, ReelOverlayItem } from '../types';
import { machineRecipe } from './machine';

/** Structural twin of @elkdonis/studio capture `TakeEdit` (capture/aids/types.ts); local so reels does not import the phone UI. */
export interface CaptureEditLike {
  preset?: string;
  shots?: Array<{ shot: string; say?: string; from: number; to: number; marks?: Array<{ name: string; t: number }> }>;
  clip: { path?: string; segments: Array<{ from: number; to: number }> };
  /** Capture's mark overlays; `at` is already edited time. Used when shots carry no marks. */
  overlays?: Array<{ id?: string; at: number; note?: string }>;
}

export interface FromCaptureOpts {
  /** Nextcloud path of the roll (defaults to edit.clip.path). */
  clipPath?: string;
  clipName?: string;
  title?: string;
  sub?: string;
  caption?: string;
  /** Sound library refs by key (felt_hit). A missing one leaves an inert sound item at the right time. */
  sounds?: Record<string, ReelMediaRef | undefined>;
  /** Music bed refs by key (warm_pad). */
  music?: Record<string, ReelMediaRef | undefined>;
  format?: ReelEdit['format'];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Edited-time position of every named mark. */
export function markTimes(e: CaptureEditLike): Record<string, number> {
  const segs = e.clip.segments;
  const starts: number[] = [];
  let acc = 0;
  for (const s of segs) {
    starts.push(acc);
    acc += s.to - s.from;
  }
  const out: Record<string, number> = {};
  for (const sh of e.shots ?? [])
    for (const m of sh.marks ?? []) {
      const k = segs.findIndex((s) => m.t >= s.from - 0.01 && m.t <= s.to + 0.01);
      if (k >= 0 && !(m.name in out)) out[m.name] = r2(starts[k] + Math.max(0, m.t - segs[k].from));
    }
  for (const o of e.overlays ?? []) {
    const n = /mark-(.+)-\d+$/.exec(o.id ?? '')?.[1] ?? /'([^']+)'/.exec(o.note ?? '')?.[1];
    if (n && !(n in out)) out[n] = r2(o.at);
  }
  return out;
}

export function editFromCapture(e: CaptureEditLike, preset: string = e.preset ?? '', opts: FromCaptureOpts = {}): ReelEdit {
  const recipe = machineRecipe(preset);
  const segs = e.clip.segments.map((s) => ({ from: s.from, to: s.to }));
  const total = segs.reduce((n, s) => n + (s.to - s.from), 0);
  const marks = markTimes(e);
  const items: ReelOverlayItem[] = [];
  let music: ReelEdit['music'];
  for (const st of recipe.steps) {
    const base = st.mark ? marks[st.mark] ?? total / 2 : 0;
    const at = r2(base + (st.offset ?? 0));
    if (st.kind === 'title') items.push({ id: 'title', kind: 'title', at, seconds: st.seconds ?? 3, text: opts.title ?? 'New piece', sub: opts.sub });
    else if (st.kind === 'caption') items.push({ id: `cap-${st.mark ?? 'start'}`, kind: 'caption', at, seconds: st.seconds ?? 2.6, text: opts.caption ?? 'Where it went wrong', place: st.place });
    else if (st.kind === 'sound') {
      const ref = opts.sounds?.[st.sound ?? ''];
      items.push({ id: `hit-${st.mark ?? 'start'}`, kind: 'sound', at, seconds: st.seconds ?? 1, ...(ref ? { sound: ref } : {}), volume: st.volume ?? 1 });
    } else if (st.kind === 'subtitles') items.push({ id: 'subtitles', kind: 'subtitles', at: 0, seconds: 0, place: st.place, cues: [] });
    else if (st.kind === 'music') {
      const ref = opts.music?.[st.sound ?? ''];
      if (ref) music = { ...ref, volume: st.volume };
    }
  }
  return {
    template: 'clip',
    format: opts.format ?? 'portrait',
    fit: 'cover',
    clip: { path: opts.clipPath ?? e.clip.path ?? '', name: opts.clipName ?? 'roll', voice: recipe.voice, segments: segs },
    overlays: { items },
    levelAudio: true,
    ...(music ? { music } : {}),
  };
}

// Takes -> edit JSON. Pure: no DOM, no clock. Mirrors the prototype's edit().

import type { CapturePreset, SoundOverlay, TakeEdit, TakeRecord } from './types';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Kept takes become clip segments in source seconds; each mark becomes a
 *  sound overlay at its place on the edited timeline (earlier segments' length
 *  plus the offset into its own segment). */
export function buildEdit(preset: Pick<CapturePreset, 'id' | 'shots'>, takes: TakeRecord[], clipPath = ''): TakeEdit {
  const kept = takes.filter((t) => t.kept);
  const overlays: SoundOverlay[] = [];
  let acc = 0;
  for (const t of kept) {
    for (const m of t.marks) {
      overlays.push({
        id: `mark-${m.name}-${overlays.length + 1}`,
        kind: 'sound',
        at: r2(acc + (m.t - t.from)),
        seconds: 0,
        sound: null,
        volume: 1,
        note: `music hit on '${m.name}'`,
      });
    }
    acc += t.to - t.from;
  }
  return {
    preset: preset.id,
    shots: kept.map((t) => ({ shot: t.shot, say: t.say, from: r2(t.from), to: r2(t.to), marks: t.marks })),
    clip: { path: clipPath, segments: kept.map((t) => ({ from: r2(t.from), to: r2(t.to) })) },
    overlays,
    machine: preset.shots.filter((s) => s.by === 'machine').map((s) => ({ shot: s.id, say: s.say, engine: s.engine })),
  };
}

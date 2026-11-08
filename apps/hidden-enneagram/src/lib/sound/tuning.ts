import { centsToValue, valueToCents } from "xen-dev-utils";
import { Note } from "tonal";

// ============================================================================
// Tunings for the nine points (pure; no audio, no DOM). Part of the app-local
// sound engine (src/lib/sound/), written to lift out into a package later:
// nothing in src/lib/sound imports from the app.
//
// The default is Ouspensky's octave on the enneagram (In Search of the
// Miraculous, ch. 14, p. 291): 9 = do, 1 = re, 2 = mi, 4 = fa, 5 = sol,
// 7 = la, 8 = si. Points 3 and 6 are the two "shocks" that fill the intervals:
// events, not scale degrees, so they have no pitch here and sound as noise.
//
// The other two are interpretations (docs/audio-research.md, 3.6):
//   passing   Ouspensky's octave, with 3 and 6 pitched halfway between their
//             neighbours (3 between mi and fa, 6 between sol and la): the
//             interval heard as in-between-ness. Layout B.
//   harmonic  the harmonic series 9 to 18: point k is partial (9 + k) / 9, so
//             the 3-6-9 triangle is 12:15:18 = 4:5:6, a pure major triad.
//             Layout C.
// The diatonic seven can sit in just, equal or Pythagorean tuning.
// ============================================================================

export type Point = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type TuningKey = "ouspensky" | "passing" | "harmonic";
export type Temperament = "just" | "equal" | "pythagorean";

export const TUNINGS: ReadonlyArray<{ value: TuningKey; label: string; interpretive: boolean; note: string }> = [
  {
    value: "ouspensky",
    label: "Ouspensky's octave",
    interpretive: false,
    note: "9 do, 1 re, 2 mi, 4 fa, 5 sol, 7 la, 8 si; 3 and 6 are the shocks (In Search of the Miraculous, ch. 14).",
  },
  {
    value: "passing",
    label: "Shocks as passing tones (an interpretation)",
    interpretive: true,
    note: "Ouspensky's octave, with 3 and 6 sounded halfway between their neighbours.",
  },
  {
    value: "harmonic",
    label: "Harmonic series 9 to 18 (an interpretation)",
    interpretive: true,
    note: "Point k is the partial (9 + k) / 9; the triangle 3-6-9 is 4:5:6, a pure major triad.",
  },
];

export const TEMPERAMENTS: ReadonlyArray<{ value: Temperament; label: string }> = [
  { value: "just", label: "Just intonation" },
  { value: "equal", label: "Equal temperament" },
  { value: "pythagorean", label: "Pythagorean" },
];

export const isTuning = (v: unknown): v is TuningKey => v === "ouspensky" || v === "passing" || v === "harmonic";
export const isTemperament = (v: unknown): v is Temperament => v === "just" || v === "equal" || v === "pythagorean";

/** Ouspensky's placement: the scale degree (0 = do ... 6 = si) of each pitched point. */
export const DEGREE: Partial<Record<Point, number>> = { 9: 0, 1: 1, 2: 2, 4: 3, 5: 4, 7: 5, 8: 6 };
export const SOLFEGE = ["do", "re", "mi", "fa", "sol", "la", "si"] as const;
export const SHOCKS: readonly Point[] = [3, 6];

const RATIOS: Record<Exclude<Temperament, "equal">, readonly (readonly [number, number])[]> = {
  just: [[1, 1], [9, 8], [5, 4], [4, 3], [3, 2], [5, 3], [15, 8]],
  pythagorean: [[1, 1], [9, 8], [81, 64], [4, 3], [3, 2], [27, 16], [243, 128]],
};
const EQUAL = [0, 200, 400, 500, 700, 900, 1100];

/** Cents above do of scale degree `d` (0-6) in a temperament. */
export function degreeCents(d: number, t: Temperament): number {
  if (t === "equal") return EQUAL[d]!;
  const [n, m] = RATIOS[t][d]!;
  return valueToCents(n / m);
}

export interface PointTone {
  point: Point;
  /** "note": a pitch; "shock": an interval, sounded unpitched. */
  kind: "note" | "shock";
  /** Cents above do (null for an unpitched shock). */
  cents: number | null;
  /** What the point is called in this tuning: do, re ... or "shock", "partial 13". */
  name: string;
  /** The ratio to do where there is a small one ("9/8", "13/9"). */
  ratio?: string;
}

/** What a point sounds as in a tuning. */
export function toneOf(point: Point, tuning: TuningKey = "ouspensky", temperament: Temperament = "just"): PointTone {
  if (tuning === "harmonic") {
    const partial = point === 9 ? 9 : 9 + point;
    return { point, kind: "note", cents: valueToCents(partial / 9), name: point === 9 ? "do" : `partial ${partial}`, ratio: `${partial}/9` };
  }
  const d = DEGREE[point];
  if (d !== undefined) {
    const r = temperament === "equal" ? undefined : RATIOS[temperament][d]!;
    return { point, kind: "note", cents: degreeCents(d, temperament), name: SOLFEGE[d]!, ratio: r ? `${r[0]}/${r[1]}` : undefined };
  }
  // 3 sits between mi (2) and fa (4); 6 between sol (5) and la (7).
  if (tuning === "passing") {
    const [lo, hi] = point === 3 ? [2, 3] : [4, 5];
    return { point, kind: "note", cents: (degreeCents(lo!, temperament) + degreeCents(hi!, temperament)) / 2, name: "passing tone" };
  }
  return { point, kind: "shock", cents: null, name: "shock" };
}

/** Frequency of a point given do's frequency; `octaves` shifts it (1 = the higher do). */
export function freqOf(point: Point, doHz: number, tuning: TuningKey, temperament: Temperament, octaves = 0): number | null {
  const tone = toneOf(point, tuning, temperament);
  if (tone.cents === null) return null;
  return doHz * centsToValue(tone.cents) * 2 ** octaves;
}

/** do's frequency from a note name ("C4", "D3", "A"); falls back to C4. */
export function tonicHz(name: string | undefined): number {
  const n = Note.get(name && /\d$/.test(name) ? name : `${name || "C"}4`);
  return n.freq ?? 261.63;
}

/** The nearest equal-tempered note for a frequency, and how far off it is. */
export function nearestNote(hz: number): { name: string; pc: string; chroma: number; cents: number } {
  const midi = 69 + 12 * Math.log2(hz / 440);
  const round = Math.round(midi);
  const name = Note.fromMidiSharps(round);
  return { name, pc: Note.pitchClass(name), chroma: ((round % 12) + 12) % 12, cents: Math.round((midi - round) * 100) };
}

/**
 * Where a heard frequency lands on the nine points: the pitched point nearest
 * to it once folded into do's octave, and how sharp (+) or flat (-) it is.
 */
export function landOf(hz: number, doHz: number, tuning: TuningKey, temperament: Temperament): { point: Point; cents: number } {
  let c = valueToCents(hz / doHz) % 1200;
  if (c < 0) c += 1200;
  let best: { point: Point; cents: number } = { point: 9, cents: c > 600 ? c - 1200 : c };
  for (const p of [1, 2, 3, 4, 5, 6, 7, 8, 9] as Point[]) {
    const t = toneOf(p, tuning, temperament);
    if (t.cents === null) continue;
    for (const target of [t.cents, t.cents + 1200, t.cents - 1200]) {
      const off = c - target;
      if (Math.abs(off) < Math.abs(best.cents)) best = { point: p, cents: off };
    }
  }
  return { point: best.point, cents: Math.round(best.cents) };
}

/** Pitch-class chroma (C = 0) of a point's note in equal temperament, given do's chroma. */
export function chromaOf(point: Point, doChroma: number, tuning: TuningKey, temperament: Temperament): number | null {
  const t = toneOf(point, tuning, temperament);
  if (t.cents === null) return null;
  return (doChroma + Math.round(t.cents / 100)) % 12;
}

import type { Point } from "./tuning";

// ============================================================================
// What the figure plays (pure). The hexad 1-4-2-8-5-7 is the period of 1/7;
// the other sevenths (2/7 ... 6/7) start the same cycle from another digit, so
// "rotation k" is the melody read from k/7 (Ouspensky, ISOTM p. 289). Under
// the default tuning the hexad is re-fa-mi-si-sol-la.
//
// Rhythms on a nine-pulse cycle, one pulse per point (Toussaint 2005,
// "The Euclidean Algorithm Generates Traditional Musical Rhythms"):
//   E(4,9) x.x.x.x..  the aksak of Turkey
//   E(5,9) x.x.x.x.x  the Arab agsag-samai
// Onsets take the melody's notes in turn, so a six-note tune over a
// four-onset cycle drifts against it and comes round again.
// ============================================================================

export type Melody = "hexad" | "walk" | "triangle";
export type Rhythm = "steady" | "aksak" | "agsag";

export const MELODIES: ReadonlyArray<{ value: Melody; label: string }> = [
  { value: "hexad", label: "The line 1-4-2-8-5-7" },
  { value: "walk", label: "Walk the octave 9-1-2-3-4-5-6-7-8-9" },
  { value: "triangle", label: "The triangle 3-6-9" },
];

export const RHYTHMS: ReadonlyArray<{ value: Rhythm; label: string; pattern: string }> = [
  { value: "steady", label: "Steady, one note a beat", pattern: "xxxxxxxxx" },
  { value: "aksak", label: "Aksak, E(4,9)", pattern: "x.x.x.x.." },
  { value: "agsag", label: "Agsag-samai, E(5,9)", pattern: "x.x.x.x.x" },
];

export const isMelody = (v: unknown): v is Melody => v === "hexad" || v === "walk" || v === "triangle";
export const isRhythm = (v: unknown): v is Rhythm => v === "steady" || v === "aksak" || v === "agsag";

/** The six sevenths: k/7 as its repeating digits. */
export const SEVENTHS = ["142857", "285714", "428571", "571428", "714285", "857142"] as const;

/** The hexad read from k/7 (k = 1 ... 6). */
export function hexad(rotation = 1): Point[] {
  const digits = SEVENTHS[Math.min(6, Math.max(1, Math.round(rotation))) - 1]!;
  return digits.split("").map((d) => Number(d) as Point);
}

/** The octave walked round the circle: 9, 1 ... 8, and do again. */
export const WALK: readonly Point[] = [9, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** One step of a sequence: the points that sound together, or null for a rest. */
export type Step = Point[] | null;

/** One pass of a melody over a rhythm. */
export function stepsFor(melody: Melody, rhythm: Rhythm, rotation = 1): Step[] {
  if (melody === "triangle") return [[3, 6, 9]];
  const notes = melody === "walk" ? [...WALK] : hexad(rotation);
  if (rhythm === "steady") return notes.map((p) => [p]);
  const pattern = RHYTHMS.find((r) => r.value === rhythm)?.pattern ?? "xxxxxxxxx";
  // Enough nine-pulse cycles for the tune to come round to its first note on
  // the first pulse (capped at six cycles).
  const onsets = [...pattern].filter((c) => c === "x").length;
  const cycles = Math.min(6, notes.length / gcd(notes.length, onsets));
  const out: Step[] = [];
  let n = 0;
  for (let c = 0; c < cycles; c++) {
    for (const ch of pattern) out.push(ch === "x" ? [notes[n++ % notes.length]!] : null);
  }
  return out;
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

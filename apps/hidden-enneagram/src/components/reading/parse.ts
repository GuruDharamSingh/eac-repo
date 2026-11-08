import { MODES, type ModeKey, type TypeNum } from "@/components/aeon/content";
import { isTypeNum } from "@/components/aeon/geometry";
import type { Arrows, Lines, Mark, Pin, WheelSpec, Wings } from "@/components/aeon/wheel";

// ============================================================================
// A reading step as Ario types it in Puck, read into a WheelSpec (pure).
// Forgiving on purpose: "2 7", "2,7" and "2, 7" are the same; a mark is
// "1-5" (a plain line) or "4>8" (an arrow); a pin is "4: the mask", one a line.
// Anything unreadable is skipped rather than breaking the page.
// ============================================================================

export type Cue = "none" | "core" | "lit" | "line" | "triangle" | "walk";

export const CUES: ReadonlyArray<{ value: Cue; label: string }> = [
  { value: "none", label: "No sound" },
  { value: "core", label: "Sound the core point" },
  { value: "lit", label: "Sound the lit points together" },
  { value: "line", label: "Play the line 1-4-2-8-5-7" },
  { value: "triangle", label: "Sound the triangle 3-6-9" },
  { value: "walk", label: "Walk the octave" },
];

const num = (s: string): TypeNum | null => {
  const n = Number(s.trim());
  return isTypeNum(n) ? n : null;
};

export function parsePoints(raw: unknown): TypeNum[] {
  if (typeof raw !== "string") return [];
  const out: TypeNum[] = [];
  for (const part of raw.split(/[\s,;·]+/)) {
    const n = num(part);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

export function parseMarks(raw: unknown): Mark[] {
  if (typeof raw !== "string") return [];
  const out: Mark[] = [];
  for (const m of raw.matchAll(/([1-9])\s*(->|→|>|-|–|—)\s*([1-9])/g)) {
    const from = num(m[1]!);
    const to = num(m[3]!);
    if (from && to && from !== to) out.push({ from, to, arrow: /[>→]/.test(m[2]!) });
  }
  return out.slice(0, 24);
}

export function parsePins(raw: unknown): Pin[] {
  if (typeof raw !== "string") return [];
  const out: Pin[] = [];
  for (const line of raw.split(/\n+/)) {
    const m = /^\s*([1-9])\s*[:.)-]\s*(.+?)\s*$/.exec(line);
    if (!m) continue;
    out.push({ point: Number(m[1]) as TypeNum, text: m[2]!.slice(0, 40) });
  }
  return out.slice(0, 18);
}

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

export interface StepRow {
  title?: unknown;
  text?: unknown;
  lens?: unknown;
  core?: unknown;
  wings?: unknown;
  arrows?: unknown;
  lit?: unknown;
  lines?: unknown;
  marks?: unknown;
  pins?: unknown;
  cue?: unknown;
}

export function specOf(row: StepRow): WheelSpec {
  const core = num(String(row.core ?? ""));
  return {
    lens: (Object.keys(MODES) as ModeKey[]).includes(row.lens as ModeKey) ? (row.lens as ModeKey) : "centers",
    core,
    wings: pick<Wings>(row.wings, ["none", "lower", "higher", "both"], "none"),
    arrows: pick<Arrows>(row.arrows, ["none", "stress", "growth", "both"], "none"),
    lit: parsePoints(row.lit),
    lines: pick<Lines>(row.lines, ["all", "triangle", "hexad", "core", "none"], "all"),
    marks: parseMarks(row.marks),
    pins: parsePins(row.pins),
  };
}

export const cueOf = (row: StepRow): Cue => pick<Cue>(row.cue, CUES.map((c) => c.value), "none");

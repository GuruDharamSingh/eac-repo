/** Pure scoring maths for src/evaluate.ts; no database or API imports. */

export interface ReferenceGrade {
  main_points: "all" | "most" | "some" | "none";
  contradicts_standard: boolean;
  specific: number;
  fatalistic_or_prescriptive: boolean;
  reason: string;
}

export const POINTS: Record<ReferenceGrade["main_points"], number> = { all: 1, most: 2 / 3, some: 1 / 3, none: 0 };
export const passes = (g: ReferenceGrade) => (g.main_points === "all" || g.main_points === "most") && !g.contradicts_standard;

/** Candidate's pairwise score from the two orders: candidate was A first, then B. */
export function pairScore(first: "A" | "B" | "tie", second: "A" | "B" | "tie"): number {
  const w1 = first === "A" ? 1 : first === "tie" ? 0.5 : 0;
  const w2 = second === "B" ? 1 : second === "tie" ? 0.5 : 0;
  return (w1 + w2) / 2;
}

/** Wilson 95% interval for a proportion. */
export function wilson(successes: number, n: number): [number, number] | null {
  if (!n) return null;
  const z = 1.96;
  const p = successes / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

/** Mean with a normal-approximation 95% interval. */
export function meanCi(xs: number[]): { mean: number; ci: [number, number] } | null {
  if (!xs.length) return null;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  if (xs.length < 2) return { mean: m, ci: [m, m] };
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
  const h = (1.96 * sd) / Math.sqrt(xs.length);
  return { mean: m, ci: [m - h, m + h] };
}

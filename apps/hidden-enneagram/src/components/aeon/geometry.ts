import { STRESS, TYPES, type CenterKey, type TypeNum } from "./content";

// ============================================================================
// The figure's geometry, ported from ~/aeon-enneagram/js/aeon.js (pure, so the
// server sigil and the client instrument draw the same circle). A 640-unit
// square; type 9 at the top, the nine points 40 degrees apart clockwise.
// Coordinates are rounded to 0.01 so server and client markup match exactly.
// ============================================================================

export const SIZE = 640;
export const CX = SIZE / 2;
export const CY = SIZE / 2;
/** The main circle. */
export const R = 232;
/** A point's face. */
export const NODE_R = 27;

export const NUMS: readonly TypeNum[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** The inner triangle (9-3-6) and the hexagram (1-4-2-8-5-7), as undirected pairs. */
export const TRIANGLE: ReadonlyArray<readonly [TypeNum, TypeNum]> = [[9, 3], [3, 6], [6, 9]];
export const HEXAGRAM: ReadonlyArray<readonly [TypeNum, TypeNum]> = [[1, 4], [4, 2], [2, 8], [8, 5], [5, 7], [7, 1]];

/** Growth runs against stress: GROWTH[n] is the point that moves to n under stress. */
export const GROWTH = Object.fromEntries(Object.entries(STRESS).map(([from, to]) => [to, Number(from)])) as Record<TypeNum, TypeNum>;

const r2 = (n: number) => Math.round(n * 100) / 100;

export function pt(type: number, radius = R): { x: number; y: number; deg: number } {
  const deg = (type % 9) * 40 - 90;
  const rad = (deg * Math.PI) / 180;
  return { x: r2(CX + radius * Math.cos(rad)), y: r2(CY + radius * Math.sin(rad)), deg };
}

/** A line between two points, trimmed back from the faces. */
export function trimmedLine(a: number, b: number, gap = NODE_R + 6) {
  const p1 = pt(a);
  const p2 = pt(b);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  return {
    x1: r2(p1.x + (dx / len) * gap),
    y1: r2(p1.y + (dy / len) * gap),
    x2: r2(p2.x - (dx / len) * gap),
    y2: r2(p2.y - (dy / len) * gap),
  };
}

/** The wing arc: 34 degrees either side of a point, on the circle. */
export function arcPath(type: number): string {
  const { deg } = pt(type);
  const a = ((deg - 34) * Math.PI) / 180;
  const b = ((deg + 34) * Math.PI) / 180;
  return `M ${r2(CX + R * Math.cos(a))} ${r2(CY + R * Math.sin(a))} A ${R} ${R} 0 0 1 ${r2(CX + R * Math.cos(b))} ${r2(CY + R * Math.sin(b))}`;
}

/** Tick marks around the ring: `count` of them, every `major`th one longer. */
export function ticks(count: number, major: number, inner: number, short: number, long: number) {
  return Array.from({ length: count }, (_, i) => {
    const rad = ((i * (360 / count)) * Math.PI) / 180;
    const outer = R + (i % major === 0 ? long : short);
    return {
      x1: r2(CX + (R + inner) * Math.cos(rad)),
      y1: r2(CY + (R + inner) * Math.sin(rad)),
      x2: r2(CX + outer * Math.cos(rad)),
      y2: r2(CY + outer * Math.sin(rad)),
    };
  });
}

/** The centre a point belongs to (gut 8-9-1, heart 2-3-4, head 5-6-7). */
export const centerOf = (t: TypeNum): CenterKey => TYPES[t].center;

/** The neighbours either side: a point's two wings. */
export const wingsOf = (t: TypeNum): [TypeNum, TypeNum] => [(((t + 7) % 9) + 1) as TypeNum, ((t % 9) + 1) as TypeNum];

export const nextType = (t: TypeNum): TypeNum => ((t % 9) + 1) as TypeNum;
export const prevType = (t: TypeNum): TypeNum => (((t + 7) % 9) + 1) as TypeNum;

export function isTypeNum(v: unknown): v is TypeNum {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 9;
}

// SurfaceFan geometry. Pure functions: given the stage size, the tab count and the tuning, return one pose per tab.
//
// Desktop: every tab lies on a ray from a point O just past the right edge (O = (W + offset, H/2)). A tab is a bar of
// length L whose far end, the "tip", sits at distance d from O; the tip is where its submenu attaches. The CSS is
//   left: O.x; top: O.y; transform-origin: 0 0; transform: rotate(a) translate(-d, -50%)
// so CSS rotate(a), positive = clockwise, turns the bar's leftward axis up for a > 0. Closed, a = 0 and d is just the
// offset, which parks the bar behind the right edge; the open/closed transition is therefore the fan sweep.
//
// Three shapes:
//   arc   — equal-length bars, tips on a circle of radius R around O (the rays look like they converge on O).
//   line  — rays from O cut by a vertical line: tips align vertically, outer bars are longer.
//   stack — level bars (no rotation) on a straight diagonal; the alternative to rays.
// Phone (stage narrower than PHONE_MAX): level chips rising from a bottom-right button along a gentle arc.

export type FanShape = "arc" | "line" | "stack";

export interface FanTuning {
  shape: FanShape;
  /** Distance from O to the tip of the middle tab, px. */
  radius: number;
  /** Total angle between the first and last tab, degrees (stack: converted to the same chord spacing). */
  spread: number;
  /** How far past the right edge O sits, px. */
  offset: number;
  /** Bar length, px (arc and stack; line derives each length). */
  length: number;
  /** Keep labels level while the bars tilt. */
  level: boolean;
}

export interface TabPose {
  left: number;
  top: number;
  width: number;
  /** Bar rotation in degrees (0 = level). The label counter-rotates by this when tuning.level is set. */
  angle: number;
  open: string;
  closed: string;
  /** Where a submenu attaches (stage coordinates). */
  tip: { x: number; y: number };
}

export const PHONE_MAX = 640;
export const TAB_H = 44;

const rad = (deg: number) => (deg * Math.PI) / 180;

export function fanPoses(n: number, W: number, H: number, t: FanTuning): TabPose[] {
  if (W <= PHONE_MAX) return phonePoses(n, W, H);
  const ox = W + t.offset;
  const oy = H / 2;
  const mid = (n - 1) / 2;
  const step = n > 1 ? t.spread / (n - 1) : 0;
  const closed = `rotate(0deg) translate(${-Math.max(0, t.offset - 6)}px, -50%)`;

  return Array.from({ length: n }, (_, i) => {
    // Top tab first: positive angle points up-left.
    const a = t.spread / 2 - i * step;
    if (t.shape === "stack") {
      const gap = Math.max(TAB_H + 10, 2 * t.radius * Math.sin(rad(step / 2)));
      const y = oy + (i - mid) * gap;
      const d = t.radius + (i - mid) * gap * 0.28; // straight diagonal: lower tabs reach further left
      return {
        left: ox,
        top: y,
        width: t.length,
        angle: 0,
        open: `rotate(0deg) translate(${-d}px, -50%)`,
        closed,
        tip: { x: ox - d, y },
      };
    }
    if (t.shape === "line") {
      const lineX = ox - t.radius;
      const d = t.radius / Math.cos(rad(a));
      const inner = t.radius - t.length; // all bars start the same distance from O
      return {
        left: ox,
        top: oy,
        width: d - inner,
        angle: a,
        open: `rotate(${a}deg) translate(${-d}px, -50%)`,
        closed,
        tip: { x: lineX, y: oy - Math.tan(rad(a)) * t.radius },
      };
    }
    const d = t.radius;
    return {
      left: ox,
      top: oy,
      width: t.length,
      angle: a,
      open: `rotate(${a}deg) translate(${-d}px, -50%)`,
      closed,
      tip: { x: ox - d * Math.cos(rad(a)), y: oy - d * Math.sin(rad(a)) },
    };
  });
}

/** Phone: chips stacked upward from the round button at the bottom right, leaning left along a circle. */
function phonePoses(n: number, W: number, H: number): TabPose[] {
  const right = W - 16;
  const base = H - 100;
  const gap = 58;
  const R = 700;
  return Array.from({ length: n }, (_, i) => {
    const k = n - 1 - i; // first tab highest
    const dy = (k + 1) * gap;
    const lean = R - Math.sqrt(Math.max(0, R * R - dy * dy));
    const x = right - lean;
    const y = base - k * gap;
    return {
      left: x,
      top: y,
      width: 0,
      angle: 0,
      open: `translate(-100%, -50%)`,
      closed: `translate(calc(-100% + ${right - x + 8}px), ${H - 44 - y}px) scale(0.4)`,
      tip: { x, y },
    };
  });
}

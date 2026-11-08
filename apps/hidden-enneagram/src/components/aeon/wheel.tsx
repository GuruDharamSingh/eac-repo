import { MODES, STRESS, TYPES, type CenterKey, type ModeKey, type TypeNum } from "./content";
import { CX, CY, GROWTH, HEXAGRAM, NODE_R, NUMS, pt, R, SIZE, ticks, TRIANGLE, trimmedLine, wingsOf } from "./geometry";

// ============================================================================
// The figure as a still picture of one moment of a reading (pure: no hooks,
// so the server can draw it, the written-out view can repeat it small, and
// it prints). One step says what to show:
//
//   core      the point the reading is about (filled, glowing)
//   wings     neither, the lower (core - 1), the higher (core + 1), or both
//   arrows    the core's stress line (red) and/or growth line (gold), arrowed
//   lit       other points to light
//   lines     which of the figure's lines show: all, the triangle, the hexad,
//             only the core's, or none
//   marks     Ario's own point-to-point lines ("1-5" plain, "4>8" arrowed)
//   pins      short notes pinned beside points ("4: the mask")
//   sounding  points sounding now (the reading's sound cue)
// ============================================================================

export type Wings = "none" | "lower" | "higher" | "both";
export type Arrows = "none" | "stress" | "growth" | "both";
export type Lines = "all" | "triangle" | "hexad" | "core" | "none";

export interface Mark {
  from: TypeNum;
  to: TypeNum;
  arrow: boolean;
}

export interface Pin {
  point: TypeNum;
  text: string;
}

export interface WheelSpec {
  lens: ModeKey;
  core: TypeNum | null;
  wings: Wings;
  arrows: Arrows;
  lit: TypeNum[];
  lines: Lines;
  marks: Mark[];
  pins: Pin[];
}

const HUE: Record<CenterKey, string> = { gut: "var(--he-gut)", heart: "var(--he-heart)", head: "var(--he-head)" };
const WHEEL_TICKS = ticks(72, 8, 12, 16, 22);
/** Room either side for pinned notes. */
const PAD_X = 150;

function hueFor(mode: ModeKey, t: TypeNum): string {
  for (const g of MODES[mode].groups) if (g.types.includes(t)) return HUE[g.hue];
  return "var(--he-ink-dim)";
}

/** Half the wing arc: from the core toward one neighbour. */
function halfArc(core: TypeNum, side: -1 | 1): string {
  const { deg } = pt(core);
  const a = (deg * Math.PI) / 180;
  const b = ((deg + side * 34) * Math.PI) / 180;
  const p = (x: number) => Math.round(x * 100) / 100;
  return `M ${p(CX + R * Math.cos(a))} ${p(CY + R * Math.sin(a))} A ${R} ${R} 0 0 ${side === 1 ? 1 : 0} ${p(CX + R * Math.cos(b))} ${p(CY + R * Math.sin(b))}`;
}

export function wingPoints(core: TypeNum, wings: Wings): TypeNum[] {
  const [lower, higher] = wingsOf(core);
  return wings === "both" ? [lower, higher] : wings === "lower" ? [lower] : wings === "higher" ? [higher] : [];
}

export function Wheel({
  spec,
  sounding = [],
  size = "large",
  idBase,
  label,
}: {
  spec: WheelSpec;
  sounding?: number[];
  size?: "large" | "small";
  /** Unique per wheel on the page (arrowhead marker ids). */
  idBase: string;
  label?: string;
}) {
  const { core, lens } = spec;
  const wings = core ? wingPoints(core, spec.wings) : [];
  const stressTo = core && (spec.arrows === "stress" || spec.arrows === "both") ? STRESS[core] : null;
  const growthTo = core && (spec.arrows === "growth" || spec.arrows === "both") ? GROWTH[core] : null;
  const focus = new Set<number>([...(core ? [core] : []), ...wings, ...spec.lit, ...(stressTo ? [stressTo] : []), ...(growthTo ? [growthTo] : [])]);
  for (const m of spec.marks) {
    focus.add(m.from);
    focus.add(m.to);
  }
  const anyFocus = focus.size > 0;
  const showLine = (a: number, b: number, tri: boolean) => {
    switch (spec.lines) {
      case "none":
        return false;
      case "triangle":
        return tri;
      case "hexad":
        return !tri;
      case "core":
        return core !== null && (a === core || b === core);
      default:
        return true;
    }
  };
  const id = idBase.replace(/[^A-Za-z0-9_-]/g, "-");
  const small = size === "small";
  return (
    <svg
      className={`he-wheel he-wheel-${size}`}
      viewBox={`${-PAD_X} 0 ${SIZE + PAD_X * 2} ${SIZE}`}
      role="img"
      aria-label={label ?? "The enneagram, as this step of the reading shows it."}
    >
      <defs>
        {(["stress", "growth", "mark"] as const).map((k) => (
          <marker key={k} id={`${id}-ah-${k}`} className={`he-r-ah-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0L10 5L0 10z" />
          </marker>
        ))}
      </defs>
      <circle cx={CX} cy={CY} r={R} className="he-ring" />
      {small ? null : (
        <g className="he-ring-ticks">
          {WHEEL_TICKS.map((l, n) => (
            <line key={n} {...l} />
          ))}
        </g>
      )}
      <g>
        {TRIANGLE.map(([a, b]) =>
          showLine(a, b, true) ? <line key={`t${a}-${b}`} {...trimmedLine(a, b)} className="he-figure-line he-triangle" /> : null,
        )}
        {HEXAGRAM.map(([a, b]) => (showLine(a, b, false) ? <line key={`h${a}-${b}`} {...trimmedLine(a, b)} className="he-figure-line" /> : null))}
      </g>
      {core && spec.wings !== "none" ? (
        <g className="he-r-wingarc">
          {spec.wings !== "higher" ? <path d={halfArc(core, -1)} /> : null}
          {spec.wings !== "lower" ? <path d={halfArc(core, 1)} /> : null}
        </g>
      ) : null}
      {core && stressTo ? <line {...trimmedLine(core, stressTo, NODE_R + 9)} className="he-r-arrow he-stress" markerEnd={`url(#${id}-ah-stress)`} /> : null}
      {core && growthTo ? <line {...trimmedLine(core, growthTo, NODE_R + 9)} className="he-r-arrow he-growth" markerEnd={`url(#${id}-ah-growth)`} /> : null}
      {spec.marks.map((m, n) =>
        m.from === m.to ? null : (
          <line key={`m${n}`} {...trimmedLine(m.from, m.to, NODE_R + 9)} className="he-r-mark" markerEnd={m.arrow ? `url(#${id}-ah-mark)` : undefined} />
        ),
      )}
      {NUMS.map((t) => {
        const p = pt(t);
        const cls = [
          "he-r-node",
          t === core ? "he-r-core" : "",
          wings.includes(t) ? "he-r-wing" : "",
          spec.lit.includes(t) || t === stressTo || t === growthTo ? "he-r-lit" : "",
          anyFocus && !focus.has(t) ? "he-r-quiet" : "",
          sounding.includes(t) ? "he-sounding" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <g key={t} className={cls} style={{ ["--node-hue" as string]: hueFor(lens, t) }}>
            <circle cx={p.x} cy={p.y} r={NODE_R + 7} className="he-halo" />
            <circle cx={p.x} cy={p.y} r={NODE_R} className="he-face" />
            <text x={p.x} y={p.y + 1}>
              {t}
            </text>
          </g>
        );
      })}
      {spec.pins.map((pin, n) => {
        const at = pt(pin.point, R + 46);
        const anchor = at.x < CX - 20 ? "end" : at.x > CX + 20 ? "start" : "middle";
        const dy = pin.point === 9 ? -6 : at.y > CY + 150 ? 14 : 0;
        // Several pins on one point stack downwards.
        const stack = spec.pins.slice(0, n).filter((q) => q.point === pin.point).length;
        return (
          <text key={`p${n}`} x={at.x} y={at.y + dy + stack * 24} textAnchor={anchor} className="he-r-pin">
            {pin.text}
          </text>
        );
      })}
    </svg>
  );
}

export const typeName = (t: TypeNum) => TYPES[t].name;

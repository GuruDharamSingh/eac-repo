import { TYPES } from "./content";
import { CX, CY, HEXAGRAM, NUMS, pt, R, SIZE, ticks, TRIANGLE, trimmedLine } from "./geometry";

const SIGIL_TICKS = ticks(72, 8, 10, 16, 22);
const HUE = { gut: "var(--he-gut)", heart: "var(--he-heart)", head: "var(--he-head)" } as const;

/**
 * The static figure (ÆON's hero ornament): ring, ticks, triangle, hexagram and
 * nine dots in their centre's hue. No script; decorative (aria-hidden).
 */
export function AeonSigil({ className }: { className?: string }) {
  return (
    <svg className={["he-sigil", className].filter(Boolean).join(" ")} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" focusable="false">
      <circle cx={CX} cy={CY} r={R} className="he-ring" />
      <g className="he-ring-ticks">
        {SIGIL_TICKS.map((l, i) => (
          <line key={i} {...l} />
        ))}
      </g>
      {TRIANGLE.map(([a, b]) => (
        <line key={`t${a}${b}`} {...trimmedLine(a, b, 10)} className="he-figure-line he-triangle" />
      ))}
      {HEXAGRAM.map(([a, b]) => (
        <line key={`h${a}${b}`} {...trimmedLine(a, b, 10)} className="he-figure-line" />
      ))}
      {NUMS.map((t) => {
        const p = pt(t);
        return <circle key={t} cx={p.x} cy={p.y} r={7} className="he-sigil-dot" style={{ fill: HUE[TYPES[t].center], ["--dot" as string]: HUE[TYPES[t].center] }} />;
      })}
    </svg>
  );
}

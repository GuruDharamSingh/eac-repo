"use client";

import { useState } from "react";
import {
  LINE_GROUPS,
  LINE_GROUP_COLORS,
  LINE_GROUP_LABELS,
  ENNEAGRAM_TYPES,
  CENTER_COLORS,
  type LineGroup,
} from "./enneagram-data";

// SVG coordinate system: viewBox "0 0 560 560"
const CX = 280;
const CY = 280;
const R = 200; // radius of the nine-point circle
const OUTER_R = 228; // visible outer ring
const POINT_R = 18; // radius of each type dot

// Type 9 sits at the top; types 1–8 continue clockwise.
function pointAngle(type: number): number {
  return ((type === 9 ? 0 : type) * 40 * Math.PI) / 180;
}

function pt(type: number): { x: number; y: number } {
  const θ = pointAngle(type);
  return { x: CX + R * Math.sin(θ), y: CY - R * Math.cos(θ) };
}

// The classic enneagram figure is triangle (3-6-9) + hexagram (1-4-2-8-5-7).
// These are drawn at very low opacity as the "always-on" skeleton.
const SKELETON: [number, number][] = [
  ...LINE_GROUPS["369"],
  ...LINE_GROUPS["hexagram"],
];

interface EnneagramDiagramProps {
  /** Types to visually emphasize (all others dim) */
  highlightPoints?: number[];
  /** Which line groups to draw in color. When omitted the component manages its own state. */
  activeLineGroups?: LineGroup[];
  /** Render toggle buttons below the diagram for interactive use */
  showControls?: boolean;
  className?: string;
}

const TYPES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export function EnneagramDiagram({
  highlightPoints = [],
  activeLineGroups: controlled,
  showControls = false,
  className = "",
}: EnneagramDiagramProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [localGroups, setLocalGroups] = useState<LineGroup[]>([
    "369",
    "hexagram",
  ]);

  const lineGroups = controlled ?? localGroups;
  const hasHighlights = highlightPoints.length > 0;

  function toggleGroup(g: LineGroup) {
    setLocalGroups((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  }

  function togglePoint(type: number) {
    setSelected((prev) => (prev === type ? null : type));
  }

  // Which active group (if any) owns a given line segment?
  function activeGroupForLine(a: number, b: number): LineGroup | null {
    for (const g of lineGroups) {
      if (
        LINE_GROUPS[g].some(
          ([ga, gb]) => (ga === a && gb === b) || (ga === b && gb === a)
        )
      )
        return g;
    }
    return null;
  }

  // Collect all lines to render (skeleton + active groups), deduplicated
  const lineSet = new Map<string, [number, number]>();
  for (const [a, b] of SKELETON) lineSet.set(`${Math.min(a, b)}-${Math.max(a, b)}`, [a, b]);
  for (const g of lineGroups) {
    for (const [a, b] of LINE_GROUPS[g]) {
      lineSet.set(`${Math.min(a, b)}-${Math.max(a, b)}`, [a, b]);
    }
  }
  const allLines = Array.from(lineSet.values());

  // Position the tooltip adjacent to the point, opening away from the circle's edge
  function tooltipStyle(type: number): React.CSSProperties {
    const { x, y } = pt(type);
    const dx = x - CX;
    const dy = y - CY;
    const left = `${(x / 560) * 100}%`;
    const top = `${(y / 560) * 100}%`;

    let tx: string, ty: string;
    if (Math.abs(dx) < 30) {
      // Near top or bottom — open vertically
      tx = "-50%";
      ty = dy < 0 ? "14px" : "calc(-100% - 14px)";
    } else if (dx > 0) {
      // Right half — open to the left
      tx = "calc(-100% - 14px)";
      ty = "-50%";
    } else {
      // Left half — open to the right
      tx = "14px";
      ty = "-50%";
    }

    return {
      position: "absolute",
      left,
      top,
      transform: `translate(${tx}, ${ty})`,
    };
  }

  return (
    <div className={`relative select-none ${className}`}>
      {showControls && (
        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {(Object.keys(LINE_GROUP_LABELS) as LineGroup[]).map((g) => (
            <button
              key={g}
              onClick={() => toggleGroup(g)}
              className="text-xs px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer"
              style={
                lineGroups.includes(g)
                  ? {
                      backgroundColor: LINE_GROUP_COLORS[g],
                      borderColor: LINE_GROUP_COLORS[g],
                      color: "#0a0a0c",
                    }
                  : {
                      backgroundColor: "transparent",
                      borderColor: "rgba(236,231,221,0.18)",
                      color: "rgba(236,231,221,0.45)",
                    }
              }
            >
              {LINE_GROUP_LABELS[g]}
            </button>
          ))}
        </div>
      )}

      <svg
        viewBox="0 0 560 560"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full"
        aria-label="Interactive Enneagram Diagram"
      >
        {/* Transparent background layer to catch clicks and dismiss tooltip */}
        <rect
          width="560"
          height="560"
          fill="transparent"
          onClick={() => setSelected(null)}
        />

        {/* Outer decorative rings */}
        <circle
          cx={CX}
          cy={CY}
          r={OUTER_R + 12}
          fill="none"
          stroke="rgba(236,231,221,0.04)"
          strokeWidth="1"
        />
        <circle
          cx={CX}
          cy={CY}
          r={OUTER_R}
          fill="none"
          stroke="rgba(236,231,221,0.16)"
          strokeWidth="1.5"
        />

        {/* Lines */}
        {allLines.map(([a, b]) => {
          const pa = pt(a);
          const pb = pt(b);
          const activeGroup = activeGroupForLine(a, b);
          return (
            <line
              key={`${a}-${b}`}
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              stroke={
                activeGroup
                  ? LINE_GROUP_COLORS[activeGroup]
                  : "rgba(236,231,221,0.07)"
              }
              strokeWidth={activeGroup ? 1.5 : 1}
              strokeOpacity={activeGroup ? 0.65 : 1}
            />
          );
        })}

        {/* Type points */}
        {TYPES.map((type) => {
          const { x, y } = pt(type);
          const highlighted = !hasHighlights || highlightPoints.includes(type);
          const dimmed = hasHighlights && !highlighted;
          const isActive = selected === type;
          const centerColor = CENTER_COLORS[ENNEAGRAM_TYPES[type].center];

          return (
            <g
              key={type}
              onClick={(e) => {
                e.stopPropagation();
                togglePoint(type);
              }}
              style={{ cursor: "pointer" }}
              role="button"
              aria-label={`Type ${type}: ${ENNEAGRAM_TYPES[type].name}`}
            >
              {/* Soft center glow when highlighted */}
              {highlighted && !dimmed && (
                <circle
                  cx={x}
                  cy={y}
                  r={POINT_R + 9}
                  fill={centerColor}
                  fillOpacity="0.08"
                />
              )}
              {/* Active selection ring */}
              {isActive && (
                <circle
                  cx={x}
                  cy={y}
                  r={POINT_R + 5}
                  fill="none"
                  stroke={centerColor}
                  strokeWidth="1.5"
                  strokeOpacity="0.75"
                />
              )}
              {/* Main dot */}
              <circle
                cx={x}
                cy={y}
                r={POINT_R}
                fill={isActive ? `${centerColor}18` : "#0d0d14"}
                stroke={
                  highlighted ? centerColor : "rgba(236,231,221,0.18)"
                }
                strokeWidth={highlighted ? 1.5 : 1}
                opacity={dimmed ? 0.2 : 1}
              />
              {/* Number */}
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="14"
                fontWeight={highlighted ? "600" : "300"}
                fill={
                  highlighted ? "#ece7dd" : "rgba(236,231,221,0.4)"
                }
                opacity={dimmed ? 0.25 : 1}
                style={{
                  pointerEvents: "none",
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                }}
              >
                {type}
              </text>
            </g>
          );
        })}
      </svg>

      {/* HTML tooltip — absolutely positioned over the SVG */}
      {selected !== null && (() => {
        const info = ENNEAGRAM_TYPES[selected];
        const color = CENTER_COLORS[info.center];
        return (
          <div
            className="z-20 w-56 pointer-events-auto"
            style={tooltipStyle(selected)}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="rounded-lg p-4 shadow-2xl"
              style={{
                backgroundColor: "#131319",
                border: `1px solid ${color}44`,
              }}
            >
              {/* Header row */}
              <div className="flex justify-between items-start gap-2 mb-1">
                <span
                  className="text-xs tracking-widest uppercase"
                  style={{ color }}
                >
                  Type {selected} · {info.center}
                </span>
                <button
                  className="text-xs leading-none opacity-30 hover:opacity-70 transition-opacity cursor-pointer shrink-0 mt-0.5"
                  style={{ background: "none", border: "none", color: "#ece7dd" }}
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              {/* Name */}
              <div
                className="text-lg leading-tight mb-1"
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  color: "#ece7dd",
                }}
              >
                {info.name}
              </div>
              {/* Tagline */}
              <div
                className="text-xs italic mb-3"
                style={{ color: "rgba(236,231,221,0.5)" }}
              >
                {info.tagline}
              </div>
              {/* Description */}
              <p
                className="text-xs leading-relaxed mb-3"
                style={{ color: "rgba(236,231,221,0.75)" }}
              >
                {info.description}
              </p>
              {/* Keywords */}
              <div className="flex flex-wrap gap-1">
                {info.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      border: `1px solid ${color}33`,
                      color: "rgba(236,231,221,0.4)",
                    }}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

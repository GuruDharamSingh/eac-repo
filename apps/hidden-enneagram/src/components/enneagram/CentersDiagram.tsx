"use client";

import { useState } from "react";
import { ENNEAGRAM_TYPES, CENTER_COLORS } from "./enneagram-data";

// Same coordinate space as EnneagramDiagram.
// viewBox is expanded to "-10 -20 580 600" to accommodate icons
// that sit outside the outer circle at the top and bottom corners.
const CX = 280;
const CY = 280;
const R = 200;
const OUTER_R = 228;

function ptAngle(type: number): number {
  return ((type === 9 ? 0 : type) * 40 * Math.PI) / 180;
}
function pt(type: number) {
  const θ = ptAngle(type);
  return { x: CX + R * Math.sin(θ), y: CY - R * Math.cos(θ) };
}
function arcPt(deg: number, r: number): [number, number] {
  const θ = (deg * Math.PI) / 180;
  return [CX + r * Math.sin(θ), CY - r * Math.cos(θ)];
}

// Pie-slice sector from center to the arc.
// All three centers are exactly 120° — large-arc-flag is always 0.
function sectorD(startDeg: number, endDeg: number, r: number): string {
  const [sx, sy] = arcPt(startDeg, r);
  const [ex, ey] = arcPt(endDeg, r);
  return `M ${CX} ${CY} L ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)} Z`;
}

// Just the arc stroke (no fill, no center line).
function arcPathD(startDeg: number, endDeg: number, r: number): string {
  const [sx, sy] = arcPt(startDeg, r);
  const [ex, ey] = arcPt(endDeg, r);
  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

// The three centers, each spanning 120° of the circle.
// Boundaries: 300°/60°/180°/300° (midpoints between adjacent types).
const CENTERS = [
  {
    id: "body" as const,
    types: [8, 9, 1],
    color: "#3aa99c",
    label: "BODY",
    description: "Processes experience through instinct, boundary, and physical presence.",
    startDeg: 300,
    endDeg: 60, // passes through 0° (top)
    icon: [CX, 22] as [number, number],
  },
  {
    id: "heart" as const,
    types: [2, 3, 4],
    color: "#d97070",
    label: "HEART",
    description: "Navigates through feeling, image, and relational meaning.",
    startDeg: 60,
    endDeg: 180,
    // midpoint 120° from top → lower-right
    icon: [504, 412] as [number, number],
  },
  {
    id: "head" as const,
    types: [5, 6, 7],
    color: "#8f83c0",
    label: "HEAD",
    description: "Makes sense of experience through thinking, planning, and analysis.",
    startDeg: 180,
    endDeg: 300,
    // midpoint 240° from top → lower-left
    icon: [56, 412] as [number, number],
  },
] as const;

// Faint skeleton lines so the diagram still reads as an enneagram
const SKELETON: [number, number][] = [
  [3, 6], [6, 9], [9, 3], // triangle
  [1, 4], [4, 2], [2, 8], [8, 5], [5, 7], [7, 1], // hexagram
];

const ALL_TYPES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

// ── Symbolic icons ────────────────────────────────────────────────────────────

function TorsoIcon({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  const g = {
    fill: "none",
    stroke: color,
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    opacity: 0.75,
  };
  return (
    <g {...g}>
      {/* Head */}
      <ellipse cx={cx} cy={cy - 20} rx={8} ry={9} />
      {/* Neck */}
      <line x1={cx} y1={cy - 11} x2={cx} y2={cy - 14} />
      {/* Left shoulder curve */}
      <path d={`M ${cx - 19},${cy - 2} Q ${cx - 13},${cy - 12} ${cx - 5},${cy - 14}`} />
      {/* Right shoulder curve */}
      <path d={`M ${cx + 5},${cy - 14} Q ${cx + 13},${cy - 12} ${cx + 19},${cy - 2}`} />
      {/* Sides */}
      <line x1={cx - 19} y1={cy - 2} x2={cx - 14} y2={cy + 13} />
      <line x1={cx + 19} y1={cy - 2} x2={cx + 14} y2={cy + 13} />
      {/* Waist */}
      <line x1={cx - 14} y1={cy + 13} x2={cx + 14} y2={cy + 13} />
    </g>
  );
}

function HeartIcon({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  // Classic heart: two arcs meeting at bottom point.
  // Height ≈ 28 (cy−13 to cy+15), width ≈ 38 (cx±19)
  const d = [
    `M ${cx},${cy + 15}`,
    `C ${cx - 4},${cy + 8} ${cx - 19},${cy + 6} ${cx - 19},${cy - 4}`,
    `C ${cx - 19},${cy - 15} ${cx},${cy - 15} ${cx},${cy - 4}`,
    `C ${cx},${cy - 15} ${cx + 19},${cy - 15} ${cx + 19},${cy - 4}`,
    `C ${cx + 19},${cy + 6} ${cx + 4},${cy + 8} ${cx},${cy + 15} Z`,
  ].join(" ");
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinejoin="round"
      opacity={0.75}
    />
  );
}

function HeadIcon({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  // Oval cranium + neck + short shoulder suggestion
  return (
    <g
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      opacity={0.75}
    >
      {/* Cranium/head oval */}
      <ellipse cx={cx} cy={cy} rx={13} ry={15} />
      {/* Neck */}
      <line x1={cx} y1={cy + 15} x2={cx} y2={cy + 21} />
      {/* Shoulder line */}
      <line x1={cx - 10} y1={cy + 21} x2={cx + 10} y2={cy + 21} />
    </g>
  );
}

// ── Tooltip positioning ───────────────────────────────────────────────────────

// viewBox is "-10 -20 580 600" — these helpers convert SVG → CSS % for tooltips.

// Position the center-icon tooltip adjacent to each icon, opening away from edges.
function centerTooltipStyle(id: "body" | "heart" | "head"): React.CSSProperties {
  // Each icon's SVG position and which direction the tooltip should open.
  const config = {
    body:  { svgX: CX,  svgY: 51,  tx: "-50%",                 ty: "8px"  },
    heart: { svgX: 504, svgY: 412, tx: "calc(-100% - 12px)",   ty: "-50%" },
    head:  { svgX: 56,  svgY: 412, tx: "12px",                 ty: "-50%" },
  }[id];
  return {
    position: "absolute",
    left: `${((config.svgX + 10) / 580) * 100}%`,
    top:  `${((config.svgY + 20) / 600) * 100}%`,
    transform: `translate(${config.tx}, ${config.ty})`,
  };
}

// viewBox is "-10 -20 580 600"
function tooltipStyle(type: number): React.CSSProperties {
  const { x, y } = pt(type);
  const dx = x - CX;
  const dy = y - CY;
  // Map SVG coords into container percentages, accounting for viewBox offset
  const left = `${((x + 10) / 580) * 100}%`;
  const top = `${((y + 20) / 600) * 100}%`;
  let tx: string, ty: string;
  if (Math.abs(dx) < 30) {
    tx = "-50%";
    ty = dy < 0 ? "14px" : "calc(-100% - 14px)";
  } else if (dx > 0) {
    tx = "calc(-100% - 14px)";
    ty = "-50%";
  } else {
    tx = "14px";
    ty = "-50%";
  }
  return { position: "absolute", left, top, transform: `translate(${tx}, ${ty})` };
}

// ── Main component ────────────────────────────────────────────────────────────

type CenterId = "body" | "heart" | "head";

export function CentersDiagram({ className = "" }: { className?: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedCenter, setSelectedCenter] = useState<CenterId | null>(null);

  function toggle(type: number) {
    setSelected((prev) => (prev === type ? null : type));
    setSelectedCenter(null);
  }

  function toggleCenter(id: CenterId) {
    setSelectedCenter((prev) => (prev === id ? null : id));
    setSelected(null);
  }

  function clearAll() {
    setSelected(null);
    setSelectedCenter(null);
  }

  return (
    <div className={`relative select-none ${className}`}>
      <svg
        viewBox="-10 -20 580 600"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full"
        aria-label="Three Centers of the Enneagram"
      >
        {/* Full-area click target to dismiss tooltip */}
        <rect
          x="-10"
          y="-20"
          width="580"
          height="600"
          fill="transparent"
          onClick={clearAll}
        />

        {/* ── Sector fills ── */}
        {CENTERS.map((c) => (
          <path
            key={c.id + "-fill"}
            d={sectorD(c.startDeg, c.endDeg, 222)}
            fill={c.color}
            fillOpacity={0.06}
          />
        ))}

        {/* ── Outer ring ── */}
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
          stroke="rgba(236,231,221,0.12)"
          strokeWidth="1"
        />

        {/* ── Colored outer arcs (one per center) ── */}
        {CENTERS.map((c) => (
          <path
            key={c.id + "-arc"}
            d={arcPathD(c.startDeg, c.endDeg, OUTER_R + 7)}
            fill="none"
            stroke={c.color}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeOpacity="0.5"
          />
        ))}

        {/* ── Skeleton inner lines (very faint) ── */}
        {SKELETON.map(([a, b]) => {
          const pa = pt(a);
          const pb = pt(b);
          return (
            <line
              key={`sk-${a}-${b}`}
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              stroke="rgba(236,231,221,0.07)"
              strokeWidth="1"
            />
          );
        })}

        {/* ── Type points ── */}
        {ALL_TYPES.map((type) => {
          const { x, y } = pt(type);
          const isActive = selected === type;
          const color = CENTER_COLORS[ENNEAGRAM_TYPES[type].center];
          return (
            <g
              key={type}
              onClick={(e) => {
                e.stopPropagation();
                toggle(type);
              }}
              style={{ cursor: "pointer" }}
              role="button"
              aria-label={`Type ${type}: ${ENNEAGRAM_TYPES[type].name}`}
            >
              {/* Glow on active */}
              {isActive && (
                <circle
                  cx={x}
                  cy={y}
                  r={23}
                  fill="none"
                  stroke={color}
                  strokeWidth="1.5"
                  strokeOpacity="0.7"
                />
              )}
              {/* Soft center glow */}
              <circle cx={x} cy={y} r={25} fill={color} fillOpacity="0.06" />
              {/* Main dot */}
              <circle
                cx={x}
                cy={y}
                r={18}
                fill={isActive ? `${color}1a` : "#0d0d14"}
                stroke={color}
                strokeWidth="1.5"
              />
              {/* Number */}
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="14"
                fontWeight="500"
                fill="#ece7dd"
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

        {/* ── Iconic shapes outside the circle (clickable) ── */}
        {CENTERS.map((c) => {
          const [ix, iy] = c.icon;
          const isActive = selectedCenter === c.id;
          return (
            <g
              key={c.id + "-icon"}
              onClick={(e) => {
                e.stopPropagation();
                toggleCenter(c.id);
              }}
              style={{ cursor: "pointer" }}
              role="button"
              aria-label={`${c.label} center`}
            >
              {/* Transparent hit area so the full icon region is clickable */}
              <circle cx={ix} cy={iy} r={34} fill="transparent" />
              {/* Selection glow ring */}
              {isActive && (
                <circle
                  cx={ix}
                  cy={iy}
                  r={32}
                  fill={c.color}
                  fillOpacity="0.09"
                  stroke={c.color}
                  strokeWidth="1"
                  strokeOpacity="0.35"
                />
              )}
              {c.id === "body" && (
                <TorsoIcon cx={ix} cy={iy} color={c.color} />
              )}
              {c.id === "heart" && (
                <HeartIcon cx={ix} cy={iy} color={c.color} />
              )}
              {c.id === "head" && (
                <HeadIcon cx={ix} cy={iy} color={c.color} />
              )}
              {/* Label */}
              <text
                x={ix}
                y={
                  c.id === "body"
                    ? iy + 29
                    : c.id === "heart"
                      ? iy + 30
                      : iy + 37
                }
                textAnchor="middle"
                fontSize="7.5"
                letterSpacing="2.5"
                fill={c.color}
                fillOpacity={isActive ? 1 : 0.65}
                style={{ fontFamily: "sans-serif" }}
              >
                {c.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* ── Tooltip ── */}
      {selected !== null &&
        (() => {
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
                <div className="flex justify-between items-start gap-2 mb-1">
                  <span
                    className="text-xs tracking-widest uppercase"
                    style={{ color }}
                  >
                    {info.center} · {selected}
                  </span>
                  <button
                    className="text-xs opacity-30 hover:opacity-70 transition-opacity cursor-pointer shrink-0"
                    style={{ background: "none", border: "none", color: "#ece7dd" }}
                    onClick={() => setSelected(null)}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <div
                  className="text-lg leading-tight mb-1"
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    color: "#ece7dd",
                  }}
                >
                  {info.name}
                </div>
                <div
                  className="text-xs italic mb-3"
                  style={{ color: "rgba(236,231,221,0.5)" }}
                >
                  {info.tagline}
                </div>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "rgba(236,231,221,0.75)" }}
                >
                  {info.description}
                </p>
              </div>
            </div>
          );
        })()}

      {/* ── Center icon tooltip ── */}
      {selectedCenter !== null &&
        (() => {
          const c = CENTERS.find((x) => x.id === selectedCenter)!;
          return (
            <div
              className="z-20 w-48 pointer-events-auto"
              style={centerTooltipStyle(selectedCenter)}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="rounded-lg p-3 shadow-2xl"
                style={{
                  backgroundColor: "#131319",
                  border: `1px solid ${c.color}44`,
                }}
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <span
                    className="text-xs tracking-widest uppercase"
                    style={{ color: c.color }}
                  >
                    {c.label} CENTER
                  </span>
                  <button
                    className="text-xs opacity-30 hover:opacity-70 transition-opacity cursor-pointer shrink-0"
                    style={{ background: "none", border: "none", color: "#ece7dd" }}
                    onClick={() => setSelectedCenter(null)}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "rgba(236,231,221,0.8)" }}
                >
                  {c.description}
                </p>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

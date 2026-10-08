// ============================================================================
// The enneagram's content and geometry, for the `enneagram` block.
//
// Text taken from apps/hidden-enneagram/src/components/enneagram/
// enneagram-data.ts (the nine types) and CentersDiagram.tsx (the three
// centres), so the block says what hiddenenneagram.com already says. Copied
// rather than imported: an app is not a package, and the block library must
// not reach into one.
//
// The body centre is called "gut" here because that is what people say; its
// id stays `body` so the hidden-enneagram data maps across unchanged.
// ============================================================================

export type CentreId = "head" | "heart" | "body";
export type LineGroup = "369" | "147" | "258" | "hexagram";

export interface TypeInfo {
  name: string;
  tagline: string;
  description: string;
  keywords: string[];
  centre: CentreId;
}

export const TYPES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const ENNEAGRAM_TYPES: Record<number, TypeInfo> = {
  1: {
    name: "The Perfectionist",
    tagline: "Integrity through right action",
    keywords: ["reform", "integrity", "criticism", "resentment"],
    description:
      "Driven by an inner critic that demands perfection and right action. They perceive the world through a constant lens of improvement and feel personally responsible for what is wrong.",
    centre: "body",
  },
  2: {
    name: "The Helper",
    tagline: "Love through giving",
    keywords: ["care", "approval", "pride", "relationships"],
    description:
      "Move toward others to fulfill needs they cannot acknowledge in themselves. Love becomes a currency — given abundantly, unconsciously expecting return.",
    centre: "heart",
  },
  3: {
    name: "The Achiever",
    tagline: "Worth through success",
    keywords: ["image", "efficiency", "adaptability", "deceit"],
    description:
      "Shape-shift to match the expectations of others, confusing their performed role with their actual self. Success and admiration become substitutes for being loved.",
    centre: "heart",
  },
  4: {
    name: "The Individualist",
    tagline: "Identity through depth",
    keywords: ["authenticity", "longing", "envy", "melancholy"],
    description:
      "Search for an authentic self through feeling, meaning, and what is missing. Uniquely attuned to beauty and loss, they can romanticize suffering while yearning for the ideal.",
    centre: "heart",
  },
  5: {
    name: "The Investigator",
    tagline: "Safety through knowledge",
    keywords: ["insight", "privacy", "detachment", "avarice"],
    description:
      "Manage scarce inner resources by withdrawing from the world to observe and understand. Knowledge becomes a preparation for engagement — often deferred indefinitely.",
    centre: "head",
  },
  6: {
    name: "The Loyalist",
    tagline: "Security through trust",
    keywords: ["loyalty", "doubt", "anxiety", "vigilance"],
    description:
      "Scan continuously for threat while testing the trustworthiness of others. Inner doubt fuels both devoted loyalty and persistent questioning — of systems, authorities, and the self.",
    centre: "head",
  },
  7: {
    name: "The Enthusiast",
    tagline: "Freedom through possibility",
    keywords: ["options", "pleasure", "planning", "gluttony"],
    description:
      "Keep options perpetually open and maintain positive anticipation as a defense against pain. Reframe limitation as opportunity; move quickly so discomfort cannot catch up.",
    centre: "head",
  },
  8: {
    name: "The Challenger",
    tagline: "Control through strength",
    keywords: ["power", "protection", "intensity", "excess"],
    description:
      "Assert presence and push against limits to ensure they will never be controlled or betrayed. Ferociously protective of those they claim as their own.",
    centre: "body",
  },
  9: {
    name: "The Peacemaker",
    tagline: "Peace through harmony",
    keywords: ["harmony", "comfort", "merging", "inertia"],
    description:
      "Maintain inner peace by losing the self in others, routines, or comfortable distractions. Absorb surrounding priorities while forgetting their own, only to wonder why they feel absent.",
    centre: "body",
  },
};

export interface CentreInfo {
  id: CentreId;
  label: string;
  types: readonly [number, number, number];
  description: string;
  /** Default colour — the hidden-enneagram palette, legible on light and dark. */
  colour: string;
  /** Arc span in degrees clockwise from the top (type 9 sits at 0°). */
  startDeg: number;
  endDeg: number;
}

export const CENTRES: readonly CentreInfo[] = [
  {
    id: "body",
    label: "Gut",
    types: [8, 9, 1],
    description: "Processes experience through instinct, boundary, and physical presence.",
    colour: "#3aa99c",
    startDeg: 300,
    endDeg: 60,
  },
  {
    id: "heart",
    label: "Heart",
    types: [2, 3, 4],
    description: "Navigates through feeling, image, and relational meaning.",
    colour: "#d97070",
    startDeg: 60,
    endDeg: 180,
  },
  {
    id: "head",
    label: "Head",
    types: [5, 6, 7],
    description: "Makes sense of experience through thinking, planning, and analysis.",
    colour: "#8f83c0",
    startDeg: 180,
    endDeg: 300,
  },
];

/**
 * The figure, in DRAWING order: the triangle first, then the hexagram as one
 * continuous path 1→4→2→8→5→7→1. The animation draws these one after another,
 * so the order is what a visitor watches.
 */
export const TRIANGLE: readonly [number, number][] = [
  [9, 3],
  [3, 6],
  [6, 9],
];
export const HEXAGRAM: readonly [number, number][] = [
  [1, 4],
  [4, 2],
  [2, 8],
  [8, 5],
  [5, 7],
  [7, 1],
];

// Only the segments that actually touch each group's types — 4→7 and 5→2 do
// not exist in the figure, so the 1-4-7 and 2-5-8 groups are two lines each.
export const LINE_GROUPS: Record<LineGroup, readonly [number, number][]> = {
  "369": TRIANGLE,
  "147": [
    [1, 4],
    [7, 1],
  ],
  "258": [
    [2, 8],
    [8, 5],
  ],
  hexagram: HEXAGRAM,
};

export const LINE_GROUP_COLOURS: Record<LineGroup, string> = {
  "369": "#c8a54e",
  "147": "#3aa99c",
  "258": "#d97070",
  hexagram: "#8f83c0",
};

export const LINE_GROUP_LABELS: Record<LineGroup, string> = {
  "369": "3–6–9 Harmony",
  "147": "1–4–7 Frustration",
  "258": "2–5–8 Rejection",
  hexagram: "Inner Hexagram",
};

/** The two points each type is joined to in the figure. */
export function connectionsOf(type: number): number[] {
  return [...TRIANGLE, ...HEXAGRAM]
    .filter(([a, b]) => a === type || b === type)
    .map(([a, b]) => (a === type ? b : a));
}

// ── Geometry ───────────────────────────────────────────────────────────────
// Same coordinate space as the hidden-enneagram diagrams (centre 280,280,
// points on r=200), widened so names and centre labels fit outside the ring.

export const CX = 280;
export const CY = 280;
export const R = 200;
export const RING_R = 228;
export const ARC_R = 256;
export const VIEWBOX = "-24 -24 608 608";

function angleOf(type: number): number {
  return (type === 9 ? 0 : type) * 40;
}

export function polar(deg: number, r: number): { x: number; y: number } {
  const t = (deg * Math.PI) / 180;
  return { x: CX + r * Math.sin(t), y: CY - r * Math.cos(t) };
}

export function pointOf(type: number, r = R): { x: number; y: number } {
  return polar(angleOf(type), r);
}

export function arcPath(startDeg: number, endDeg: number, r: number): string {
  const s = polar(startDeg, r);
  const e = polar(endDeg, r);
  // Every centre spans exactly 120°, so the large-arc flag is always 0.
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 0 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

export function sectorPath(startDeg: number, endDeg: number, r: number): string {
  const s = polar(startDeg, r);
  const e = polar(endDeg, r);
  return `M ${CX} ${CY} L ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 0 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)} Z`;
}

export function midDeg(c: CentreInfo): number {
  const span = (c.endDeg - c.startDeg + 360) % 360;
  return (c.startDeg + span / 2) % 360;
}

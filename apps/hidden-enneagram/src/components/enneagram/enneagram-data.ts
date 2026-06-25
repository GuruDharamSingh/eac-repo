export type LineGroup = "369" | "147" | "258" | "hexagram";

export interface TypeInfo {
  name: string;
  tagline: string;
  description: string;
  keywords: string[];
  center: "head" | "heart" | "body";
}

export const ENNEAGRAM_TYPES: Record<number, TypeInfo> = {
  1: {
    name: "The Perfectionist",
    tagline: "Integrity through right action",
    keywords: ["reform", "integrity", "criticism", "resentment"],
    description:
      "Driven by an inner critic that demands perfection and right action. They perceive the world through a constant lens of improvement and feel personally responsible for what is wrong.",
    center: "body",
  },
  2: {
    name: "The Helper",
    tagline: "Love through giving",
    keywords: ["care", "approval", "pride", "relationships"],
    description:
      "Move toward others to fulfill needs they cannot acknowledge in themselves. Love becomes a currency — given abundantly, unconsciously expecting return.",
    center: "heart",
  },
  3: {
    name: "The Achiever",
    tagline: "Worth through success",
    keywords: ["image", "efficiency", "adaptability", "deceit"],
    description:
      "Shape-shift to match the expectations of others, confusing their performed role with their actual self. Success and admiration become substitutes for being loved.",
    center: "heart",
  },
  4: {
    name: "The Individualist",
    tagline: "Identity through depth",
    keywords: ["authenticity", "longing", "envy", "melancholy"],
    description:
      "Search for an authentic self through feeling, meaning, and what is missing. Uniquely attuned to beauty and loss, they can romanticize suffering while yearning for the ideal.",
    center: "heart",
  },
  5: {
    name: "The Investigator",
    tagline: "Safety through knowledge",
    keywords: ["insight", "privacy", "detachment", "avarice"],
    description:
      "Manage scarce inner resources by withdrawing from the world to observe and understand. Knowledge becomes a preparation for engagement — often deferred indefinitely.",
    center: "head",
  },
  6: {
    name: "The Loyalist",
    tagline: "Security through trust",
    keywords: ["loyalty", "doubt", "anxiety", "vigilance"],
    description:
      "Scan continuously for threat while testing the trustworthiness of others. Inner doubt fuels both devoted loyalty and persistent questioning — of systems, authorities, and the self.",
    center: "head",
  },
  7: {
    name: "The Enthusiast",
    tagline: "Freedom through possibility",
    keywords: ["options", "pleasure", "planning", "gluttony"],
    description:
      "Keep options perpetually open and maintain positive anticipation as a defense against pain. Reframe limitation as opportunity; move quickly so discomfort cannot catch up.",
    center: "head",
  },
  8: {
    name: "The Challenger",
    tagline: "Control through strength",
    keywords: ["power", "protection", "intensity", "excess"],
    description:
      "Assert presence and push against limits to ensure they will never be controlled or betrayed. Ferociously protective of those they claim as their own.",
    center: "body",
  },
  9: {
    name: "The Peacemaker",
    tagline: "Peace through harmony",
    keywords: ["harmony", "comfort", "merging", "inertia"],
    description:
      "Maintain inner peace by losing the self in others, routines, or comfortable distractions. Absorb surrounding priorities while forgetting their own, only to wonder why they feel absent.",
    center: "body",
  },
};

// Line segments for each group: [fromType, toType]
export const LINE_GROUPS: Record<LineGroup, [number, number][]> = {
  "369": [
    [3, 6],
    [6, 9],
    [9, 3],
  ],
  // Only the hexagram segments that actually touch these types —
  // no phantom edges (4→7 and 5→2 do not exist in the enneagram figure).
  "147": [
    [1, 4],
    [7, 1],
  ],
  "258": [
    [2, 8],
    [8, 5],
  ],
  // The classic inner hexagram path: 1→4→2→8→5→7→1
  hexagram: [
    [1, 4],
    [4, 2],
    [2, 8],
    [8, 5],
    [5, 7],
    [7, 1],
  ],
};

export const LINE_GROUP_COLORS: Record<LineGroup, string> = {
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

export const CENTER_COLORS: Record<"head" | "heart" | "body", string> = {
  head: "#8f83c0",
  heart: "#d97070",
  body: "#3aa99c",
};

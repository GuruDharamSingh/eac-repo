// ============================================================================
// A word-art design, as plain JSON (kept in this browser for now; see
// WordArtKind's storage note). Sources are referenced, not baked: the EAC
// marks by id and parts, text with its font, uploads as data URLs.
// ============================================================================

import { cleanGradient, DEFAULT_GRADIENT, PRESETS, type GradientSpec } from "@elkdonis/gradients";

export type MarkSource =
  | { kind: "eac"; id: string; groups: string[] }
  | { kind: "text"; text: string; font: string; tracking: number; leading: number; align: "left" | "center" | "right" }
  | { kind: "svg"; name: string; svg: string }
  | { kind: "image"; name: string; src: string };

export type Frame = "1:1" | "16:9" | "9:16" | "4:5";
export const FRAMES: Record<Frame, [number, number]> = { "1:1": [1080, 1080], "16:9": [1920, 1080], "9:16": [1080, 1920], "4:5": [1080, 1350] };

export interface WordArtDoc {
  v: 1;
  id: string;
  name: string;
  updatedAt: number;
  source: MarkSource;
  /** The gradient inside the mark. */
  fill: GradientSpec;
  /** The gradient behind it; null = transparent (PNG with alpha). */
  background: GradientSpec | null;
  view: "2d" | "3d";
  frame: Frame;
  /** Mark size in the frame, % of the shorter side. */
  size: number;
  /** 2D: soft shadow under the mark, 0–100. */
  shadow: number;
  /** 3D */
  depth: number;
  bevel: number;
  sides: "ink" | "gradient" | "colour";
  sideColor: string;
  metal: number;
  rough: number;
  spin: number;
  tilt: number;
  /** Small PNG for the list. */
  thumb?: string;
}

const preset = (id: string) => PRESETS.find((p) => p.id === id)?.spec ?? DEFAULT_GRADIENT;

export function newDoc(source: MarkSource, name: string): WordArtDoc {
  return {
    v: 1,
    id: `wa_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name,
    updatedAt: Date.now(),
    source,
    fill: preset("spectrum"),
    background: { ...preset("ring"), stops: preset("ring").stops },
    view: "2d",
    frame: "1:1",
    size: 72,
    shadow: 30,
    depth: 24,
    bevel: 30,
    sides: "ink",
    sideColor: "#1E1B17",
    metal: 10,
    rough: 55,
    spin: 0,
    tilt: 12,
  };
}

/** Starter designs: the three EAC marks and a text one. */
export const STARTERS: Array<{ label: string; make: () => WordArtDoc }> = [
  { label: "EAC classic", make: () => newDoc({ kind: "eac", id: "eac-classic", groups: [] }, "EAC classic") },
  { label: "EAC rings", make: () => newDoc({ kind: "eac", id: "eac-rings", groups: [] }, "EAC rings") },
  { label: "EAC radiant", make: () => newDoc({ kind: "eac", id: "eac-radiant", groups: [] }, "EAC radiant") },
  {
    label: "Text",
    make: () => {
      const d = newDoc({ kind: "text", text: "ELKDONIS", font: "basteleur-bold", tracking: 20, leading: 1.05, align: "center" }, "ELKDONIS");
      d.fill = preset("ember");
      d.background = { ...preset("veil"), kind: "radial", cx: 50, cy: 40, mute: 40, light: -30 };
      return d;
    },
  },
];

const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

/** A stored doc, cleaned (it came from storage, so it isn't trusted). Null when unusable. */
export function cleanDoc(raw: unknown): WordArtDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const s = r.source as Record<string, unknown> | undefined;
  let source: MarkSource | null = null;
  if (s?.kind === "eac" && typeof s.id === "string") source = { kind: "eac", id: s.id, groups: Array.isArray(s.groups) ? s.groups.filter((g): g is string => typeof g === "string") : [] };
  else if (s?.kind === "text" && typeof s.text === "string" && typeof s.font === "string")
    source = { kind: "text", text: s.text.slice(0, 400), font: s.font, tracking: num(s.tracking, -200, 800, 0), leading: num(s.leading, 0.6, 3, 1.05), align: s.align === "left" || s.align === "right" ? s.align : "center" };
  else if (s?.kind === "svg" && typeof s.svg === "string") source = { kind: "svg", name: String(s.name ?? "SVG"), svg: s.svg };
  else if (s?.kind === "image" && typeof s.src === "string" && /^data:image\/(png|jpeg|webp);/.test(s.src)) source = { kind: "image", name: String(s.name ?? "Image"), src: s.src };
  const fill = cleanGradient(r.fill);
  if (!source || !fill || typeof r.id !== "string") return null;
  const d = newDoc(source, "x");
  return {
    ...d,
    id: r.id,
    name: typeof r.name === "string" ? r.name.slice(0, 80) : "Untitled",
    updatedAt: num(r.updatedAt, 0, 1e15, Date.now()),
    fill,
    background: r.background === null ? null : cleanGradient(r.background) ?? d.background,
    view: r.view === "3d" ? "3d" : "2d",
    frame: (Object.keys(FRAMES) as Frame[]).includes(r.frame as Frame) ? (r.frame as Frame) : "1:1",
    size: num(r.size, 10, 100, d.size),
    shadow: num(r.shadow, 0, 100, d.shadow),
    depth: num(r.depth, 0, 100, d.depth),
    bevel: num(r.bevel, 0, 100, d.bevel),
    sides: r.sides === "gradient" || r.sides === "colour" ? r.sides : "ink",
    sideColor: typeof r.sideColor === "string" && /^#[0-9a-f]{6}$/i.test(r.sideColor) ? r.sideColor : d.sideColor,
    metal: num(r.metal, 0, 100, d.metal),
    rough: num(r.rough, 0, 100, d.rough),
    spin: num(r.spin, 0, 100, d.spin),
    tilt: num(r.tilt, -60, 60, d.tilt),
    thumb: typeof r.thumb === "string" && r.thumb.startsWith("data:image/") ? r.thumb : undefined,
  };
}

// ── this browser's drafts ────────────────────────────────────────────────────
const KEY = "eac-studio-wordart:v1";

export function loadDocs(): WordArtDoc[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return (Array.isArray(raw) ? raw : []).map(cleanDoc).filter((d): d is WordArtDoc => !!d).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/** Saves; returns an error message when storage is full or blocked. */
export function saveDocs(docs: WordArtDoc[]): string | null {
  try {
    localStorage.setItem(KEY, JSON.stringify(docs));
    return null;
  } catch {
    return "This browser's storage is full or blocked; download the PNG to keep this design.";
  }
}

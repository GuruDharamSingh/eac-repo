/**
 * The style field: how the look of the one continuous section changes from
 * place to place.
 *
 * The catalog's recipes are keyframes in one CSS parameter space, not bins.
 * Each group of axes (grid, type, colour, header device, unit mix) is its own
 * smooth noise field over the plane that weights the keyframes; the groups
 * use different salts and scales, so they drift out of step. A slow
 * *coherence* field decides whether the groups follow one shared theme (a
 * region reads as one keyframe) or drift apart (one keyframe's grid with
 * another's faces). Within a tile, each box samples its own "voice" (faces,
 * border, tint) from the type group's weights, more widely where coherence is
 * low, so neighbouring boxes differ the way they do on a real page.
 *
 * The grid group is sampled at j = 0 for every tile in a strip, so column
 * pitch and rules are constant down a strip and the rules run unbroken.
 */
import { RECIPES, type HeadDevice, type Recipe, type UnitKind, type EntryType, RATIOS } from "./catalog";
import { noise, unit } from "./rng";
import { NEUTRAL, blendDials, pushDials, unitOf, type Dials } from "./dials";
import { PALETTES, type Palette } from "./templates";
import { SECTIONS, type Section } from "./sections";

/** Which palette each keyframe leans to; the colour group's weights pick among them. */
const PALETTE_OF: Record<string, string> = {
  mosaic: "mosaic", bazaar: "bazaar", backpages: "comic", weekly: "observer", dense: "herald", tabloid: "weekly", cinemafare: "weekly",
  photosheet: "mono", ledger: "mono", wantads: "mono", woodtype: "mono", notices: "herald", lovelines: "mono", vacancies: "mono",
};

/** The reader's dials, applied on top of the field's blend. Set by the viewer; tiles must be regenerated after a change. */
let READER: Dials = { ...NEUTRAL };
export function setReaderDials(d: Dials): void {
  READER = { ...d };
}
export function readerDials(): Dials {
  return READER;
}

export const CELL_W = 1000;
export const CELL_H = 1400;

export interface Style {
  anchors: { grid: Recipe; type: Recipe; colour: Recipe; device: Recipe; mix: Recipe };
  weights: Record<string, number>;
  /** Keyframes and weights a box can take its voice from. */
  voices: Array<[Recipe, number]>;
  columns: number;
  colW: number;
  /** Column pitch in px for a zone of any width. */
  pitch: number;
  gap: number;
  /** Column rule width in px; 0 = none. Per strip. */
  rule: number;
  bodySize: number;
  leading: number;
  border: number;
  centred: number;
  ink: string;
  accent: string;
  tint: string;
  headBg: string;
  headFg: string;
  fontBody: string;
  fontHead: string;
  fontDisplay: string;
  headTransform: string;
  leadWeight: string;
  leadTransform: string;
  headDevice: HeadDevice;
  units: Partial<Record<UnitKind, number>>;
  entries: Record<EntryType, number>;
  /** Chance a tile carries a section banner. */
  banner: number;
  grain: number;
  coherence: number;
  /** The ten dials at this spot: keyframe presets blended, then the reader's push. */
  dials: Dials;
  /** The palette boxes take their fills from here. */
  palette: Palette;
}

type Group = "grid" | "type" | "colour" | "device" | "mix";
const GROUP_SALT: Record<Group, number> = { grid: 11, type: 23, colour: 37, device: 53, mix: 71 };
const GROUP_SCALE: Record<Group, number> = { grid: 6, type: 7, colour: 6, device: 4, mix: 5 };
/**
 * Topography: thematic centres. Each 9×9 block of tiles holds one centre at
 * a hashed offset with a hashed keyframe, radius and strength. Near a
 * centre every axis group holds to that keyframe; the hold decays with a
 * Gaussian of the centre's radius, so between centres the groups fall back
 * to their own noise fields and the look mixes. Two centres close together
 * blend. Coherence at a spot is the sum of the holds there, capped at 1.
 */
/** How decisively one keyframe wins a group between centres. Moderate: mixtures with a majority. */
const SHARPNESS = 5;

export interface Centre {
  i: number;
  j: number;
  recipe: Recipe;
  /** The whole-page recipe this centre generates. */
  section: Section;
  radius: number;
  strength: number;
}
const BLOCK = 9;
export function centresNear(i: number, j: number): Centre[] {
  const out: Centre[] = [];
  const bi = Math.floor(i / BLOCK), bj = Math.floor(j / BLOCK);
  for (let a = bi - 1; a <= bi + 1; a++) for (let b = bj - 1; b <= bj + 1; b++) {
    const ci = a * BLOCK + Math.floor(unit(a, b, 501) * BLOCK);
    const cj = b * BLOCK + Math.floor(unit(a, b, 502) * BLOCK);
    const section = SECTIONS[Math.floor(unit(a, b, 503) * SECTIONS.length)];
    const recipe = RECIPES.find((r) => r.id === section.id) ?? RECIPES[Math.floor(unit(a, b, 506) * RECIPES.length)];
    // Radius 3–7 tiles with a plateau: inside half the radius the hold is full, then it falls off.
    out.push({ i: ci, j: cj, recipe, section, radius: 3 + unit(a, b, 504) * 4, strength: 0.85 + unit(a, b, 505) * 0.15 });
  }
  return out;
}
function holds(i: number, j: number): Array<[Centre, number]> {
  return centresNear(i, j).map((c) => {
    const d = Math.sqrt((i - c.i) ** 2 + (j - c.j) ** 2);
    // Plateau to r/2, then a smooth fall to zero at 1.6 r.
    const t = Math.max(0, Math.min(1, (d - c.radius * 0.5) / (c.radius * 1.1)));
    return [c, c.strength * (1 - t * t * (3 - 2 * t))] as [Centre, number];
  });
}
/** The strongest centre at a spot and its hold, for section generation. */
export function sectionAt(i: number, j: number): { section: Section; hold: number; centre: Centre } | null {
  let best: [Centre, number] | null = null;
  for (const h of holds(i, j)) if (!best || h[1] > best[1]) best = h;
  return best && best[1] > 0.02 ? { section: best[0].section, hold: best[1], centre: best[0] } : null;
}
export function coherenceAt(i: number, j: number): number {
  let s = 0;
  for (const [, h] of holds(i, j)) s += h;
  return Math.min(1, s);
}

function weightsFor(i: number, j: number, group: Group): Map<Recipe, number> {
  const out = new Map<Recipe, number>();
  const hs = holds(i, j);
  const c = coherenceAt(i, j);
  let sum = 0;
  RECIPES.forEach((r, k) => {
    const own = noise(i + k * 1000, j - k * 777, GROUP_SCALE[group], GROUP_SALT[group]);
    let w = Math.exp(own * SHARPNESS) * (1 - c);
    for (const [cen, h] of hs) if (cen.recipe === r) w += h * Math.exp(SHARPNESS) * 1.5;
    out.set(r, w);
    sum += w;
  });
  for (const [r, w] of out) out.set(r, w / sum);
  return out;
}

function argmax(ws: Map<Recipe, number>, jitter: number): Recipe {
  let best: Recipe = RECIPES[0];
  let bestW = -1;
  let k = 0;
  for (const [r, w] of ws) {
    const jw = w * (1 + 0.15 * (unit(jitter, k++) - 0.5));
    if (jw > bestW) {
      bestW = jw;
      best = r;
    }
  }
  return best;
}

function hexToRgb(h: string): [number, number, number] {
  const s = h.replace("#", "");
  const n = parseInt(s.length === 3 ? s.split("").map((c) => c + c).join("") : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}
function blendColour(ws: Map<Recipe, number>, pick: (r: Recipe) => string): string {
  let acc: [number, number, number] = [0, 0, 0];
  let total = 0;
  for (const [r, w] of ws) {
    const v = pick(r);
    if (v === "transparent") continue;
    const [cr, cg, cb] = hexToRgb(v);
    acc = [acc[0] + cr * w, acc[1] + cg * w, acc[2] + cb * w];
    total += w;
  }
  if (total === 0) return "transparent";
  return rgbToHex([acc[0] / total, acc[1] / total, acc[2] / total]);
}
function blendNum(ws: Map<Recipe, number>, pick: (r: Recipe) => number): number {
  let acc = 0;
  for (const [r, w] of ws) acc += pick(r) * w;
  return acc;
}
const px = (s: string): number => parseFloat(s) || 0;
const rem = (s: string): number => (s.endsWith("rem") ? parseFloat(s) * 16 : parseFloat(s));

export function styleAt(i: number, j: number): Style {
  const grid = weightsFor(i, 0, "grid");
  const type = weightsFor(i, j, "type");
  const colour = weightsFor(i, j, "colour");
  const device = weightsFor(i, j, "device");
  const mix = weightsFor(i, j, "mix");
  const jitter = (i * 7919 + j * 104729) | 0;

  const typeA = argmax(type, jitter + 1);
  const deviceA = argmax(device, jitter + 2);
  const gridA = argmax(grid, jitter + 3);
  const colourA = argmax(colour, jitter + 4);
  const mixA = argmax(mix, jitter + 5);
  const t = (r: Recipe) => r.family.tokens;

  const units: Partial<Record<UnitKind, number>> = {};
  const entries = { ...RATIOS };
  let banner = 0;
  for (const [r, w] of mix) {
    for (const [kind, kw] of r.units) units[kind] = (units[kind] ?? 0) + kw * w;
    if (r.bias) for (const [e, b] of Object.entries(r.bias) as [EntryType, number][]) entries[e] *= Math.pow(b, w);
    if (r.masthead) banner += w;
  }

  const weights: Record<string, number> = {};
  for (const r of RECIPES) weights[r.id] = (grid.get(r)! + type.get(r)! + colour.get(r)! + device.get(r)! + mix.get(r)!) / 5;

  // Dials: the keyframes' presets blended by the averaged group weights, then the reader's push.
  const dials = pushDials(blendDials(RECIPES.map((r) => [r.dials, weights[r.id]] as [Dials, number])), READER);
  const dens = unitOf(dials.density);

  const gap = blendNum(grid, (r) => r.gap) * (1.3 - 0.6 * dens);
  // Column pitch in px: a zone divides its own width by this. Wider than the catalog's agate pitch so the larger body fits.
  const pitch = blendNum(grid, (r) => CELL_W / r.columns) * (1.6 - 0.7 * dens);
  const columns = Math.max(2, Math.min(9, Math.round(CELL_W / pitch)));
  const colW = (CELL_W - (columns - 1) * gap) / columns;
  const centred = blendNum(mix, (r) => (t(r)["--cl-align"] === "center" ? 1 : 0));
  const voices = [...type.entries()].filter(([, w]) => w > 0.03).sort((a, b) => b[1] - a[1]) as Array<[Recipe, number]>;

  // Palette: the colour group's winner leans to one; the colour dial can force mono or open the whole set.
  const colourDial = unitOf(dials.colour);
  let paletteId = PALETTE_OF[colourA.id] ?? "mono";
  if (colourDial < 0.2) paletteId = "mono";
  else if (colourDial > 0.75 && paletteId === "mono") paletteId = PALETTES[1 + (hashLike(i, j) % (PALETTES.length - 1))].id;
  const palette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0];

  return {
    anchors: { grid: gridA, type: typeA, colour: colourA, device: deviceA, mix: mixA },
    weights,
    voices,
    columns,
    colW,
    pitch,
    gap,
    rule: blendNum(grid, (r) => (t(r)["--cl-rule"] === "none" ? 0 : px(t(r)["--cl-rule"]))) + (unitOf(dials.borders) < 0.3 ? 0.6 : 0),
    // Body size: the catalog's agate scaled up (10.5–13.5 px at neutral); density pulls it down, airiness up.
    bodySize: Math.max(10, blendNum(type, (r) => rem(t(r)["--cl-body-size"])) * (1.55 - 0.5 * dens)),
    leading: blendNum(type, (r) => parseFloat(t(r)["--cl-leading"])) * (1.14 - 0.2 * dens),
    border: blendNum(device, (r) => px(t(r)["--cl-box-border"])) * (0.5 + unitOf(dials.borders)),
    centred,
    ink: blendColour(colour, (r) => t(r)["--cl-ink"]),
    accent: blendColour(colour, (r) => t(r)["--cl-accent"]),
    tint: blendColour(colour, (r) => (t(r)["--cl-tint"] === "transparent" ? t(r)["--cl-paper"] : t(r)["--cl-tint"])),
    headBg: t(deviceA)["--cl-head-bg"] === "transparent" ? "transparent" : blendColour(colour, (r) => (t(r)["--cl-head-bg"] === "transparent" ? t(r)["--cl-ink"] : t(r)["--cl-head-bg"])),
    headFg: t(deviceA)["--cl-head-bg"] === "transparent" ? "inherit" : t(deviceA)["--cl-head-fg"],
    fontBody: t(typeA)["--cl-font-body"],
    fontHead: t(typeA)["--cl-font-head"],
    fontDisplay: t(argmax(type, jitter + 6))["--cl-font-display"],
    headTransform: t(deviceA)["--cl-head-transform"],
    leadWeight: t(typeA)["--cl-lead-weight"],
    leadTransform: t(typeA)["--cl-lead-transform"],
    headDevice: deviceA.head,
    units,
    entries,
    banner,
    grain: noise(i, j, 9, 97) * 0.9,
    coherence: coherenceAt(i, j),
    dials,
    palette,
  };
}

function hashLike(i: number, j: number): number {
  return Math.floor(unit(i, j, 909) * 1e6);
}

/** The CSS custom properties a tile sets from its style. Paper is one colour for the whole plane (microfiche.css). */
export function styleVars(s: Style): Record<string, string> {
  return {
    "--cl-ink": s.palette.ink,
    "--cl-accent": s.palette.accent,
    "--cl-second": s.palette.second,
    "--cl-fill": s.palette.fill,
    "--cl-tint": s.palette.tint,
    "--cl-gap": `${s.gap.toFixed(1)}px`,
    "--cl-border": `${Math.max(1, s.border).toFixed(2)}px`,
    "--cl-font-body": s.fontBody,
    "--cl-font-head": s.fontHead,
    "--cl-font-display": s.fontDisplay,
    "--cl-body-size": `${s.bodySize.toFixed(2)}px`,
    "--cl-leading": s.leading.toFixed(3),
    "--cl-head-bg": s.headBg,
    "--cl-head-fg": s.headFg,
    "--cl-head-transform": s.headTransform,
    "--cl-lead-weight": s.leadWeight,
    "--cl-lead-transform": s.leadTransform,
    "--cl-grain": s.grain.toFixed(2),
  };
}

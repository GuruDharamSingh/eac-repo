// ============================================================================
// Word-art timeline (2026-11-18, record mode shot 1): keys per setting, and
// `docAt(doc, ms)`, the design as it looks at a moment. Pure, no DOM.
//
// Keys live per setting path ("fill.angle", "size", "background"…), so a
// "Look" key is only a key at the same time on every track; the lanes of shot
// 2 are UI over the same data. Numbers glide, colours glide in OKLab, stops
// glide stop by stop (resampled to the larger count), everything else holds
// until its next key. Design: docs/open/wordart-recording/DESIGN.md.
// ============================================================================

import { cleanGradient, DEFAULT_GRADIENT, mix, normHex, sampleAt, type GradientSpec, type GradientStop } from "@elkdonis/gradients";
import type { WordArtDoc } from "./doc";

export type Ease = "smooth" | "linear" | "hold";
export interface Key { t: number; value: unknown; ease: Ease }
export interface Timeline { v: 1; tracks: Record<string, Key[]> }

export const MAX_TAKE_MS = 60_000;
const EASES: readonly Ease[] = ["smooth", "linear", "hold"];
const SAME_T = 1; // ms: keys this close are the same key
const INVALID = Symbol("invalid");

type Kind = "number" | "color" | "stops" | "hold";
interface Track {
  kind: Kind;
  label: string;
  get(d: WordArtDoc): unknown;
  set(d: WordArtDoc, v: unknown): WordArtDoc;
  /** A stored value, cleaned; INVALID when unusable. */
  clean(v: unknown): unknown;
  /** Whether two values count as the same edit (default: equal JSON). */
  same?(a: unknown, b: unknown): boolean;
}

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const finite = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : INVALID);
const hex = (v: unknown) => normHex(v) ?? INVALID;

// ── the registry: every animatable setting ───────────────────────────────────
type Layer = "fill" | "background";
type GField = keyof GradientSpec;
const G_NUMBER: GField[] = ["angle", "cx", "cy", "steps", "softness", "mute", "light", "count", "scale", "grain", "motion", "paper"];
const G_HOLD: GField[] = ["kind", "space", "hue", "ease", "shader", "seed"];
const G_LABEL: Partial<Record<GField, string>> = {
  angle: "angle", cx: "centre x", cy: "centre y", steps: "bands", softness: "softness", mute: "mute", light: "light",
  count: "blobs/rings", scale: "scale", grain: "grain", motion: "motion", paper: "paper", kind: "kind", space: "blend space",
  hue: "hue path", ease: "easing", shader: "shader", seed: "seed", stops: "colours", base: "base colour",
};

function layerTrack(layer: Layer, f: GField, kind: Kind, clean: (v: unknown) => unknown): Track {
  const L = layer === "fill" ? "Fill" : "Background";
  return {
    kind,
    label: `${L} ${G_LABEL[f] ?? f}`,
    get: (d) => {
      const g = d[layer];
      if (!g) return undefined;
      return f === "base" ? (g.base ?? null) : g[f];
    },
    set: (d, v) => {
      const g = d[layer];
      if (!g) return d;
      const val = f === "base" && v === null ? undefined : v;
      return { ...d, [layer]: { ...g, [f]: val } };
    },
    clean,
  };
}

const holdField = (f: GField) => (v: unknown) => {
  const g = cleanGradient({ ...DEFAULT_GRADIENT, [f]: v });
  return g && eq(g[f], v) ? v : INVALID;
};
const cleanStops = (v: unknown) => {
  if (!Array.isArray(v)) return INVALID;
  const g = cleanGradient({ ...DEFAULT_GRADIENT, stops: v });
  return g && g.stops.length >= 2 ? g.stops : INVALID;
};

function docNumber(key: keyof WordArtDoc, label: string): Track {
  return { kind: "number", label, get: (d) => d[key], set: (d, v) => ({ ...d, [key]: v }), clean: finite };
}

export const TRACKS: Record<string, Track> = {};
for (const layer of ["fill", "background"] as const) {
  for (const f of G_NUMBER) TRACKS[`${layer}.${f}`] = layerTrack(layer, f, "number", finite);
  for (const f of G_HOLD) TRACKS[`${layer}.${f}`] = layerTrack(layer, f, "hold", holdField(f));
  TRACKS[`${layer}.stops`] = layerTrack(layer, "stops", "stops", cleanStops);
  TRACKS[`${layer}.base`] = layerTrack(layer, "base", "color", (v) => (v === null ? null : hex(v)));
}
Object.assign(TRACKS, {
  size: docNumber("size", "Size"),
  shadow: docNumber("shadow", "Shadow"),
  depth: docNumber("depth", "Depth"),
  metal: docNumber("metal", "Metal"),
  rough: docNumber("rough", "Roughness"),
  tilt: docNumber("tilt", "Tilt"),
  spin: docNumber("spin", "Spin"),
  bevel: { ...docNumber("bevel", "Bevel"), kind: "hold" },
  sides: {
    kind: "hold", label: "Sides", get: (d) => d.sides, set: (d, v) => ({ ...d, sides: v as WordArtDoc["sides"] }),
    clean: (v) => (v === "ink" || v === "gradient" || v === "colour" ? v : INVALID),
  },
  sideColor: { kind: "color", label: "Side colour", get: (d) => d.sideColor, set: (d, v) => ({ ...d, sideColor: v as string }), clean: hex },
  // the whole background (null = transparent); its own settings are the background.* tracks
  background: {
    kind: "hold", label: "Background on/off", get: (d) => d.background, set: (d, v) => ({ ...d, background: (v as GradientSpec | null) ?? null }),
    clean: (v) => (v === null ? null : cleanGradient(v) ?? INVALID),
    same: (a, b) => (a === null) === (b === null),
  },
} satisfies Record<string, Track>);

const PATHS = Object.keys(TRACKS);
// the background's own settings are applied after the background itself
const ORDER = [...PATHS.filter((p) => !p.startsWith("background.")), ...PATHS.filter((p) => p.startsWith("background."))];
const isBgField = (p: string) => p.startsWith("background.");
const same = (p: string, a: unknown, b: unknown) => (TRACKS[p].same ?? eq)(a, b);

// ── evaluation ───────────────────────────────────────────────────────────────
const smooth = (k: number) => k * k * (3 - 2 * k);

function lerpStops(a: GradientStop[], b: GradientStop[], k: number): GradientStop[] {
  const blend = { space: "oklab", hue: "shorter" } as const;
  let x = a, y = b;
  // resample the shorter ramp at the longer one's positions, then go stop by stop
  if (a.length < b.length) x = b.map((s) => ({ color: sampleAt(a, s.at, blend), at: s.at }));
  else if (b.length < a.length) y = a.map((s) => ({ color: sampleAt(b, s.at, blend), at: s.at }));
  return x.map((s, i) => ({ color: mix(s.color, y[i].color, k, "oklab"), at: Math.round(s.at + (y[i].at - s.at) * k) }));
}

function valueAt(kind: Kind, keys: Key[], t: number): unknown {
  if (t <= keys[0].t) return keys[0].value;
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.value;
  let i = 0;
  while (keys[i + 1].t <= t) i++;
  const a = keys[i], b = keys[i + 1];
  if (t === a.t || kind === "hold" || a.ease === "hold") return a.value;
  const lin = (t - a.t) / (b.t - a.t);
  const k = a.ease === "smooth" ? smooth(lin) : lin;
  if (kind === "number" && typeof a.value === "number" && typeof b.value === "number") return a.value + (b.value - a.value) * k;
  if (kind === "color" && typeof a.value === "string" && typeof b.value === "string") return mix(a.value, b.value, k, "oklab");
  if (kind === "stops" && Array.isArray(a.value) && Array.isArray(b.value)) return lerpStops(a.value as GradientStop[], b.value as GradientStop[], k);
  return a.value;
}

/** The design as it looks at `ms`. Without a timeline, the design itself. */
export function docAt(doc: WordArtDoc, ms: number): WordArtDoc {
  const tl = doc.timeline;
  if (!tl) return doc;
  let d = doc;
  for (const p of ORDER) {
    const keys = tl.tracks[p];
    if (!keys?.length) continue;
    if (isBgField(p) && !d.background) continue;
    d = TRACKS[p].set(d, valueAt(TRACKS[p].kind, keys, ms));
  }
  return { ...d, fill: cleanGradient(d.fill) ?? doc.fill, background: d.background ? cleanGradient(d.background) ?? null : null };
}

// ── editing ──────────────────────────────────────────────────────────────────
function upsert(keys: Key[] | undefined, t: number, value: unknown): Key[] {
  const list = keys ? [...keys] : [];
  const at = list.findIndex((k) => Math.abs(k.t - t) <= SAME_T);
  if (at >= 0) { list[at] = { ...list[at], value }; return list; }
  const before = [...list].reverse().find((k) => k.t < t);
  list.push({ t, value, ease: before?.ease ?? "smooth" });
  return list.sort((a, b) => a.t - b.t);
}
const withTracks = (doc: WordArtDoc, tracks: Record<string, Key[]>): WordArtDoc => ({
  ...doc,
  timeline: Object.keys(tracks).length ? { v: 1, tracks } : undefined,
});

/**
 * The doc fields the tracks own; everything else (name, view, frame, and the mark: text, font, logo)
 * comes from the edit. The mark is never keyed (2026-11-18): a font or text change is the design's.
 */
const OWNED = ["fill", "background", "size", "shadow", "depth", "bevel", "sides", "sideColor", "metal", "rough", "spin", "tilt"] as const;

/**
 * An edit made while the playhead is at `ms` (`next` = the evaluated design with the change).
 * A setting that already moves gets a key at `ms`; a still one changes for the whole timeline.
 */
export function applyEdit(doc: WordArtDoc, next: WordArtDoc, ms: number): WordArtDoc {
  const ev = docAt(doc, ms);
  let r: WordArtDoc = { ...next };
  for (const f of OWNED) (r as unknown as Record<string, unknown>)[f] = doc[f];
  const tracks: Record<string, Key[]> = { ...(doc.timeline?.tracks ?? {}) };
  for (const p of ORDER) {
    const T = TRACKS[p];
    const a = T.get(ev), b = T.get(next);
    if (b === undefined || same(p, a, b)) continue;
    // no background at the playhead: turning one on is carried by the whole `background` value; its
    // own settings must not be pushed into the other keys' backgrounds (that rewrote them)
    if (isBgField(p) && a === undefined) continue;
    if (tracks[p]?.length) {
      tracks[p] = upsert(tracks[p], ms, b);
    } else {
      r = T.set(r, b);
      // a still background setting also changes inside the keyed backgrounds
      if (isBgField(p) && tracks.background?.length) {
        tracks.background = tracks.background.map((k) => (k.value ? { ...k, value: { ...(k.value as GradientSpec), [p.slice(11)]: b } } : k));
      }
    }
  }
  return withTracks(r, tracks);
}

/** A key on every setting at `ms`, holding what the design shows there. */
export function addLookKey(doc: WordArtDoc, ms: number): WordArtDoc {
  const ev = docAt(doc, ms);
  const tracks: Record<string, Key[]> = { ...(doc.timeline?.tracks ?? {}) };
  for (const p of ORDER) {
    if (isBgField(p) && !ev.background) continue;
    const v = TRACKS[p].get(ev);
    if (v !== undefined) tracks[p] = upsert(tracks[p], ms, v);
  }
  return withTracks(doc, tracks);
}

export function removeLookKey(doc: WordArtDoc, ms: number): WordArtDoc {
  const tracks: Record<string, Key[]> = {};
  for (const [p, keys] of Object.entries(doc.timeline?.tracks ?? {})) {
    const left = keys.filter((k) => Math.abs(k.t - ms) > SAME_T);
    if (left.length) tracks[p] = left;
  }
  return withTracks(doc, tracks);
}

/** The ease of the segments starting at `ms`. */
export function setLookEase(doc: WordArtDoc, ms: number, ease: Ease): WordArtDoc {
  const tracks: Record<string, Key[]> = {};
  for (const [p, keys] of Object.entries(doc.timeline?.tracks ?? {})) tracks[p] = keys.map((k) => (Math.abs(k.t - ms) <= SAME_T ? { ...k, ease } : k));
  return withTracks(doc, tracks);
}

// ── lanes (shot 2): one setting's keys ───────────────────────────────────────
const clampT = (t: number) => Math.round(Math.min(MAX_TAKE_MS, Math.max(0, t)));
const findKey = (keys: Key[] | undefined, t: number) => keys?.findIndex((k) => Math.abs(k.t - t) <= SAME_T) ?? -1;

/** Retime one key of one setting (stagger). A key already at `toT` on that lane is replaced. */
export function moveTrackKey(doc: WordArtDoc, path: string, fromT: number, toT: number): WordArtDoc {
  const keys = doc.timeline?.tracks[path];
  const i = findKey(keys, fromT);
  if (!keys || i < 0) return doc;
  const t = clampT(toT);
  const moved = { ...keys[i], t };
  const rest = keys.filter((k, j) => j !== i && Math.abs(k.t - t) > SAME_T);
  return withTracks(doc, { ...doc.timeline!.tracks, [path]: [...rest, moved].sort((a, b) => a.t - b.t) });
}

/** Remove one key of one setting. Removing its last key leaves the setting at that key's value. */
export function removeTrackKey(doc: WordArtDoc, path: string, t: number): WordArtDoc {
  const keys = doc.timeline?.tracks[path];
  const i = findKey(keys, t);
  if (!keys || i < 0 || !TRACKS[path]) return doc;
  const tracks = { ...doc.timeline!.tracks };
  const left = keys.filter((_, j) => j !== i);
  if (left.length) return withTracks(doc, { ...tracks, [path]: left });
  delete tracks[path];
  // no keys left: the setting is still from now on, at the value it had
  return withTracks(TRACKS[path].set(doc, keys[i].value), tracks);
}

/** The ease of the segment starting at one key of one setting. */
export function setTrackKeyEase(doc: WordArtDoc, path: string, t: number, ease: Ease): WordArtDoc {
  const keys = doc.timeline?.tracks[path];
  const i = findKey(keys, t);
  if (!keys || i < 0) return doc;
  return withTracks(doc, { ...doc.timeline!.tracks, [path]: keys.map((k, j) => (j === i ? { ...k, ease } : k)) });
}

/** A key on one setting at `ms`, holding what the design shows there. */
export function addTrackKey(doc: WordArtDoc, path: string, ms: number): WordArtDoc {
  const T = TRACKS[path];
  if (!T) return doc;
  const v = T.get(docAt(doc, ms));
  if (v === undefined) return doc;
  return withTracks(doc, { ...(doc.timeline?.tracks ?? {}), [path]: upsert(doc.timeline?.tracks[path], clampT(ms), v) });
}

// ── take overrides ───────────────────────────────────────────────────────────
// A setting dragged during a take overrides the timeline for the rest of that take (no keys written).

/** The settings that differ from `a` to `b` (both evaluated designs), as path → value. */
export function diffTracks(a: WordArtDoc, b: WordArtDoc): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of ORDER) {
    const vb = TRACKS[p].get(b);
    if (vb !== undefined && !same(p, TRACKS[p].get(a), vb)) out[p] = vb;
  }
  return out;
}

/** `d` with the overrides applied on top (null/empty = `d` itself). */
export function applyOverrides(d: WordArtDoc, o: Record<string, unknown> | null | undefined): WordArtDoc {
  if (!o || !Object.keys(o).length) return d;
  let r = d;
  for (const p of ORDER) if (p in o && (!isBgField(p) || r.background)) r = TRACKS[p].set(r, o[p]);
  return { ...r, fill: cleanGradient(r.fill) ?? d.fill, background: r.background ? cleanGradient(r.background) ?? null : null };
}

// ── reading ──────────────────────────────────────────────────────────────────
export function lookKeyTimes(tl: Timeline | undefined): number[] {
  const out: number[] = [];
  for (const keys of Object.values(tl?.tracks ?? {})) for (const k of keys) if (!out.some((t) => Math.abs(t - k.t) <= SAME_T)) out.push(k.t);
  return out.sort((a, b) => a - b);
}

/** Settings whose keys hold at least two different values (the ones that move or switch). */
export function animatedTracks(tl: Timeline | undefined): string[] {
  return ORDER.filter((p) => {
    const keys = tl?.tracks[p];
    return !!keys && keys.some((k) => !eq(k.value, keys[0].value));
  });
}

export function timelineEnd(tl: Timeline | undefined): number {
  let end = 0;
  for (const keys of Object.values(tl?.tracks ?? {})) for (const k of keys) end = Math.max(end, k.t);
  return end;
}

/** The ease a Look key's segment uses (the first track's key at that time). */
export function lookEase(tl: Timeline | undefined, ms: number): Ease {
  for (const keys of Object.values(tl?.tracks ?? {})) {
    const k = keys.find((x) => Math.abs(x.t - ms) <= SAME_T);
    if (k) return k.ease;
  }
  return "smooth";
}

// ── shader time ──────────────────────────────────────────────────────────────
// Shaders run on "motion-seconds": the integral of motion/100 over time, so keying
// motion changes a shader's speed without jumping its picture.
const STEP = 50;
const clockCache = new WeakMap<object, Map<string, number[]>>();

export function shaderClock(doc: WordArtDoc, layer: Layer, ms: number): number {
  if (ms <= 0) return 0;
  const tl = doc.timeline;
  const baseMotion = doc[layer]?.motion ?? 0;
  if (!tl) return doc[layer] ? (baseMotion / 100) * (ms / 1000) : 0;
  const motionKeys = tl.tracks[`${layer}.motion`];
  const presence = layer === "background" ? tl.tracks.background : undefined;
  const m = (t: number) => {
    if (layer === "background" && !(presence?.length ? valueAt("hold", presence, t) : doc.background)) return 0;
    const v = motionKeys?.length ? valueAt("number", motionKeys, t) : baseMotion;
    return Math.min(100, Math.max(0, typeof v === "number" ? v : 0)) / 100;
  };
  let byKey = clockCache.get(tl);
  if (!byKey) clockCache.set(tl, (byKey = new Map()));
  const ck = `${layer}|${baseMotion}|${doc.background ? 1 : 0}`;
  let cum = byKey.get(ck);
  if (!cum) byKey.set(ck, (cum = [0]));
  const i = Math.floor(ms / STEP);
  while (cum.length <= i) {
    const j = cum.length - 1;
    cum.push(cum[j] + ((m(j * STEP) + m((j + 1) * STEP)) / 2) * (STEP / 1000));
  }
  const t0 = i * STEP;
  return cum[i] + ((m(t0) + m(ms)) / 2) * ((ms - t0) / 1000);
}

// ── storage ──────────────────────────────────────────────────────────────────
/** A stored timeline, cleaned (it came from storage). Undefined when there's nothing usable. */
export function cleanTimeline(raw: unknown): Timeline | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const rt = (raw as { tracks?: unknown }).tracks;
  if (!rt || typeof rt !== "object" || Array.isArray(rt)) return undefined;
  const tracks: Record<string, Key[]> = {};
  for (const [p, keys] of Object.entries(rt as Record<string, unknown>)) {
    const T = TRACKS[p];
    if (!T || !Array.isArray(keys)) continue;
    const byT = new Map<number, Key>();
    for (const k of keys as Array<Record<string, unknown>>) {
      if (!k || typeof k !== "object") continue;
      const t = k.t;
      if (typeof t !== "number" || !Number.isFinite(t) || t < 0 || t > MAX_TAKE_MS) continue;
      if (!EASES.includes(k.ease as Ease)) continue;
      const value = T.clean(k.value);
      if (value === INVALID) continue;
      byT.set(t, { t, value, ease: k.ease as Ease });
    }
    const list = [...byT.values()].sort((a, b) => a.t - b.t);
    if (list.length) tracks[p] = list;
  }
  return Object.keys(tracks).length ? { v: 1, tracks } : undefined;
}

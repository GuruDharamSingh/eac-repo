/**
 * How an installation is lit (loft scene editor phase 3, 2026-10-30).
 *
 * Plain data and maths only, with no React or three import: the app's server
 * actions read this module through the banner-free `@elkdonis/three/hallway/model`
 * entry to bound what an editor sends, and the scene reads it to draw.
 *
 * Two layers:
 * - The room: each venue declares its own rig (`Venue.lights`: background,
 *   hemisphere, ambient, one directional key). `SceneLighting` adjusts that rig
 *   rather than replacing it, so one setting reads sensibly in every space and
 *   the defaults draw each room exactly as before.
 * - Picture lamps: the warm spot over each work (`PieceLights`), with a global
 *   strength, colour and spread here and a fixed point per piece (`LampAt`).
 */

// ── The room ────────────────────────────────────────────────────────────────

/** Where the key light comes from: the venue's own direction, or a compass point (north is −Z). */
export type KeyFrom = 'venue' | 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export const KEY_FROM: ReadonlyArray<{ value: KeyFrom; label: string }> = [
  { value: 'venue', label: "The room's windows" },
  { value: 'N', label: 'North' },
  { value: 'NE', label: 'North-east' },
  { value: 'E', label: 'East' },
  { value: 'SE', label: 'South-east' },
  { value: 'S', label: 'South' },
  { value: 'SW', label: 'South-west' },
  { value: 'W', label: 'West' },
  { value: 'NW', label: 'North-west' },
];

export interface LampSettings {
  on: boolean;
  /** Multiplier on the lamp's base intensity, 0–3. */
  strength: number;
  /** −1 cool white … 0 the usual warm bulb … 1 amber. */
  warmth: number;
  /** Multiplier on the beam's angle, 0.5–1.6. */
  spread: number;
}

export interface SceneLighting {
  /** Multiplier on the room's light (hemisphere, ambient, key), 0.1–2. */
  brightness: number;
  /** −1 cool … 1 warm, applied to the room's light colours. */
  warmth: number;
  keyFrom: KeyFrom;
  /** Elevation of the key light in degrees, 5–85; unused when `keyFrom` is 'venue'. */
  keyHeight: number;
  /** Multiplier on the key light alone, 0–3. */
  keyStrength: number;
  /** Background colour as `#rrggbb`, or null for the venue's own. */
  background: string | null;
  lamps: LampSettings;
}


export const DEFAULT_LIGHTING: SceneLighting = {
  brightness: 1,
  warmth: 0,
  keyFrom: 'venue',
  keyHeight: 45,
  keyStrength: 1,
  background: null,
  lamps: { on: true, strength: 1, warmth: 0, spread: 1 },
};

export type LightPresetId = 'daylight' | 'overcast' | 'evening' | 'night' | 'studio';

/** Starting points; every slider stays free after one is chosen. Daylight is the venues as built. */
export const LIGHT_PRESETS: ReadonlyArray<{ id: LightPresetId; label: string; lighting: SceneLighting }> = [
  { id: 'daylight', label: 'Daylight', lighting: DEFAULT_LIGHTING },
  {
    id: 'overcast',
    label: 'Overcast',
    lighting: {
      ...DEFAULT_LIGHTING,
      brightness: 0.85,
      warmth: -0.4,
      keyStrength: 0.25,
      lamps: { on: true, strength: 0.8, warmth: 0, spread: 1 },
    },
  },
  {
    id: 'evening',
    label: 'Evening',
    lighting: {
      ...DEFAULT_LIGHTING,
      brightness: 0.5,
      warmth: 0.7,
      keyFrom: 'W',
      keyHeight: 10,
      keyStrength: 0.9,
      lamps: { on: true, strength: 1.4, warmth: 0.3, spread: 1 },
    },
  },
  {
    id: 'night',
    label: 'Gallery night',
    lighting: {
      ...DEFAULT_LIGHTING,
      brightness: 0.18,
      keyStrength: 0,
      background: '#040507',
      lamps: { on: true, strength: 2.2, warmth: 0, spread: 0.85 },
    },
  },
  {
    id: 'studio',
    label: 'Studio',
    lighting: {
      ...DEFAULT_LIGHTING,
      brightness: 1.25,
      warmth: -0.15,
      keyStrength: 1.3,
      background: '#1b1c1f',
      lamps: { on: true, strength: 0.5, warmth: -0.4, spread: 1.2 },
    },
  },
];

const BOUNDS = {
  brightness: [0.1, 2],
  warmth: [-1, 1],
  keyHeight: [5, 85],
  keyStrength: [0, 3],
  lampStrength: [0, 3],
  lampWarmth: [-1, 1],
  lampSpread: [0.5, 1.6],
} as const;
export const LIGHTING_BOUNDS = BOUNDS;

function bound(value: unknown, [lo, hi]: readonly [number, number], fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.min(hi, Math.max(lo, n)) * 1000) / 1000;
}

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Any stored or sent value to a complete, bounded `SceneLighting`. Missing or
 * malformed fields take the default, so an empty document is the room as built.
 */
export function normalizeLighting(raw: unknown): SceneLighting {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const l = r.lamps && typeof r.lamps === 'object' ? (r.lamps as Record<string, unknown>) : {};
  const d = DEFAULT_LIGHTING;
  return {
    brightness: bound(r.brightness, BOUNDS.brightness, d.brightness),
    warmth: bound(r.warmth, BOUNDS.warmth, d.warmth),
    keyFrom: KEY_FROM.some((k) => k.value === r.keyFrom) ? (r.keyFrom as KeyFrom) : d.keyFrom,
    keyHeight: bound(r.keyHeight, BOUNDS.keyHeight, d.keyHeight),
    keyStrength: bound(r.keyStrength, BOUNDS.keyStrength, d.keyStrength),
    background: typeof r.background === 'string' && HEX.test(r.background) ? r.background.toLowerCase() : null,
    lamps: {
      on: typeof l.on === 'boolean' ? l.on : d.lamps.on,
      strength: bound(l.strength, BOUNDS.lampStrength, d.lamps.strength),
      warmth: bound(l.warmth, BOUNDS.lampWarmth, d.lamps.warmth),
      spread: bound(l.spread, BOUNDS.lampSpread, d.lamps.spread),
    },
  };
}


/** The preset these settings match, or null when they have been adjusted ("Custom"). */
export function presetOf(lighting: SceneLighting): LightPresetId | null {
  const same = (a: SceneLighting, b: SceneLighting) =>
    JSON.stringify(normalizeLighting(a)) === JSON.stringify(normalizeLighting(b));
  return LIGHT_PRESETS.find((p) => same(p.lighting, lighting))?.id ?? null;
}

/** Unit vector toward the key light for a compass point and elevation, north = −Z. */
export function keyDirection(from: Exclude<KeyFrom, 'venue'>, heightDeg: number): [number, number, number] {
  const azimuth = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 }[from] * (Math.PI / 180);
  const h = heightDeg * (Math.PI / 180);
  return [Math.cos(h) * Math.sin(azimuth), Math.sin(h), -Math.cos(h) * Math.cos(azimuth)];
}

// ── Colour ──────────────────────────────────────────────────────────────────

/** Mix two `#rrggbb` colours; t = 0 is `a`. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const out = [16, 8, 0].map((s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const ROOM_WARM = '#ffc98f';
const ROOM_COOL = '#c4d8ff';
/** How far full warmth moves a room colour toward the warm or cool end. */
const ROOM_TINT = 0.55;

/** A room light's colour, warmed or cooled. */
export function tintRoom(base: string, warmth: number): string {
  if (warmth === 0) return base;
  return mixHex(base, warmth > 0 ? ROOM_WARM : ROOM_COOL, Math.abs(warmth) * ROOM_TINT);
}

const LAMP_BASE = '#ffd9a6';
const LAMP_AMBER = '#ffad5c';
const LAMP_WHITE = '#f4f3ff';

/** The picture lamps' colour: the usual warm bulb at 0. */
export function lampColour(warmth: number): string {
  if (warmth === 0) return LAMP_BASE;
  return mixHex(LAMP_BASE, warmth > 0 ? LAMP_AMBER : LAMP_WHITE, Math.abs(warmth));
}

// ── Picture lamps ───────────────────────────────────────────────────────────

/** Where a piece's lamp is, relative to the piece. */
export type LampAt = 'above' | 'above-left' | 'above-right' | 'pair' | 'uplight' | 'wash' | 'off';

export const LAMP_POINTS: ReadonlyArray<{ value: LampAt; label: string }> = [
  { value: 'above', label: 'Above, centred' },
  { value: 'above-left', label: 'Above, from the left' },
  { value: 'above-right', label: 'Above, from the right' },
  { value: 'pair', label: 'A pair above' },
  { value: 'uplight', label: 'From below' },
  { value: 'wash', label: 'Wash from the ceiling' },
  { value: 'off', label: 'No lamp' },
];

/**
 * A piece's lamp as stored (`art_installation_piece.lamp`). `offset` is
 * reserved for a freely placed lamp ([along, up, out] metres from the piece's
 * centre); nothing reads it yet.
 */
export interface PieceLamp {
  at: LampAt;
  offset?: [number, number, number] | null;
}

export const DEFAULT_LAMP: PieceLamp = { at: 'above' };

export function isLampAt(value: unknown): value is LampAt {
  return LAMP_POINTS.some((p) => p.value === value);
}

/** Any stored or sent value to a valid lamp; unknown points become 'above'. */
export function normalizeLamp(raw: unknown): PieceLamp {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const at = isLampAt(r.at) ? r.at : 'above';
  const o = Array.isArray(r.offset) ? r.offset.map(Number) : null;
  const offset =
    o && o.length === 3 && o.every((v) => Number.isFinite(v) && Math.abs(v) <= 5)
      ? (o.map((v) => Math.round(v * 1000) / 1000) as [number, number, number])
      : null;
  return offset ? { at, offset } : { at };
}

export function placementLamp(p: { lamp?: PieceLamp | null }): LampAt {
  return isLampAt(p.lamp?.at) ? p.lamp!.at : 'above';
}

/**
 * One lamp, in the piece's frame: `u` along the wall from the piece's centre,
 * `v` world height, `d` out from the wall; the beam aims at (`tu`, `tv`) on
 * the wall. `share` multiplies the intensity, so a pair is not twice as bright.
 */
export interface LampRig {
  u: number;
  v: number;
  d: number;
  tu: number;
  tv: number;
  angle: number;
  share: number;
  distance: number;
}

/**
 * The lamps for one piece at a fixed point. The 'above' case is the lamp the
 * hallway has always had: 0.45 m off the wall, 12 cm above the top edge,
 * aimed a little below the centre, its angle from the piece's width.
 */
export function lampRigs(at: LampAt, size: { width: number; height: number }, centreY: number, spread: number): LampRig[] {
  const { width: w, height: h } = size;
  const top = centreY + h / 2;
  const bottom = centreY - h / 2;
  const angle = (base: number, max: number) => Math.min(max, base) * spread;
  const usual = angle(0.45 + w * 0.3, 1.1);
  switch (at) {
    case 'off':
      return [];
    case 'above-left':
    case 'above-right': {
      const side = at === 'above-left' ? -1 : 1;
      return [
        {
          u: side * (w * 0.45 + 0.1),
          v: top + 0.15,
          d: 0.5,
          tu: -side * w * 0.1,
          tv: centreY - h * 0.1,
          angle: usual,
          share: 1,
          distance: 4,
        },
      ];
    }
    case 'pair': {
      const u = Math.max(w * 0.28, 0.12);
      const a = angle(0.35 + w * 0.18, 0.9);
      return [-1, 1].map((s) => ({
        u: s * u,
        v: top + 0.1,
        d: 0.42,
        tu: s * u * 0.6,
        tv: centreY - h * 0.15,
        angle: a,
        share: 0.65,
        distance: 4,
      }));
    }
    case 'uplight':
      return [
        { u: 0, v: Math.max(0.05, bottom - 0.35), d: 0.35, tu: 0, tv: centreY + h * 0.2, angle: usual, share: 1, distance: 4 },
      ];
    case 'wash':
      return [
        { u: 0, v: top + 0.7, d: 1.5, tu: 0, tv: centreY, angle: angle(0.6 + w * 0.3, 1.2), share: 0.7, distance: 7 },
      ];
    case 'above':
    default:
      return [{ u: 0, v: top + 0.12, d: 0.45, tu: 0, tv: centreY - h * 0.15, angle: usual, share: 1, distance: 4 }];
  }
}

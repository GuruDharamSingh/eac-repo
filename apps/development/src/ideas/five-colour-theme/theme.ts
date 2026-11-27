// The structure itself, as plain functions: palette -> shades -> roles -> tones. No React, no storage.
import { contrast, luminance, normHex, onColor, roleRamp } from "./gradients";
import { FIXED_RED, FIXED_RED_INDEX, ROLE_ORDER, type Pointer, type RoleKey, type Shade, type SiteState, type Tone } from "./data";

export type Ramp = Record<number, string>;
export type RoleSet = Record<RoleKey | "onAccent", string>;

export interface Resolved {
  seeds: string[];
  ramps: Ramp[];
  roles: RoleSet;
  tones: Record<Tone, RoleSet>;
}

/** #rgb or #rrggbb, with or without the hash, to lower-case #rrggbb. null when it is not a colour. */
export function cleanHex(v: string): string | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(v.trim());
  if (!m) return null;
  let h = m[1].toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return "#" + h;
}

export function resolve(st: SiteState): Resolved {
  const seeds = [...st.colours.slice(0, 5).map((h) => cleanHex(h) ?? "#808080"), FIXED_RED];
  // The same shade maker as the real tool (packages/gradients roleRamp, OKLCH).
  const ramps = seeds.map((s) => roleRamp(normHex(s) ?? s) as Ramp);
  const at = ([i, s]: Pointer): string => (s === 0 ? seeds[i] : ramps[i][s]);

  const roles = {} as RoleSet;
  for (const r of ROLE_ORDER) roles[r] = at(st.pointers[r]).toLowerCase();

  // On-accent: whichever of the palette's lightest / darkest contrasts more with the accent.
  const light = [...seeds.slice(0, 5), ...ramps.slice(0, 5).map((r) => r[100])].sort((a, b) => luminance(b) - luminance(a))[0];
  const dark = [...seeds.slice(0, 5), ...ramps.slice(0, 5).map((r) => r[900])].sort((a, b) => luminance(a) - luminance(b))[0];
  roles.onAccent = onColor(roles.accent, light, dark);

  // Tones re-point the roles inside one section. Deep: the ink colour's dark shade as ground, the ground as ink.
  const inkIdx = st.pointers.ink[0] === FIXED_RED_INDEX ? 0 : st.pointers.ink[0];
  const groundIdx = st.pointers.ground[0] === FIXED_RED_INDEX ? 0 : st.pointers.ground[0];
  const deep: RoleSet = {
    ...roles,
    ground: ramps[inkIdx][900],
    panel: ramps[inkIdx][800],
    soft: ramps[inkIdx][800],
    ink: roles.ground,
    muted: ramps[groundIdx][300],
    line: ramps[inkIdx][700],
  };
  const accent: RoleSet = {
    ...roles,
    ground: roles.accent,
    panel: roles.accent,
    soft: roles.accent,
    ink: roles.onAccent,
    muted: roles.onAccent,
    line: roles.onAccent,
    accent: roles.onAccent,
    accent2: roles.onAccent,
    accent3: roles.onAccent,
    onAccent: roles.accent,
    danger: roles.onAccent,
  };
  const soft: RoleSet = { ...roles, ground: roles.soft };
  return { seeds, ramps, roles, tones: { plain: roles, soft, deep, accent } };
}

const VAR: Record<keyof RoleSet, string> = {
  ground: "--r-ground",
  panel: "--r-panel",
  soft: "--r-soft",
  ink: "--r-ink",
  muted: "--r-muted",
  line: "--r-line",
  accent: "--r-accent",
  accent2: "--r-accent2",
  accent3: "--r-accent3",
  onAccent: "--r-onaccent",
  danger: "--r-danger",
};

/** The role set as CSS custom properties, for a style attribute. */
export function roleVars(set: RoleSet): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(VAR) as (keyof RoleSet)[]) out[VAR[k]] = set[k];
  return out;
}

export const ratio = (a: string, b: string) => contrast(a, b);

export function shadeLabel(s: Shade) {
  return s === 0 ? "as chosen" : `shade ${s}`;
}

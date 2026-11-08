// ============================================================================
// Role ramps: 100–900 tonal steps for an org's accent, second accent and
// neutral, plus each filled colour's `-on` (text on it) and `-ink` (the colour
// as small text on the page). Shared by the hub cards (--hc-*) and the
// publication forms (--frm-*), which both read the `--eac-*` names below as a
// fallback level ahead of the host's --sf-* (agreed 2026-11-08, hub-cards
// PLAN §1.3 / publishing-forms PLAN §5).
//
// Literal hex out, never color-mix(): Next's minifier writes a raw-accent
// fallback for color-mix (docs frontend-ui.md), and site_themes stores plain
// values. Computed at brand-kit save (saveSiteTheme) or in a server theme
// loader for orgs that have none.
//
// The lightness scale is the Industry design system's (one OKLCH L per step,
// shared by every role so the same step of any role matches in value); the
// chroma curve follows its accent ramp: full at 500, tapering to the ends.
// ============================================================================

import { contrast, hexToOklch, normHex, oklchToHex } from "./color";

export const RAMP_STEPS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export type RampStep = (typeof RAMP_STEPS)[number];

const L_SCALE: Record<RampStep, number> = {
  100: 0.97, 200: 0.931, 300: 0.871, 400: 0.78, 500: 0.681, 600: 0.58, 700: 0.481, 800: 0.381, 900: 0.291,
};
const C_CURVE: Record<RampStep, number> = {
  100: 0.2, 200: 0.48, 300: 0.86, 400: 0.97, 500: 1, 600: 0.97, 700: 0.86, 800: 0.71, 900: 0.49,
};

/** One role's ramp from a seed colour. Hue is kept; chroma follows the curve; out-of-gamut steps give up chroma. */
export function roleRamp(seed: string, opts: { maxChroma?: number } = {}): Record<RampStep, string> {
  const [, C, H] = hexToOklch(normHex(seed) ?? "#808080");
  const c = opts.maxChroma === undefined ? C : Math.min(C, opts.maxChroma);
  const out = {} as Record<RampStep, string>;
  for (const s of RAMP_STEPS) out[s] = oklchToHex([L_SCALE[s], c * C_CURVE[s], H]);
  return out;
}

/** Whichever of the two contrasts more with `fill` (README: "paper or ink, whichever contrasts more"). */
export function onColor(fill: string, light: string, dark: string): string {
  return contrast(fill, light) >= contrast(fill, dark) ? light : dark;
}

/** The lightest step from 600 down that reads as small text on `bg` (≥ 4.5); 900 when none does. */
export function inkStep(ramp: Record<RampStep, string>, bg: string, min = 4.5): string {
  for (const s of [600, 700, 800, 900] as const) if (contrast(ramp[s], bg) >= min) return ramp[s];
  return ramp[900];
}

export interface RoleRampInput {
  accent: string;
  accent2?: string | null;
  /** Seed for the neutral ramp; defaults to the text colour, kept near-grey. */
  neutral?: string | null;
  bg: string;
  text: string;
}

/**
 * `--eac-accent-100…900`, `--eac-accent-2-100…900`, `--eac-neutral-100…900`,
 * `--eac-accent-on`, `--eac-accent-ink`, `--eac-accent-2-on`, `--eac-accent-2-ink`.
 * Every name passes the site_themes sanitizer (^--[a-z0-9-]{1,60}$) and every value is #rrggbb.
 */
export function deriveRoleRamps(input: RoleRampInput): Record<string, string> {
  const bg = normHex(input.bg) ?? "#ffffff";
  const text = normHex(input.text) ?? "#111111";
  const accent = normHex(input.accent) ?? text;
  const accent2 = normHex(input.accent2 ?? null) ?? accent;
  const neutralSeed = normHex(input.neutral ?? null) ?? text;

  const out: Record<string, string> = {};
  const put = (role: string, ramp: Record<RampStep, string>) => {
    for (const s of RAMP_STEPS) out[`--eac-${role}-${s}`] = ramp[s].toLowerCase();
  };
  const a = roleRamp(accent);
  const a2 = roleRamp(accent2);
  put("accent", a);
  put("accent-2", a2);
  put("neutral", roleRamp(neutralSeed, { maxChroma: 0.006 }));
  out["--eac-accent-on"] = onColor(accent, bg, text);  // inputs are normHex (lowercase)
  out["--eac-accent-ink"] = inkStep(a, bg);
  out["--eac-accent-2-on"] = onColor(accent2, bg, text);
  out["--eac-accent-2-ink"] = inkStep(a2, bg);
  return out;
}

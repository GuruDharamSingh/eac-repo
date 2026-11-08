// ============================================================================
// Palettes and ramps for EAC gradients.
//
// ELEMENTAL: the pure pigments named on the EAC logo sheets ("Elemental colour
// palette, Bon / shamanism"). They are the inputs, not what the artwork shows:
// measured on the sheets (2026-11-07), the logo ink runs at OKLCH chroma
// 0.07-0.09 and lightness 0.40-0.87, a muted mineral wash over black. So most
// presets below use the measured ink, and `mute` brings any pure pigment down.
//
// RAMPS: colour flows traced along the letters and rings of the two sheets.
// The most frequent transitions were gold > orange > red, turquoise > green >
// gold, blue <> turquoise, and blue > purple > bone.
//
// BON_MINERAL: the three combinations taken from the Bon mandala and the
// tsakli card (Elkdonis Arts Collective/palettes/bon-mineral).
// ============================================================================

export interface Pigment {
  id: string;
  label: string;
  hex: string;
}

export const ELEMENTAL: readonly Pigment[] = [
  { id: "lapis", label: "Lapis blue", hex: "#1F4E9A" },
  { id: "turquoise", label: "Turquoise", hex: "#2CA6A4" },
  { id: "forest", label: "Forest green", hex: "#2E6B3F" },
  { id: "gold", label: "Gold", hex: "#D4A017" },
  { id: "orange", label: "Orange", hex: "#D45A1F" },
  { id: "red", label: "Red", hex: "#B42A2A" },
  { id: "purple", label: "Purple", hex: "#6B3B8F" },
  { id: "white", label: "White", hex: "#F5F5E5" },
  { id: "black", label: "Black", hex: "#000000" },
];

/** Measured logo ink (k-means on the two sheets), cool to warm. */
export const LOGO_INK: readonly Pigment[] = [
  { id: "ink-lapis", label: "Ink lapis", hex: "#3E6EA2" },
  { id: "ink-sky", label: "Ink sky", hex: "#5C85A9" },
  { id: "ink-teal", label: "Ink teal", hex: "#286176" },
  { id: "ink-turquoise", label: "Ink turquoise", hex: "#46A2AB" },
  { id: "ink-sage", label: "Ink sage", hex: "#6D8B6C" },
  { id: "ink-gold", label: "Ink gold", hex: "#BA8A43" },
  { id: "ink-amber", label: "Ink amber", hex: "#DA9A51" },
  { id: "ink-orange", label: "Ink orange", hex: "#CA743B" },
  { id: "ink-vermilion", label: "Ink vermilion", hex: "#BE522B" },
  { id: "ink-red", label: "Ink red", hex: "#9D2C28" },
  { id: "ink-purple", label: "Ink purple", hex: "#77448A" },
  { id: "ink-lavender", label: "Ink lavender", hex: "#7A6885" },
  { id: "ink-bone", label: "Ink bone", hex: "#E2D7C8" },
  { id: "ink-cream", label: "Ink cream", hex: "#D9BC8C" },
];

export interface Ramp {
  id: string;
  label: string;
  /** Hex stops, evenly spaced unless `at` is given (0..100). */
  colors: string[];
  at?: number[];
  note: string;
}

export const RAMPS: readonly Ramp[] = [
  { id: "spectrum", label: "Spectrum", colors: ["#407C83", "#6D8B6C", "#BA8A43", "#A85B38", "#8B2824"],
    note: "The EAC wordmark: turquoise through sage and gold to red." },
  { id: "ember", label: "Ember", colors: ["#D9BC8C", "#DA9A51", "#CA743B", "#BE522B", "#9D2C28"],
    note: "Gold > orange > red, the most frequent flow on the sheets." },
  { id: "tide", label: "Tide", colors: ["#3E6EA2", "#46A2AB", "#9AAFA2"],
    note: "Lapis to turquoise to a sea-bone." },
  { id: "veil", label: "Veil", colors: ["#77448A", "#7A6885", "#E2D7C8"],
    note: "Purple fading to bone, the lavender ring logos." },
  { id: "night-ring", label: "Night ring", colors: ["#3E6EA2", "#77448A", "#BE522B"],
    note: "Blue > purple > vermilion, the outer rings." },
  { id: "bone-gold", label: "Bone gold", colors: ["#E2D7C8", "#D9BC8C", "#BA8A43"],
    note: "The cream EAC monogram." },
  { id: "elements", label: "Five elements", colors: ["#2C4A96", "#548A5C", "#E4CC4E", "#C9483E", "#E8E4D6"],
    note: "Bon elements as tsakli pigments: water, wind, earth, fire, space." },
];

export interface Combo {
  id: string;
  label: string;
  ground: string;
  light: string;
  mark: string;
}

export const BON_MINERAL: readonly Combo[] = [
  { id: "tsakli-card", label: "Tsakli card", ground: "#2A5A83", light: "#C3BFB5", mark: "#BC5149" },
  { id: "moss-orpiment", label: "Moss & orpiment", ground: "#37362D", light: "#6A7853", mark: "#C1AF6E" },
  { id: "mandala-dusk", label: "Mandala dusk", ground: "#2C2B46", light: "#7F9364", mark: "#B77669" },
];

/** Every swatch an editor offers in its colour pickers. */
export const SWATCHES: readonly string[] = [
  ...ELEMENTAL.map((p) => p.hex),
  ...LOGO_INK.map((p) => p.hex),
  ...BON_MINERAL.flatMap((c) => [c.ground, c.light, c.mark]),
];

/**
 * Box templates: the treatments from the hand mock-ups (BrokenColumns,
 * BoxStudies, FieldStructures, the Opus pages) as data the generator can
 * draw on. A template is a layout kind plus a voice: faces, scale of the
 * head against the body, border, fill, ink, reverse, radius, shadow, and
 * which head device goes with it. Each has affinities to keyframes; the
 * local theme biases the draw, the heterogeneity dial flattens it, and no
 * template is ever excluded, so colour and odd faces can turn up anywhere
 * and a region shows its theme as a majority, not a rule.
 */
import type { UnitKind, HeadDevice } from "./catalog";

export interface Palette {
  id: string;
  ink: string;
  accent: string;
  second: string;
  fill: string;
  tint: string;
}

/** Colour palettes from the specimens. A region picks one; boxes take fills from it. */
export const PALETTES: Palette[] = [
  { id: "mono", ink: "#161412", accent: "#161412", second: "#555", fill: "#e4e0d6", tint: "#eceae3" },
  { id: "observer", ink: "#161412", accent: "#d7261e", second: "#2a9fd6", fill: "#ffe600", tint: "#fff5a8" },
  { id: "bazaar", ink: "#161412", accent: "#d7261e", second: "#f26a1b", fill: "#ffd21f", tint: "#f9cfdc" },
  { id: "mosaic", ink: "#111", accent: "#d7261e", second: "#1f3f99", fill: "#f6e7a6", tint: "#e6f0fb" },
  { id: "comic", ink: "#1b1714", accent: "#b42a22", second: "#1b1714", fill: "#f6e9bd", tint: "#f6c4c8" },
  { id: "herald", ink: "#141414", accent: "#e8502b", second: "#1f3f99", fill: "#fbe3d8", tint: "#f9cfdc" },
  { id: "weekly", ink: "#1a1a1a", accent: "#c4262e", second: "#1a1a1a", fill: "#d9d9d9", tint: "#f2f2f2" },
  { id: "green", ink: "#161412", accent: "#3aa335", second: "#0e8a8a", fill: "#e8f4e8", tint: "#dff0ee" },
];

export interface Template {
  id: string;
  kind: UnitKind;
  /** Keyframe affinities 0–1 (unlisted = 0.05). */
  aff: Record<string, number>;
  base: number;
  fontHead?: string;
  fontBody?: string;
  fontDisplay?: string;
  /** Head size as a multiple of body size. */
  headScale?: number;
  /** Body size multiplier. */
  bodyScale?: number;
  border?: "rule" | "solid" | "heavy" | "double" | "dashed" | "rounded" | "none" | "outline";
  /** Which palette slot fills the box: none, fill, tint, accent (reversed in accent), ink (reversed). */
  fill?: "none" | "fill" | "tint" | "accent" | "ink" | "second" | "white";
  /** Border colour slot. */
  edge?: "ink" | "accent" | "second";
  shadow?: boolean;
  align?: "center" | "justify" | "left";
  /** Prefers to span two columns. */
  wide?: number;
  /** Extra class for a rule in microfiche.css. */
  cls?: string;
  /** Stands out: drawn seldom and at most a couple of times per zone. */
  rare?: boolean;
}

const F = {
  caslon: "'Libre Caslon Text', Georgia, serif",
  caslonD: "'Libre Caslon Display', Georgia, serif",
  playfair: "'Playfair Display', Georgia, serif",
  oldstd: "'Old Standard TT', Georgia, serif",
  tinos: "'Tinos', 'Times New Roman', serif",
  sserif: "'Source Serif 4', Georgia, serif",
  spartan: "'League Spartan', 'Arial Black', sans-serif",
  robcon: "'Roboto Condensed', 'Arial Narrow', sans-serif",
  arimo: "'Arimo', Arial, sans-serif",
  archivo: "'Archivo Black', 'Arial Black', sans-serif",
  anton: "'Anton', Impact, sans-serif",
  oswald: "'Oswald', 'Arial Narrow', sans-serif",
  pathway: "'Pathway Gothic One', 'Arial Narrow', sans-serif",
  ultra: "'Ultra', serif",
  rye: "'Rye', serif",
  alfa: "'Alfa Slab One', serif",
  bowlby: "'Bowlby One', 'Arial Black', sans-serif",
  righteous: "'Righteous', 'Arial Black', sans-serif",
  pinyon: "'Pinyon Script', cursive",
  fraktur: "'UnifrakturMaguntia', serif",
  courier: "'Courier Prime', 'Courier New', monospace",
};
export const EXTRA_FONTS = ["Playfair Display", "Pinyon Script", "UnifrakturMaguntia", "Righteous", "Bowlby One", "Alfa Slab One", "Archivo Black", "Anton", "Oswald", "Pathway Gothic One", "Ultra", "Rye", "League Spartan", "Source Serif 4", "Roboto Condensed", "Arimo", "Tinos", "Old Standard TT", "Libre Caslon Text", "Libre Caslon Display", "Courier Prime"];

export const TEMPLATES: Template[] = [
  // ---- liners -----------------------------------------------------------
  { id: "agate-caps", kind: "liner", aff: { wantads: 1, ledger: .8, dense: .6 }, base: 3, fontBody: F.sserif, align: "justify" },
  { id: "agate-bold", kind: "liner", aff: { dense: 1, bazaar: .9, tabloid: .7 }, base: 3, fontBody: F.tinos, bodyScale: .92, align: "justify" },
  { id: "liner-sans", kind: "liner", aff: { weekly: .8, tabloid: 1, photosheet: .8 }, base: 2.5, fontBody: F.arimo, align: "left" },
  { id: "liner-condensed", kind: "liner", aff: { tabloid: 1, cinemafare: .8, lovelines: .7 }, base: 2, fontBody: F.robcon, bodyScale: .95, align: "justify" },
  { id: "liner-oldstyle", kind: "liner", aff: { ledger: 1, woodtype: .6 }, base: 2, fontBody: F.oldstd, bodyScale: 1.05, align: "justify" },
  { id: "liner-tint-pink", kind: "liner-tint", aff: { bazaar: 1, wantads: .6, dense: .5 }, base: 1.5, fontBody: F.tinos, fill: "tint" },
  { id: "liner-tint-yellow", kind: "liner-tint", aff: { weekly: .8, mosaic: .6 }, base: 1, fontBody: F.arimo, fill: "fill" },
  // ---- boxed liners -------------------------------------------------------
  { id: "boxed-spartan", kind: "boxed", aff: { wantads: 1, weekly: .7 }, base: 2, fontHead: F.spartan, fontBody: F.sserif, headScale: 1.3, border: "solid" },
  { id: "boxed-caslon", kind: "boxed", aff: { weekly: 1, photosheet: .6 }, base: 2, fontHead: F.caslon, fontBody: F.arimo, headScale: 1.3, border: "solid" },
  { id: "boxed-rounded", kind: "boxed", aff: { weekly: .8, tabloid: .6, mosaic: .5 }, base: 1.2, fontHead: F.playfair, fontBody: F.arimo, headScale: 1.35, border: "rounded" },
  { id: "boxed-yellow", kind: "boxed", aff: { weekly: .7, bazaar: .8, mosaic: .7 }, base: 1.2, fontHead: F.arimo, fontBody: F.arimo, headScale: 1.2, border: "solid", fill: "fill" },
  { id: "boxed-blue", rare: true, kind: "boxed", aff: { weekly: .6, mosaic: .6 }, base: .8, fontHead: F.arimo, fontBody: F.arimo, headScale: 1.2, border: "solid", fill: "second" },
  { id: "boxed-gradient", rare: true, kind: "boxed", aff: { weekly: .7, tabloid: .6 }, base: .8, fontHead: F.arimo, fontBody: F.arimo, headScale: 1.2, border: "solid", cls: "cl-t-gradient" },
  { id: "boxed-typewriter", kind: "boxed", aff: { backpages: .8, weekly: .5, vacancies: .5 }, base: 1, fontHead: F.courier, fontBody: F.courier, headScale: 1.1, border: "solid", align: "left" },
  { id: "boxed-oldstyle-double", kind: "boxed", aff: { ledger: 1, woodtype: .7 }, base: 1.2, fontHead: F.oldstd, fontBody: F.oldstd, headScale: 1.25, border: "outline" },
  // ---- displays -----------------------------------------------------------
  { id: "display-pathway", kind: "display", aff: { wantads: 1, cinemafare: .5 }, base: 2, fontDisplay: F.pathway, fontBody: F.sserif, headScale: 4.4, border: "solid", wide: .5 },
  { id: "display-anton", kind: "display", aff: { weekly: .8, mosaic: 1, notices: .8, tabloid: .7 }, base: 2, fontDisplay: F.anton, fontBody: F.arimo, headScale: 3.2, border: "solid" },
  { id: "display-ultra", kind: "display", aff: { woodtype: 1, ledger: .5 }, base: 1.5, fontDisplay: F.ultra, fontBody: F.oldstd, headScale: 2.8, border: "double", shadow: false },
  { id: "display-rye", kind: "display", aff: { woodtype: .9, backpages: .8, ledger: .5 }, base: 1.2, fontDisplay: F.rye, fontBody: F.oldstd, headScale: 2.6, border: "solid", shadow: true },
  { id: "display-playfair", kind: "display", aff: { weekly: .8, ledger: .5 }, base: 1.5, fontDisplay: F.playfair, fontBody: F.caslon, headScale: 2.8, border: "rule" },
  { id: "display-blackletter", rare: true, kind: "display", aff: { weekly: .4, woodtype: .5, ledger: .3 }, base: .7, fontDisplay: F.fraktur, fontBody: F.fraktur, headScale: 2.4, bodyScale: 1.2, border: "solid" },
  { id: "display-righteous", rare: true, kind: "display", aff: { vacancies: 1, mosaic: .5, weekly: .4 }, base: 1, fontDisplay: F.righteous, fontBody: F.arimo, headScale: 3, border: "heavy", align: "left", wide: .5 },
  { id: "display-dq", rare: true, kind: "display", aff: { weekly: .8, tabloid: .5 }, base: 1, fontDisplay: F.alfa, fontBody: F.caslon, headScale: 3, bodyScale: 1.1, border: "heavy", cls: "cl-t-italic" },
  { id: "display-script-card", rare: true, kind: "card", aff: { weekly: 1, mosaic: .6, photosheet: .5 }, base: 1.2, fontDisplay: F.pinyon, fontHead: F.archivo, fontBody: F.arimo, headScale: 3, border: "heavy" },
  { id: "display-red-mosaic", kind: "display", aff: { mosaic: 1, bazaar: .6 }, base: 1.2, fontDisplay: F.anton, fontBody: F.arimo, headScale: 3, border: "heavy", edge: "accent", cls: "cl-t-accent-head" },
  { id: "display-blue-mosaic", kind: "display", aff: { mosaic: 1, bazaar: .4 }, base: 1, fontDisplay: F.archivo, fontBody: F.tinos, headScale: 2.2, border: "dashed", edge: "second", fill: "fill" },
  { id: "display-teal", kind: "display", aff: { mosaic: .9 }, base: .8, fontDisplay: F.tinos, fontBody: F.tinos, headScale: 2.6, border: "heavy", edge: "second", fill: "tint", cls: "cl-t-second-head" },
  { id: "display-reverse-anton", kind: "reverse", aff: { notices: 1, weekly: .6, tabloid: .6, cinemafare: .5 }, base: 1.2, fontDisplay: F.anton, fontBody: F.arimo, headScale: 3.4, fill: "ink" },
  { id: "display-reverse-red", rare: true, kind: "reverse", aff: { mosaic: 1, bazaar: .7, weekly: .5 }, base: 1, fontDisplay: F.anton, fontBody: F.tinos, headScale: 2.8, fill: "accent" },
  { id: "display-reverse-comic", rare: true, kind: "reverse", aff: { backpages: 1 }, base: .8, fontDisplay: F.rye, fontBody: F.courier, headScale: 2.6, fill: "ink", cls: "cl-t-comic-rev" },
  { id: "display-yellow-phone", rare: true, kind: "display", aff: { bazaar: 1, weekly: .4 }, base: 1.5, fontDisplay: F.archivo, fontBody: F.arimo, headScale: 1.8, border: "heavy", edge: "accent", fill: "fill", cls: "cl-t-phone" },
  { id: "display-rainbow", rare: true, kind: "house", aff: { mosaic: 1, weekly: .3 }, base: .6, fontDisplay: F.anton, fontBody: F.arimo, headScale: 3, border: "heavy", edge: "second", cls: "cl-t-rainbow" },
  { id: "display-woodtype-reverse", rare: true, kind: "reverse", aff: { woodtype: 1 }, base: .7, fontDisplay: F.ultra, fontBody: F.oldstd, headScale: 2.4, fill: "ink", cls: "cl-t-wood-rev" },
  // ---- notices ----------------------------------------------------------
  { id: "notice-anton", kind: "notice", aff: { notices: 1, weekly: .6 }, base: 2, fontHead: F.anton, fontBody: F.arimo, headScale: 2.2, border: "solid", fill: "white" },
  { id: "notice-slab", kind: "notice", aff: { notices: .8, weekly: .7, lovelines: .5 }, base: 1.2, fontHead: F.alfa, fontBody: F.arimo, headScale: 1.8, border: "solid", fill: "white", cls: "cl-t-italic-sign" },
  { id: "notice-memoriam", kind: "notice", aff: { notices: 1, ledger: .4 }, base: .8, fontHead: F.anton, fontBody: F.caslon, headScale: 2, border: "heavy", fill: "white", align: "center" },
  { id: "notice-reversed-head", rare: true, kind: "notice", aff: { notices: 1 }, base: .9, fontHead: F.anton, fontBody: F.arimo, headScale: 3.6, border: "solid", fill: "white", cls: "cl-t-rev-head" },
  // ---- stacks, offers, coupons, posters, personals, listings, profiles, editorial
  { id: "stack-howe", kind: "stack", aff: { woodtype: 1, ledger: .3 }, base: 2, fontDisplay: F.ultra, fontHead: F.rye, fontBody: F.oldstd, headScale: 2.4, border: "rule" },
  { id: "stack-rye", kind: "stack", aff: { woodtype: 1, backpages: .4 }, base: 1.2, fontDisplay: F.rye, fontHead: F.oldstd, fontBody: F.oldstd, headScale: 2.2, border: "rule" },
  { id: "offer-comic", kind: "offer", aff: { backpages: 1, mosaic: .3 }, base: 2, fontHead: F.archivo, fontBody: F.courier, fontDisplay: F.alfa, headScale: 1.7, border: "solid", fill: "fill" },
  { id: "offer-reverse", kind: "offer", aff: { backpages: .8 }, base: .6, fontHead: F.archivo, fontBody: F.courier, fontDisplay: F.rye, headScale: 1.6, fill: "ink" },
  { id: "coupon-comic", rare: true, kind: "coupon", aff: { backpages: 1, vacancies: .7, weekly: .3 }, base: 1, fontHead: F.archivo, fontBody: F.courier, headScale: 2, border: "dashed", fill: "fill", wide: .7 },
  { id: "coupon-arimo", rare: true, kind: "coupon", aff: { vacancies: 1, weekly: .5, tabloid: .4 }, base: .7, fontHead: F.arimo, fontBody: F.arimo, headScale: 1.8, border: "dashed", wide: .7 },
  { id: "poster-anton", kind: "poster", aff: { cinemafare: 1, mosaic: .6, weekly: .5 }, base: 1.5, fontDisplay: F.anton, fontHead: F.robcon, fontBody: F.arimo, headScale: 3.4, border: "double" },
  { id: "poster-playfair", kind: "poster", aff: { ledger: .7, weekly: .6, notices: .4 }, base: 1, fontDisplay: F.playfair, fontHead: F.caslon, fontBody: F.caslon, headScale: 3.2, border: "rule" },
  { id: "poster-bowlby", rare: true, kind: "poster", aff: { lovelines: .8, cinemafare: .6, backpages: .5 }, base: .8, fontDisplay: F.bowlby, fontHead: F.robcon, fontBody: F.arimo, headScale: 3, border: "heavy", shadow: true },
  { id: "personal-slab", kind: "personal", aff: { lovelines: 1 }, base: 2, fontHead: F.alfa, fontBody: F.caslon, headScale: 1.5, border: "solid" },
  { id: "personal-condensed", kind: "personal", aff: { lovelines: 1, tabloid: .3 }, base: 1.2, fontHead: F.robcon, fontBody: F.robcon, headScale: 1.2, border: "rule", align: "left" },
  { id: "listing-cinema", kind: "listing", aff: { cinemafare: 1, wantads: .3 }, base: 2, fontHead: F.robcon, fontBody: F.robcon, headScale: 1.4, bodyScale: .92, border: "solid", align: "left" },
  { id: "listing-agency", kind: "agency", aff: { wantads: 1 }, base: 1.5, fontDisplay: F.pathway, fontBody: F.sserif, headScale: 2.2, border: "rule", align: "left" },
  { id: "profile-photo", kind: "profile", aff: { photosheet: 1, weekly: .6, tabloid: .5 }, base: 2, fontHead: F.arimo, fontBody: F.arimo, headScale: 1.1, border: "rule", align: "left" },
  { id: "profile-card", kind: "card", aff: { weekly: .8, photosheet: .7, mosaic: .4 }, base: 1, fontDisplay: F.caslonD, fontBody: F.arimo, headScale: 2, border: "outline" },
  { id: "house-spartan", kind: "house", aff: { wantads: .7, weekly: .8, tabloid: .8 }, base: 1, fontDisplay: F.spartan, fontBody: F.robcon, headScale: 2.6, fill: "fill", border: "none" },
  { id: "house-anton-black", rare: true, kind: "house", aff: { weekly: 1, tabloid: .7 }, base: .9, fontDisplay: F.anton, fontBody: F.arimo, headScale: 3.4, fill: "ink", align: "left" },
  { id: "article-playfair", kind: "article", aff: { weekly: 1, ledger: .6, tabloid: .6 }, base: 2, fontDisplay: F.playfair, fontHead: F.caslon, fontBody: F.sserif, headScale: 2.4, border: "rule", align: "left", wide: .5 },
  { id: "article-oswald", kind: "article", aff: { tabloid: 1, cinemafare: .6, dense: .5 }, base: 1.2, fontDisplay: F.oswald, fontHead: F.robcon, fontBody: F.arimo, headScale: 2.6, border: "rule", align: "left", wide: .5 },
  { id: "weather-box", kind: "weather", aff: { weekly: 1, tabloid: .8, ledger: .5 }, base: 1, fontHead: F.robcon, fontBody: F.arimo, headScale: 1.4, border: "outline", align: "left" },
];

/** Second set, from the annotation notes (data/annotations): one per device the specimens show. */
export const TEMPLATES_2: Template[] = [
  // cl-001 Hastings: centred boxed display, pale fills, network liner box, condensed heads
  { id: "centred-boxed-display", kind: "display", aff: { weekly: 1, tabloid: .5 }, base: 1.5, fontDisplay: F.robcon, fontBody: F.arimo, headScale: 2, border: "solid", cls: "cl-t-lines" },
  { id: "tint-display-green", kind: "display", aff: { weekly: .8, bazaar: .4 }, base: .6, fontDisplay: F.alfa, fontBody: F.arimo, headScale: 2.2, border: "rule", fill: "tint", cls: "cl-t-green", rare: true },
  { id: "network-liner-box", kind: "boxed", aff: { weekly: 1, wantads: .4 }, base: .8, fontHead: F.arimo, fontBody: F.arimo, headScale: 1.2, border: "heavy", align: "left", wide: .6 },
  // cl-002 Gatesville: serif liner with insertion number, NOW HIRING tab display, legal column
  { id: "serif-liner-code", kind: "liner", aff: { weekly: 1, ledger: .5 }, base: 2.5, fontBody: F.tinos, align: "justify", cls: "cl-t-code" },
  { id: "now-hiring-display", kind: "display", aff: { weekly: 1, vacancies: .6 }, base: 1, fontDisplay: F.oswald, fontBody: F.arimo, headScale: 2.6, border: "heavy", cls: "cl-t-hiring", wide: .4 },
  { id: "legal-column", kind: "notice", aff: { weekly: 1, tabloid: .5, ledger: .3 }, base: 1, fontHead: F.tinos, fontBody: F.tinos, headScale: 1.05, bodyScale: .88, border: "none", align: "justify", cls: "cl-t-legal" },
  // cl-003/004/005: clip-art display, reverse panel list, photo display
  { id: "clipart-display", kind: "display", aff: { weekly: 1, bazaar: .5, mosaic: .4 }, base: 1, fontDisplay: F.archivo, fontBody: F.arimo, headScale: 1.8, border: "solid", cls: "cl-t-cut" },
  { id: "reverse-panel-list", kind: "reverse", aff: { weekly: .9, tabloid: .5 }, base: .6, fontDisplay: F.caslon, fontBody: F.caslon, headScale: 2.2, fill: "ink", cls: "cl-t-list", rare: true },
  { id: "photo-display", kind: "display", aff: { weekly: 1, photosheet: .8 }, base: 1, fontDisplay: F.caslon, fontBody: F.arimo, headScale: 1.9, border: "solid", cls: "cl-t-photo" },
  // cl-008: big notice, serif notice
  { id: "serif-notice", kind: "notice", aff: { notices: 1, ledger: .4 }, base: .9, fontHead: F.alfa, fontBody: F.caslon, headScale: 1.9, border: "solid", fill: "white" },
  // cl-009 Love Lines: love liner, caps box
  { id: "love-liner", kind: "liner", aff: { lovelines: 1 }, base: 2, fontBody: F.robcon, bodyScale: .95, align: "left", cls: "cl-t-love" },
  { id: "caps-box", kind: "boxed", aff: { lovelines: 1, notices: .3 }, base: .9, fontHead: F.caslon, fontBody: F.caslon, headScale: 1.1, border: "solid", cls: "cl-t-caps" },
  // cl-010/012 tabloid: ruled liner with code, category list, dashed house ad, numbered liner, grey display, dotted display
  { id: "ruled-liner-code", kind: "liner", aff: { tabloid: 1, cinemafare: .4 }, base: 2.5, fontBody: F.robcon, align: "justify", cls: "cl-t-code cl-t-ruled" },
  { id: "category-list-box", kind: "boxed", aff: { tabloid: 1, weekly: .4 }, base: .5, fontHead: F.robcon, fontBody: F.robcon, headScale: 1.2, border: "solid", align: "left", cls: "cl-t-bullets", rare: true },
  { id: "dashed-house-ad", kind: "house", aff: { tabloid: 1, weekly: .5 }, base: .7, fontDisplay: F.archivo, fontBody: F.arimo, headScale: 3, border: "dashed", rare: true },
  { id: "numbered-liner", kind: "liner", aff: { tabloid: 1, wantads: .4 }, base: 2, fontBody: F.robcon, align: "left", cls: "cl-t-numbered" },
  { id: "grey-display", kind: "display", aff: { tabloid: 1, weekly: .6 }, base: 1, fontDisplay: F.robcon, fontBody: F.robcon, headScale: 2, fill: "fill", border: "none", cls: "cl-t-asterisks cl-t-grey" },
  { id: "dotted-display", kind: "display", aff: { tabloid: .9, weekly: .5, wantads: .3 }, base: .8, fontDisplay: F.robcon, fontBody: F.robcon, headScale: 2.2, border: "none", cls: "cl-t-dots" },
  // cl-011 Old Autos: photo liner, framed display with oval logo
  { id: "framed-display-oval", kind: "display", aff: { photosheet: 1, weekly: .5 }, base: .9, fontDisplay: F.caslon, fontBody: F.robcon, headScale: 1.6, border: "heavy", cls: "cl-t-oval", rare: true },
  // cl-013: boxed display with big phone, mortgage notices
  { id: "big-phone-display", kind: "display", aff: { weekly: 1, bazaar: .6, tabloid: .5 }, base: 1, fontDisplay: F.oswald, fontBody: F.arimo, headScale: 2.4, border: "solid", cls: "cl-t-phone" },
  // cl-014 Daily News: oval head, arrow banner, outlined slab, reverse tab with cut, rounded blue box
  { id: "oval-head-display", kind: "display", aff: { weekly: .8, mosaic: .6 }, base: .6, fontDisplay: F.alfa, fontBody: F.caslon, headScale: 2, border: "rule", cls: "cl-t-ovalhead", rare: true },
  { id: "arrow-banner-display", kind: "display", aff: { weekly: .7, mosaic: .7, bazaar: .5 }, base: .6, fontDisplay: F.arimo, fontBody: F.caslon, headScale: 1.6, fill: "fill", border: "none", cls: "cl-t-arrows", rare: true },
  { id: "outlined-slab-display", kind: "display", aff: { weekly: .7, mosaic: .6 }, base: .7, fontDisplay: F.alfa, fontBody: F.caslon, headScale: 2.2, border: "solid", edge: "second", cls: "cl-t-outline-head" },
  { id: "reverse-tab-cut", kind: "display", aff: { weekly: .8, mosaic: .5 }, base: .8, fontDisplay: F.caslon, fontBody: F.caslon, headScale: 1.9, border: "rule", cls: "cl-t-revtab" },
  { id: "rounded-blue-box", kind: "display", aff: { weekly: .7, mosaic: .7 }, base: .7, fontDisplay: F.archivo, fontBody: F.caslon, headScale: 1.9, border: "rounded", edge: "second", cls: "cl-t-second-sub" },
  // cl-015/021/029/031/033/036 bazaar: bilingual liner with phone glyph, tick liner, tiny fill display, wanted ►, plot grid, rotated code
  { id: "phone-glyph-liner", kind: "liner", aff: { bazaar: 1, dense: .6 }, base: 2.5, fontBody: F.tinos, bodyScale: .95, align: "justify", cls: "cl-t-phoneglyph" },
  { id: "tick-liner", kind: "liner-tint", aff: { bazaar: 1 }, base: 1, fontBody: F.tinos, fill: "tint", cls: "cl-t-tick" },
  { id: "tiny-fill-display", kind: "display", aff: { bazaar: 1, dense: .4 }, base: 1.2, fontDisplay: F.oswald, fontBody: F.arimo, headScale: 1.8, bodyScale: .92, border: "solid", fill: "fill", cls: "cl-t-revphone" },
  { id: "wanted-display", kind: "display", aff: { bazaar: 1, dense: .5 }, base: .8, fontDisplay: F.archivo, fontBody: F.arimo, headScale: 2.4, border: "heavy", cls: "cl-t-triangles" },
  { id: "plot-grid", kind: "listing", aff: { bazaar: .8, dense: .5 }, base: .4, fontHead: F.archivo, fontBody: F.arimo, headScale: 1.4, border: "solid", cls: "cl-t-cells", rare: true },
  { id: "yellow-listing-rotated", kind: "display", aff: { bazaar: 1 }, base: .6, fontDisplay: F.archivo, fontBody: F.arimo, headScale: 1.6, border: "rule", fill: "fill", cls: "cl-t-accent-head cl-t-rotcode", rare: true },
  // cl-016 vacancies: perk display, script accent
  { id: "perk-display", kind: "display", aff: { vacancies: 1, weekly: .4 }, base: 1, fontDisplay: F.oswald, fontBody: F.arimo, headScale: 3.4, border: "heavy", cls: "cl-t-perks", wide: .5 },
  { id: "script-accent-display", kind: "display", aff: { vacancies: 1, weekly: .5, mosaic: .3 }, base: .7, fontDisplay: F.oswald, fontHead: F.pinyon, fontBody: F.arimo, headScale: 3, border: "heavy", cls: "cl-t-script-kicker", rare: true },
  // cl-017/018 Hastings: forced-justified sans liner, logo display, address liner, directory display, collage house ad
  { id: "forced-justify-liner", kind: "liner", aff: { weekly: 1 }, base: 1.5, fontBody: F.arimo, align: "justify", cls: "cl-t-forced" },
  { id: "logo-display", kind: "display", aff: { weekly: 1, photosheet: .4 }, base: 1, fontDisplay: F.caslonD, fontBody: F.arimo, headScale: 2, border: "solid", cls: "cl-t-logo" },
  { id: "address-liner", kind: "liner", aff: { weekly: 1, tabloid: .4 }, base: 1.5, fontBody: F.arimo, align: "left", cls: "cl-t-address" },
  { id: "directory-display", kind: "display", aff: { weekly: .9, photosheet: .5 }, base: .8, fontDisplay: F.caslonD, fontBody: F.arimo, headScale: 1.9, border: "solid", cls: "cl-t-bullets" },
  { id: "collage-house-ad", kind: "house", aff: { weekly: .8 }, base: .4, fontDisplay: F.archivo, fontBody: F.arimo, headScale: 3.2, border: "none", cls: "cl-t-collage", rare: true },
  // cl-020: centred-head liner, dashed star box, grey box
  { id: "centred-head-liner", kind: "boxed", aff: { weekly: .8, tabloid: .6, notices: .3 }, base: 1.5, fontHead: F.arimo, fontBody: F.arimo, headScale: 1.15, border: "none", cls: "cl-t-spaced" },
  { id: "dashed-star-box", kind: "display", aff: { weekly: .7, tabloid: .7, bazaar: .3 }, base: .7, fontDisplay: F.arimo, fontBody: F.arimo, headScale: 1.5, border: "dashed", cls: "cl-t-stars" },
  { id: "grey-box", kind: "boxed", aff: { tabloid: .8, weekly: .6 }, base: .8, fontHead: F.arimo, fontBody: F.arimo, headScale: 1.2, fill: "fill", border: "none", cls: "cl-t-grey" },
  // cl-022: job display, photo announcement
  { id: "job-display", kind: "display", aff: { weekly: .9, vacancies: .7 }, base: .8, fontDisplay: F.arimo, fontBody: F.arimo, headScale: 1.8, border: "solid", align: "left", cls: "cl-t-bullets cl-t-logo", wide: .6 },
  { id: "photo-announcement", kind: "profile", aff: { weekly: .8, photosheet: .8, notices: .4 }, base: 1, fontHead: F.caslon, fontBody: F.caslon, headScale: 1.2, border: "rule", align: "center", cls: "cl-t-portrait" },
  // cl-023: red banner
  { id: "red-banner", kind: "reverse", aff: { mosaic: 1, bazaar: .5 }, base: .6, fontDisplay: F.anton, fontBody: F.tinos, headScale: 2.6, fill: "accent", cls: "cl-t-italic-body", wide: .8, rare: true },
  // cl-024 Ledger: caps-lead liner ending in a company and Dept
  { id: "dept-liner", kind: "liner", aff: { ledger: 1 }, base: 2.5, fontBody: F.oldstd, bodyScale: 1.05, align: "justify", cls: "cl-t-dept" },
  // cl-026/027: local business-card stack, condensed display with reverse key lines, script company
  { id: "business-card-stack", kind: "card", aff: { weekly: 1, photosheet: .5 }, base: 1, fontDisplay: F.robcon, fontBody: F.arimo, headScale: 1.9, border: "solid", cls: "cl-t-revhead-phone" },
  { id: "condensed-keylines", kind: "display", aff: { dense: 1, bazaar: .6 }, base: 1, fontDisplay: F.anton, fontHead: F.pinyon, fontBody: F.tinos, headScale: 2.4, border: "heavy", cls: "cl-t-keylines" },
  { id: "tinted-reverse-italic", kind: "reverse", aff: { dense: .9, bazaar: .5 }, base: .6, fontDisplay: F.oswald, fontBody: F.tinos, headScale: 2.2, fill: "second", cls: "cl-t-italic-body", rare: true },
  // cl-028/032 cinemafare: showtime agate, theatre grid, film display
  { id: "showtime-agate", kind: "listing", aff: { cinemafare: 1 }, base: 2, fontHead: F.robcon, fontBody: F.robcon, headScale: 1.2, bodyScale: .9, border: "rule", align: "left", cls: "cl-t-runin" },
  { id: "theatre-grid", kind: "listing", aff: { cinemafare: 1 }, base: .9, fontHead: F.robcon, fontBody: F.robcon, headScale: 1.3, border: "solid", align: "center", cls: "cl-t-cells" },
  { id: "film-display", kind: "reverse", aff: { cinemafare: 1 }, base: .9, fontDisplay: F.anton, fontBody: F.robcon, headScale: 3.2, fill: "ink", cls: "cl-t-matinee" },
  // cl-030 comic: typewriter double box
  { id: "typewriter-double-box", kind: "display", aff: { backpages: 1 }, base: .9, fontDisplay: F.alfa, fontBody: F.courier, headScale: 1.9, border: "outline", fill: "fill", cls: "cl-t-caps-body" },
  // cl-035 Observer: town liner, fill box cyan, stock photo box
  { id: "town-liner", kind: "liner", aff: { weekly: 1 }, base: 2, fontBody: F.arimo, align: "justify", cls: "cl-t-code cl-t-greyrule" },
  { id: "fill-box-cyan", kind: "boxed", aff: { weekly: .8 }, base: .5, fontHead: F.arimo, fontBody: F.arimo, headScale: 1.2, fill: "second", border: "none", rare: true },
  { id: "stock-photo-box", kind: "display", aff: { weekly: .7, photosheet: .5 }, base: .4, fontDisplay: F.playfair, fontBody: F.arimo, headScale: 3.6, border: "solid", cls: "cl-t-stockphoto", rare: true },
  // cl-037 Pioneer: medallion stack, timetable
  { id: "medallion-stack", kind: "stack", aff: { woodtype: 1 }, base: .8, fontDisplay: F.ultra, fontHead: F.oldstd, fontBody: F.oldstd, headScale: 2.6, border: "rule", cls: "cl-t-medallion", rare: true },
  { id: "timetable", kind: "listing", aff: { woodtype: 1, ledger: .3 }, base: .8, fontHead: F.oldstd, fontBody: F.oldstd, headScale: 1.3, border: "rule", align: "left", cls: "cl-t-leaders" },
  // cl-038 Tribune: matrimonial liner, attention box, disclaimer
  { id: "matri-liner", kind: "liner", aff: { dense: 1 }, base: 2.5, fontBody: F.tinos, bodyScale: .9, align: "justify", cls: "cl-t-code" },
  { id: "attn-readers-box", kind: "notice", aff: { dense: 1, ledger: .6, wantads: .4 }, base: .5, fontHead: F.oswald, fontBody: F.arimo, headScale: 1.4, border: "outline", fill: "white", cls: "cl-t-attn", rare: true },
  // cl-039 want ads: wide display with slab sub-line
  { id: "wide-display-slab", kind: "display", aff: { wantads: 1 }, base: .9, fontDisplay: F.pathway, fontHead: F.alfa, fontBody: F.sserif, headScale: 4, border: "solid", cls: "cl-t-slab-sub", wide: .8 },
  // generic variety: plain faces in sizes the specimens show
  { id: "liner-caslon", kind: "liner", aff: { ledger: .6, weekly: .5, notices: .5 }, base: 1.5, fontBody: F.caslon, align: "justify" },
  { id: "liner-playfair-lead", kind: "liner", aff: { weekly: .6, ledger: .5 }, base: 1, fontBody: F.sserif, fontHead: F.playfair, align: "justify", cls: "cl-t-playfair-lead" },
  { id: "boxed-condensed", kind: "boxed", aff: { tabloid: 1, cinemafare: .6 }, base: 1.5, fontHead: F.oswald, fontBody: F.robcon, headScale: 1.4, border: "solid" },
  { id: "boxed-heavy-sans", kind: "boxed", aff: { weekly: .8, notices: .6, bazaar: .5 }, base: 1.2, fontHead: F.archivo, fontBody: F.arimo, headScale: 1.25, border: "heavy" },
  { id: "display-oswald", kind: "display", aff: { tabloid: 1, cinemafare: .7, dense: .5 }, base: 1.5, fontDisplay: F.oswald, fontBody: F.arimo, headScale: 2.8, border: "solid" },
  { id: "display-spartan", kind: "display", aff: { wantads: 1, weekly: .5 }, base: 1.2, fontDisplay: F.spartan, fontBody: F.sserif, headScale: 2.6, border: "solid" },
  { id: "display-caslon-display", kind: "display", aff: { ledger: 1, notices: .4 }, base: 1.2, fontDisplay: F.caslonD, fontBody: F.caslon, headScale: 3, border: "rule" },
  { id: "display-archivo-reverse", kind: "reverse", aff: { bazaar: .8, mosaic: .8, tabloid: .5 }, base: .8, fontDisplay: F.archivo, fontBody: F.arimo, headScale: 2.4, fill: "ink" },
  { id: "notice-condensed", kind: "notice", aff: { notices: .9, tabloid: .6 }, base: 1, fontHead: F.oswald, fontBody: F.robcon, headScale: 2.2, border: "solid", fill: "white" },
  { id: "personal-playfair", kind: "personal", aff: { lovelines: .8, ledger: .4 }, base: .8, fontHead: F.playfair, fontBody: F.caslon, headScale: 1.6, border: "double" },
  { id: "offer-slab", kind: "offer", aff: { backpages: .9, wantads: .3 }, base: 1, fontHead: F.alfa, fontBody: F.courier, fontDisplay: F.archivo, headScale: 1.5, border: "solid" },
  { id: "poster-pathway", kind: "poster", aff: { wantads: .7, cinemafare: .6, woodtype: .4 }, base: .9, fontDisplay: F.pathway, fontHead: F.robcon, fontBody: F.sserif, headScale: 4, border: "solid" },
  { id: "profile-spartan", kind: "profile", aff: { wantads: .8, photosheet: .6 }, base: 1, fontHead: F.spartan, fontBody: F.sserif, headScale: 1.1, border: "rule", align: "left" },
  { id: "article-caslon", kind: "article", aff: { ledger: 1, notices: .5 }, base: 1, fontDisplay: F.caslonD, fontHead: F.caslon, fontBody: F.oldstd, headScale: 2.6, border: "rule", align: "left", wide: .5 },
  { id: "weather-serif", kind: "weather", aff: { ledger: .9, woodtype: .5 }, base: .8, fontHead: F.oldstd, fontBody: F.oldstd, headScale: 1.3, border: "double", align: "left" },
];
export const ALL_TEMPLATES: Template[] = [...TEMPLATES, ...TEMPLATES_2];

export interface HeadTemplate {
  id: string;
  device: HeadDevice | "town" | "two-tier" | "icon-yellow" | "boxed-title" | "tab-colour";
  aff: Record<string, number>;
  base: number;
  font: string;
  scale: number;
  fill?: "none" | "ink" | "accent" | "second" | "fill";
}

export const HEADS: HeadTemplate[] = [
  { id: "italic-rule", device: "italic-rule", aff: { ledger: 1, woodtype: .3 }, base: 2, font: F.caslon, scale: 1.4 },
  { id: "numbered", device: "numbered", aff: { wantads: 1, weekly: .7, tabloid: .5 }, base: 2, font: F.spartan, scale: 1.35 },
  { id: "numbered-small", device: "numbered", aff: { weekly: 1, tabloid: .6 }, base: 1.5, font: F.robcon, scale: 1.15 },
  { id: "two-tier", device: "two-tier", aff: { weekly: 1, wantads: .8, tabloid: .6 }, base: 2, font: F.robcon, scale: 2, fill: "ink" },
  { id: "reverse-bar", device: "reverse-bar", aff: { tabloid: 1, photosheet: 1, notices: .7, cinemafare: .7 }, base: 2, font: F.robcon, scale: 1.5, fill: "ink" },
  { id: "tab-red", device: "tab-colour", aff: { weekly: .9, mosaic: .6, bazaar: .5 }, base: 1.2, font: F.arimo, scale: 1.3, fill: "accent" },
  { id: "tab-blue", device: "tab-colour", aff: { weekly: .6, mosaic: .6 }, base: .8, font: F.arimo, scale: 1.3, fill: "second" },
  { id: "tint-bar", device: "tint-bar", aff: { dense: 1, bazaar: .5 }, base: 1.5, font: F.oswald, scale: 1.3, fill: "accent" },
  { id: "icon-yellow", device: "icon-yellow", aff: { bazaar: 1 }, base: 2, font: F.archivo, scale: 1.1, fill: "fill" },
  { id: "paired", device: "paired", aff: { mosaic: 1 }, base: 1.5, font: F.archivo, scale: 1.05 },
  { id: "smallcaps", device: "smallcaps", aff: { woodtype: 1, ledger: .4 }, base: 2, font: F.oldstd, scale: 1.2 },
  { id: "spaced-caps", device: "plain-caps", aff: { dense: 1, vacancies: .4 }, base: 1.5, font: F.oswald, scale: 1.1 },
  { id: "town", device: "town", aff: { weekly: 1, tabloid: .5 }, base: 1, font: F.arimo, scale: 1.25, fill: "ink" },
  { id: "boxed-title", device: "boxed-title", aff: { notices: .8, lovelines: .7, vacancies: .6 }, base: .9, font: F.anton, scale: 1.6 },
  { id: "rule-label", device: "rule-label", aff: { lovelines: 1, wantads: .4 }, base: 1, font: F.robcon, scale: 1.3 },
];

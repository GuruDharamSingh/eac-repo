/**
 * Sections: whole-page recipes, one per hand mock-up. A section is what a
 * thematic centre generates: one grid, one head device, one small box set,
 * one palette, one copy voice. Between centres the plane falls back to the
 * open catalog, so the contrast between "inside a newspaper" and the mixed
 * ground is the contrast between a section and the catalog.
 *
 * Twists are named variations that bend a section without leaving it:
 * a section plus one to three twists is a variant, and a zone picks its
 * twists by hash, so one section yields dozens of pages that are plainly
 * the same paper. The mock-up review page renders N variants of a section.
 *
 * Fonts and reusable graphics are listed per section for the record.
 */
import type { EntryType } from "./catalog";
import type { Dials } from "./dials";

export interface Section {
  id: string;
  label: string;
  /** Which mock-up and specimens it comes from. */
  source: string;
  /** Column pitch in px and gutter. */
  pitch: number;
  gap: number;
  /** Body size in px. */
  body: number;
  leading: number;
  /** Column rule width; 0 none. */
  rule: number;
  /** Head template ids with weights. */
  heads: Array<[string, number]>;
  headChance: number;
  /** Template ids with weights: the box set. */
  boxes: Array<[string, number]>;
  palette: string;
  /** Entry-type weights for the copy voice. */
  entries: Partial<Record<EntryType, number>>;
  /** Run length range under a head. */
  run: [number, number];
  /** Chance of a section banner per zone, and its words. */
  banner?: { chance: number; title: string; kicker?: string; template: string };
  /** Insertion codes / fillers in this paper's house style. */
  fillers: string[];
  /** For the record. */
  fonts: string[];
  graphics: string[];
  /** The dials this section implies (for the field's blend outside centres). */
  dials: Partial<Dials>;
}

export const SECTIONS: Section[] = [
  {
    id: "wantads", label: "Want Ads", source: "BrokenColumns 1; cl-039, cl-017/018",
    pitch: 150, gap: 12, body: 11, leading: 1.22, rule: 1,
    heads: [["numbered", 3], ["two-tier", 2]], headChance: 0.75,
    boxes: [["agate-caps", 10], ["liner-tint-pink", 1.5], ["boxed-spartan", 2], ["display-pathway", 1.5], ["listing-agency", 0.8], ["wide-display-slab", 0.5], ["house-spartan", 0.3]],
    palette: "mono", entries: { classified: 10, listing: 1 }, run: [3, 6],
    banner: { chance: 0.25, title: "Want Ads", kicker: "Run day · deadline", template: "display-spartan" },
    fillers: ["Box C-{n}", "Box B-{n} c-o State-Record", "AL 2-{n}"],
    fonts: ["League Spartan 900", "Source Serif 4", "Pathway Gothic One", "Roboto Condensed"], graphics: ["run-day/deadline dot-leader table", "two-tier black tab"],
    dials: { density: 9, colour: 1, fontMix: 2, borders: 3, headers: 8, scale: 4 },
  },
  {
    id: "bazaar", label: "Bazaar", source: "BrokenColumns 2; cl-015, cl-021, cl-029, cl-033, cl-036",
    pitch: 118, gap: 7, body: 10.5, leading: 1.18, rule: 0.5,
    heads: [["icon-yellow", 4], ["tint-bar", 1]], headChance: 0.8,
    boxes: [["agate-bold", 8], ["phone-glyph-liner", 4], ["liner-tint-pink", 3], ["tick-liner", 1.5], ["display-yellow-phone", 2], ["tiny-fill-display", 2], ["wanted-display", 1], ["yellow-listing-rotated", 0.5]],
    palette: "bazaar", entries: { classified: 10, profile: 1 }, run: [3, 7],
    banner: { chance: 0.3, title: "BAZAAR CLASSIFIEDS", kicker: "Yoga · Studios · Frames · Pianos · Prints · Lessons · Vans", template: "display-reverse-red" },
    fillers: ["(CL2101{n})", "✆ [PHONE]"],
    fonts: ["Archivo Black", "Tinos", "Arimo", "Anton"], graphics: ["orange banner with category roll", "yellow icon labels", "✆ glyph", "red tick"],
    dials: { density: 9, colour: 8, fontMix: 3, borders: 5, headers: 9, scale: 3 },
  },
  {
    id: "notices", label: "Notices & Love Lines", source: "BrokenColumns 3; cl-008, cl-009",
    pitch: 290, gap: 14, body: 11.5, leading: 1.36, rule: 0,
    heads: [["boxed-title", 2], ["tint-bar", 1]], headChance: 0.3,
    boxes: [["notice-anton", 8], ["notice-reversed-head", 1.5], ["notice-slab", 2], ["notice-memoriam", 1.5], ["serif-notice", 1.5], ["personal-slab", 2], ["love-liner", 2], ["display-reverse-anton", 0.6]],
    palette: "herald", entries: { notice: 10, seasonal: 3 }, run: [2, 4],
    banner: { chance: 0.3, title: "NOTICES", kicker: "Marriages · Births · In memoriam · Thanks · Cancellations", template: "display-anton" },
    fillers: ["Secretary: [NAME]", "[ORG], [ADDRESS] · [PHONE]"],
    fonts: ["Anton", "Arimo", "Alfa Slab One", "Libre Caslon Text", "Bowlby One"], graphics: ["vermilion bar", "textured VALENTINE ribbon", "phone tags"],
    dials: { density: 4, colour: 2, fontMix: 3, borders: 9, headers: 3, scale: 6 },
  },
  {
    id: "pioneer", label: "Pioneer", source: "BrokenColumns 4 left; cl-037",
    pitch: 230, gap: 10, body: 11, leading: 1.3, rule: 1,
    heads: [["smallcaps", 5]], headChance: 0.6,
    boxes: [["stack-howe", 6], ["stack-rye", 4], ["medallion-stack", 1], ["timetable", 1.5], ["display-woodtype-reverse", 0.8], ["display-ultra", 2], ["liner-oldstyle", 2]],
    palette: "mono", entries: { classified: 6, listing: 2, poster: 2 }, run: [2, 4],
    fillers: ["dec10 3m", "m18 1m", "ap15 ly", "jan20tf"],
    fonts: ["Ultra", "Rye", "Old Standard TT"], graphics: ["engraved cuts (stand-ins)", "dot leaders", "medallion"],
    dials: { density: 6, colour: 0, fontMix: 8, borders: 2, headers: 5, scale: 6 },
  },
  {
    id: "backpages", label: "Back Pages", source: "BrokenColumns 4 right; cl-030",
    pitch: 190, gap: 10, body: 10.5, leading: 1.3, rule: 0,
    heads: [["reverse-bar", 3]], headChance: 0.3,
    boxes: [["offer-comic", 10], ["offer-slab", 3], ["display-reverse-comic", 1.5], ["coupon-comic", 1.5], ["typewriter-double-box", 1.5], ["stack-rye", 0.8]],
    palette: "comic", entries: { mailorder: 10, classified: 1 }, run: [3, 6],
    banner: { chance: 0.3, title: "AMAZING OFFERS!", kicker: "All offers by mail or ArtDirect", template: "display-rye" },
    fillers: ["Dept. {l}-{n}", "Allow 4 to 6 weeks"],
    fonts: ["Rye", "Archivo Black", "Courier Prime", "Alfa Slab One", "Oswald"], graphics: ["scissors", "dotted fill-in lines", "red offset shadow", "line-art cuts"],
    dials: { density: 5, colour: 6, fontMix: 7, borders: 9, headers: 4, scale: 7 },
  },
  {
    id: "collaborators", label: "Collaborators' Wall", source: "BoxStudies 1; cl-038",
    pitch: 112, gap: 7, body: 10, leading: 1.2, rule: 0.5,
    heads: [["spaced-caps", 5]], headChance: 0.9,
    boxes: [["matri-liner", 14], ["agate-bold", 4], ["attn-readers-box", 0.4], ["display-oswald", 0.8], ["display-reverse-anton", 0.3]],
    palette: "herald", entries: { classified: 10, profile: 2 }, run: [4, 8],
    banner: { chance: 0.2, title: "CLASSIFIEDS", kicker: "Partners wanted", template: "display-oswald" },
    fillers: ["(CL2101{n})"],
    fonts: ["Oswald", "Tinos", "Arimo", "Playfair Display"], graphics: ["double-ruled ATTN box", "blue booking band", "disclaimer box"],
    dials: { density: 10, colour: 2, fontMix: 1, borders: 1, headers: 9, scale: 1 },
  },
  {
    id: "observer", label: "Observer Board", source: "BoxStudies 2; cl-035, cl-010/012, cl-011",
    pitch: 150, gap: 8, body: 10.5, leading: 1.32, rule: 0,
    heads: [["tab-red", 3], ["tab-blue", 1], ["town", 3]], headChance: 0.7,
    boxes: [["boxed-caslon", 6], ["town-liner", 5], ["boxed-yellow", 2], ["fill-box-cyan", 0.6], ["boxed-gradient", 1], ["photo-display", 2], ["stock-photo-box", 0.4], ["boxed-typewriter", 1], ["house-anton-black", 0.4]],
    palette: "observer", entries: { classified: 10, profile: 2, notice: 1 }, run: [2, 5],
    banner: { chance: 0.25, title: "Observer Classifieds", kicker: "The Observer is not responsible for typographical errors", template: "display-playfair" },
    fillers: ["31W03", "33W04", "32W03", "29W06"],
    fonts: ["Playfair Display 900", "Arimo", "Libre Caslon Text", "Pinyon Script"], graphics: ["red/black tab row", "sky-blue sidebar", "JOBS photo", "notary band"],
    dials: { density: 5, colour: 7, fontMix: 5, borders: 9, headers: 8, scale: 6 },
  },
  {
    id: "gatesville", label: "Gatesville", source: "BoxStudies 3; cl-002, cl-016, cl-023",
    pitch: 170, gap: 12, body: 10.5, leading: 1.3, rule: 0,
    heads: [["numbered-small", 5]], headChance: 0.6,
    boxes: [["serif-liner-code", 5], ["display-blackletter", 1], ["now-hiring-display", 1.5], ["display-righteous", 1], ["display-dq", 1], ["boxed-typewriter", 1], ["boxed-oldstyle-double", 1], ["display-script-card", 1.2], ["legal-column", 2.5], ["house-anton-black", 0.5], ["boxed-rounded", 0.8]],
    palette: "weekly", entries: { classified: 8, notice: 4, profile: 1 }, run: [2, 4],
    banner: { chance: 0.2, title: "CLASSIFIEDS", template: "display-playfair" },
    fillers: ["000304{n}", "00030{n}"],
    fonts: ["Playfair Display", "Arimo", "UnifrakturMaguntia", "Oswald", "Righteous", "Pinyon Script", "Libre Caslon Text", "Alfa Slab One", "Courier Prime", "Old Standard TT", "Anton", "Tinos"], graphics: ["equal-opportunity mark", "'Your ad should be here' rounded box"],
    dials: { density: 6, colour: 2, fontMix: 10, borders: 7, headers: 6, scale: 5 },
  },
  {
    id: "photosheet", label: "Photo Sheet", source: "ThreeMore 1; cl-011, cl-004/005",
    pitch: 172, gap: 10, body: 10, leading: 1.28, rule: 0,
    heads: [["reverse-bar", 6]], headChance: 0.9,
    boxes: [["profile-photo", 12], ["photo-display", 1.5], ["framed-display-oval", 0.5]],
    palette: "mono", entries: { profile: 10, classified: 3 }, run: [4, 7],
    banner: { chance: 0.3, title: "CLASSIFIEDS", kicker: "Spaces 15 years or older only", template: "display-playfair" },
    fillers: ["9~11p", "11~13p", "10~12p", "~11p"],
    fonts: ["Playfair Display 900", "Archivo Black", "Arimo", "Oswald", "Pinyon Script"], graphics: ["halftone photo stand-ins", "oval script logo", "italic reversed headline"],
    dials: { density: 6, colour: 0, fontMix: 1, borders: 2, headers: 10, scale: 4 },
  },
  {
    id: "whatson", label: "What's On", source: "ThreeMore 2; cl-028, cl-032",
    pitch: 122, gap: 7, body: 9.6, leading: 1.25, rule: 0,
    heads: [["reverse-bar", 6]], headChance: 0.7,
    boxes: [["listing-cinema", 6], ["showtime-agate", 5], ["theatre-grid", 2], ["poster-anton", 3], ["film-display", 1.5], ["poster-bowlby", 0.6]],
    palette: "mono", entries: { listing: 10, poster: 5 }, run: [3, 5],
    banner: { chance: 0.3, title: "WHAT'S ON", kicker: "Cinemas · Galleries · Stages · Readings", template: "poster-bowlby" },
    fillers: ["all seats {n}¢", "BARGAIN MATINEE"],
    fonts: ["Bowlby One", "Roboto Condensed", "Oswald", "Anton"], graphics: ["screen-grid cells", "matinee tags", "poster halftones"],
    dials: { density: 8, colour: 1, fontMix: 4, borders: 6, headers: 8, scale: 5 },
  },
  {
    id: "vacancies", label: "Situations Vacant", source: "ThreeMore 3; cl-016",
    pitch: 420, gap: 14, body: 11, leading: 1.4, rule: 0,
    heads: [["boxed-title", 1]], headChance: 0.1,
    boxes: [["perk-display", 8], ["script-accent-display", 3], ["display-righteous", 1], ["coupon-arimo", 1.5], ["display-reverse-anton", 1.2], ["job-display", 2]],
    palette: "mono", entries: { classified: 10 }, run: [2, 4],
    banner: { chance: 0.35, title: "situations vacant", template: "display-righteous" },
    fillers: ["Dept. {l}", "apply in writing"],
    fonts: ["Righteous", "Oswald", "Pinyon Script", "Arimo"], graphics: ["● and ★ perk lists", "dashed coupon", "rotated sign-off"],
    dials: { density: 2, colour: 1, fontMix: 5, borders: 9, headers: 2, scale: 10 },
  },
  {
    id: "ledger", label: "The Ledger", source: "Opus Main; cl-024",
    pitch: 300, gap: 26, body: 12.5, leading: 1.32, rule: 1,
    heads: [["italic-rule", 6]], headChance: 0.8,
    boxes: [["dept-liner", 12], ["liner-oldstyle", 4], ["display-rye", 1], ["attn-readers-box", 0.5], ["display-caslon-display", 0.8]],
    palette: "mono", entries: { classified: 10, mailorder: 2 }, run: [3, 5],
    banner: { chance: 0.3, title: "CLASSIFIED ADVERTISING", kicker: "Advertising section", template: "display-caslon-display" },
    fillers: ["Box A-{n}.", "Dept. {l}, the Ledger."],
    fonts: ["Libre Caslon Display", "Libre Caslon Text", "Old Standard TT", "Oswald", "Rye"], graphics: ["double rule under title", "vermilion numbered tab"],
    dials: { density: 7, colour: 0, fontMix: 1, borders: 2, headers: 7, scale: 2 },
  },
];
export const SECTION_BY_ID: Record<string, Section> = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

/** A twist bends a section. Applied in order; a variant is a section plus 1–3 twists. */
export interface Twist {
  id: string;
  label: string;
  apply: (s: Section) => Section;
}
const scaleBoxes = (s: Section, f: (id: string, w: number) => number): Section => ({ ...s, boxes: s.boxes.map(([id, w]) => [id, f(id, w)] as [string, number]) });
const addBoxes = (s: Section, extra: Array<[string, number]>): Section => ({ ...s, boxes: [...s.boxes, ...extra] });

export const TWISTS: Twist[] = [
  { id: "reversed-heads", label: "Reversed heads", apply: (s) => ({ ...s, heads: [["reverse-bar", 5]], headChance: Math.max(s.headChance, 0.7) }) },
  { id: "two-tier-heads", label: "Two-tier tabs", apply: (s) => ({ ...s, heads: [["two-tier", 5]] }) },
  { id: "colour-tabs", label: "Colour tabs", apply: (s) => ({ ...s, heads: [["tab-red", 3], ["tab-blue", 2]], palette: s.palette === "mono" ? "observer" : s.palette }) },
  { id: "pink-premium", label: "Pink premium liners", apply: (s) => addBoxes({ ...s, palette: s.palette === "mono" ? "herald" : s.palette }, [["liner-tint-pink", 3]]) },
  { id: "yellow-boxes", label: "Yellow boxes", apply: (s) => addBoxes({ ...s, palette: s.palette === "mono" ? "observer" : s.palette }, [["boxed-yellow", 2], ["display-yellow-phone", 0.8]]) },
  { id: "coupon", label: "A coupon", apply: (s) => addBoxes(s, [["coupon-comic", 0.6], ["coupon-arimo", 0.6]]) },
  { id: "wide-poster", label: "A wide poster", apply: (s) => addBoxes(s, [["poster-anton", 0.8], ["poster-playfair", 0.5]]) },
  { id: "double-rules", label: "Double rules", apply: (s) => ({ ...s, rule: 2 }) },
  { id: "no-rules", label: "No rules", apply: (s) => ({ ...s, rule: 0 }) },
  { id: "bigger-body", label: "Bigger body", apply: (s) => ({ ...s, body: s.body * 1.2, pitch: s.pitch * 1.15 }) },
  { id: "smaller-body", label: "Smaller body", apply: (s) => ({ ...s, body: Math.max(9, s.body * 0.88), pitch: s.pitch * 0.9 }) },
  { id: "narrow", label: "Narrower columns", apply: (s) => ({ ...s, pitch: s.pitch * 0.8, gap: s.gap * 0.8 }) },
  { id: "wide", label: "Wider columns", apply: (s) => ({ ...s, pitch: s.pitch * 1.35 }) },
  { id: "no-heads", label: "No heads", apply: (s) => ({ ...s, headChance: 0.05 }) },
  { id: "many-heads", label: "A head over every run", apply: (s) => ({ ...s, headChance: 1, run: [2, 3] }) },
  { id: "long-runs", label: "Long runs", apply: (s) => ({ ...s, run: [6, 12] }) },
  { id: "blackletter", label: "A blackletter box", apply: (s) => addBoxes(s, [["display-blackletter", 0.5]]) },
  { id: "script", label: "Script accents", apply: (s) => addBoxes(s, [["display-script-card", 0.8], ["script-accent-display", 0.5]]) },
  { id: "woodtype", label: "Woodtype intrusions", apply: (s) => addBoxes(s, [["stack-howe", 0.6], ["display-ultra", 0.4]]) },
  { id: "notices-in", label: "Notices among the ads", apply: (s) => addBoxes({ ...s, entries: { ...s.entries, notice: (s.entries.notice ?? 0) + 3 } }, [["notice-anton", 1]]) },
  { id: "editorial", label: "An article and the weather", apply: (s) => addBoxes({ ...s, entries: { ...s.entries, editorial: 3 } }, [["article-playfair", 1], ["weather-box", 0.5]]) },
  { id: "profiles", label: "Artists on file", apply: (s) => addBoxes({ ...s, entries: { ...s.entries, profile: (s.entries.profile ?? 0) + 4 } }, [["profile-photo", 2], ["profile-card", 1]]) },
  { id: "second-palette", label: "Second palette", apply: (s) => ({ ...s, palette: { mono: "weekly", observer: "mosaic", bazaar: "mosaic", mosaic: "bazaar", comic: "bazaar", herald: "bazaar", weekly: "observer", green: "mosaic" }[s.palette] ?? "mono" }) },
  { id: "mono", label: "Black and white", apply: (s) => ({ ...s, palette: "mono" }) },
  { id: "liners-only", label: "Liners only", apply: (s) => scaleBoxes(s, (id, w) => (/liner/.test(id) ? w * 3 : w * 0.2)) },
  { id: "displays-up", label: "More displays", apply: (s) => scaleBoxes(s, (id, w) => (/display|poster|notice|stack|offer/.test(id) ? w * 2.5 : w)) },
  { id: "house-ads", label: "House ads", apply: (s) => addBoxes(s, [["house-spartan", 0.8], ["house-anton-black", 0.5], ["display-rainbow", 0.3]]) },
  { id: "banner", label: "Banner", apply: (s) => ({ ...s, banner: s.banner ? { ...s.banner, chance: 1 } : { chance: 1, title: s.label.toUpperCase(), template: "display-anton" } }) },
  { id: "no-banner", label: "No banner", apply: (s) => ({ ...s, banner: undefined }) },
  { id: "grey-panels", label: "Grey panels", apply: (s) => addBoxes(s, [["grey-display", 1], ["grey-box", 1]]) },
];
export const TWIST_BY_ID: Record<string, Twist> = Object.fromEntries(TWISTS.map((t) => [t.id, t]));

/** Deterministic twist set for a seed in [0,1): 1–3 twists. */
export function twistsFor(u: number, max = 3): Twist[] {
  const n = 1 + Math.floor(u * 1000) % max;
  const out: Twist[] = [];
  let x = u;
  for (let k = 0; k < n; k++) {
    x = (x * 9301 + 0.49297) % 1;
    const t = TWISTS[Math.floor(x * TWISTS.length)];
    if (!out.includes(t)) out.push(t);
  }
  return out;
}
export function variant(base: Section, twists: Twist[]): Section {
  return twists.reduce((s, t) => t.apply(s), base);
}

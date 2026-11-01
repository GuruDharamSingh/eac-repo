/**
 * The style catalog as the generator uses it: one "recipe" per section look.
 *
 * A recipe is a family from ../../classifieds/families.ts (its CSS tokens)
 * plus the composition facts that make a page of it: how many columns, which
 * ad units it is built from and how often, which header device labels a
 * classification, and what the masthead says. The CSS for every unit lives in
 * app/classifieds/microfiche.css under `.cl-u-*`, with per-recipe overrides
 * under `.cl-r-<recipe>`.
 *
 * Recipes are keyframe norms, not bins (HANDOFF.md; developer, 2026-10-24).
 * style.ts blends them over the plane: in coherent regions one keyframe shows
 * through on every axis; elsewhere grid, type, colour, header device and unit
 * mix drift between keyframes independently. To add a look, add a family in
 * families.ts and a recipe here; nothing else needs to change.
 */
import { FAMILIES } from "../../classifieds/families";
import type { StyleFamily } from "../../classifieds/schema";
import type { Dials } from "./dials";

/** What an entry is, independent of how it is set. The ratio dials count these. */
export type EntryType = "classified" | "notice" | "seasonal" | "listing" | "poster" | "mailorder" | "profile" | "editorial";

/** The building blocks a sheet is tiled from. Each has a `.cl-u-<kind>` rule. */
export type UnitKind =
  | "head" // a classification label (rule-label, reverse bar, tab, icon label…)
  | "liner" // running text ad, caps or bold lead
  | "liner-tint" // premium liner on a tint
  | "boxed" // centred liner in a box
  | "display" // boxed display ad, big headline
  | "reverse" // display reversed out of ink
  | "notice" // boxed public notice with a name block
  | "stack" // woodtype stack: each line a different face
  | "coupon" // scissor-dashed coupon with fill-in lines
  | "offer" // tiny mail-order box with a price
  | "agency" // quantity—job—rate list
  | "listing" // times table (cinema, venue)
  | "poster" // a show card
  | "personal" // seasonal message, boxed and centred
  | "card" // business card display
  | "profile" // an artist's file (ArtDirect dossier)
  | "house" // the paper's own ad
  | "article" // a short news item: headline, deck, body
  | "weather"; // the weather table

export type HeadDevice = "rule-label" | "reverse-bar" | "tab" | "numbered" | "tint-bar" | "icon-label" | "smallcaps" | "italic-rule" | "paired" | "plain-caps";

export interface Recipe {
  id: string;
  family: StyleFamily;
  /** Shown in the catalog and focus views. */
  label: string;
  era: string;
  /** Column count of the sheet body. */
  columns: number;
  /** Column gap in px at zoom 1. */
  gap: number;
  /** Sheet padding in px. */
  pad: number;
  head: HeadDevice;
  /** Unit kinds and their relative weights when filling a column. */
  units: ReadonlyArray<readonly [UnitKind, number]>;
  /** Entry-type bias on top of the global dials. */
  bias?: Partial<Record<EntryType, number>>;
  /** Masthead copy; `null` means the recipe never carries a masthead. */
  masthead: { title: string; kicker?: string; rule?: string } | null;
  /** Running head on sheets without a masthead. */
  running: string;
  /** Devices borrowed from the specimens, for the catalog overlay. */
  devices: string[];
  /** Specimen ids the recipe rests on. */
  specimens: string[];
  /** The keyframe's own setting of the ten dials (dials.ts). */
  dials: Dials;
}

const d = (density: number, breaks: number, heterogeneity: number, colour: number, fontMix: number, borders: number, headers: number, scale: number, structures: number, editorial: number): Dials => ({
  density, breaks, heterogeneity, colour, fontMix, borders, headers, scale, structures, editorial,
});

/** Dial presets by recipe id, read into RECIPES below. */
const PRESETS: Record<string, Dials> = {
  //            dens brk het col fnt bor hed scl str edi
  ledger:     d(7,   2,  2,  0,  1,  2,  7,  2,  3,  3),
  wantads:    d(9,   4,  3,  1,  2,  3,  8,  4,  2,  1),
  weekly:     d(5,   5,  5,  3,  4,  8,  9,  6,  5,  4),
  notices:    d(4,   2,  2,  1,  2,  9,  3,  6,  2,  2),
  mosaic:     d(3,   6,  9,  9,  9,  9,  5,  8,  5,  2),
  backpages:  d(5,   7,  7,  6,  7,  9,  4,  7,  7,  1),
  woodtype:   d(6,   8,  6,  0,  8,  2,  5,  6,  4,  5),
  dense:      d(10,  1,  1,  2,  1,  1,  6,  1,  1,  0),
  bazaar:     d(9,   3,  4,  8,  3,  5,  9,  3,  3,  1),
  lovelines:  d(6,   3,  4,  1,  4,  6,  2,  3,  8,  0),
  vacancies:  d(2,   3,  3,  1,  5,  8,  4,  9,  3,  0),
  cinemafare: d(8,   6,  5,  1,  6,  6,  5,  5,  4,  6),
  tabloid:    d(7,   3,  2,  2,  2,  4,  8,  4,  3,  3),
  photosheet: d(6,   2,  2,  0,  1,  7,  8,  5,  2,  2),
};

const fam = (id: string): StyleFamily => {
  const f = FAMILIES.find((x) => x.id === id);
  if (!f) throw new Error(`classifieds: unknown family ${id}`);
  return f;
};

const RAW: Omit<Recipe, "dials">[] = [
  {
    id: "ledger",
    family: fam("pulp-magazine-classified"),
    label: "The Ledger",
    era: "1920s magazine back pages",
    columns: 3,
    gap: 26,
    pad: 48,
    head: "italic-rule",
    units: [
      ["liner", 14],
      ["display", 1.2],
      ["boxed", 1],
      ["house", 0.4],
    ],
    bias: { classified: 2, mailorder: 0.6 },
    masthead: { title: "CLASSIFIED ADVERTISING", kicker: "Advertising Section", rule: "double" },
    running: "CLASSIFIED ADVERTISING",
    devices: ["heavy old-style title over a double rule", "italic bold heads centred between rules", "caps opening words, Dept./Box codes", "hairline column rules"],
    specimens: ["cl-024"],
  },
  {
    id: "wantads",
    family: fam("us-midcentury-want-ads"),
    label: "Want Ads",
    era: "1960s daily",
    columns: 6,
    gap: 12,
    pad: 34,
    head: "numbered",
    units: [
      ["liner", 16],
      ["liner-tint", 2],
      ["display", 2],
      ["agency", 1.2],
      ["boxed", 1.5],
    ],
    bias: { classified: 2, listing: 0.8 },
    masthead: { title: "Want Ads", kicker: "Run day · deadline" },
    running: "WANT ADS",
    devices: ["numbered heads with the number flush right between rules", "justified agate with a caps first word and hanging indent", "light condensed display breaking the grid", "agency quantity—job—rate lists", "photocopy grain"],
    specimens: ["cl-039", "cl-017", "cl-018"],
  },
  {
    id: "weekly",
    family: fam("us-community-weekly"),
    label: "Community Weekly",
    era: "1990s–present small-town paper",
    columns: 6,
    gap: 14,
    pad: 32,
    head: "tab",
    units: [
      ["boxed", 8],
      ["liner", 6],
      ["card", 3],
      ["notice", 1.5],
      ["house", 0.8],
      ["profile", 1],
    ],
    bias: { notice: 1.5, profile: 1.5 },
    masthead: { title: "Classified Ads", kicker: "Place your ad any hour on ArtDirect" },
    running: "CLASSIFIEDS",
    devices: ["big Didone masthead word", "two-tier black tabs (kicker over word)", "boxed centred liners", "business-card displays", "legal notice column", "one bright deadline colour"],
    specimens: ["cl-001", "cl-017", "cl-018", "cl-010"],
  },
  {
    id: "notices",
    family: fam("boxed-notice-grid"),
    label: "Notices",
    era: "present-day notice grid",
    columns: 3,
    gap: 14,
    pad: 40,
    head: "reverse-bar",
    units: [
      ["notice", 10],
      ["reverse", 1.5],
      ["boxed", 1],
    ],
    bias: { notice: 4, classified: 0.3 },
    masthead: { title: "NOTICES", kicker: "Announcements · Cancellations · Thanks · In memoriam" },
    running: "NOTICES",
    devices: ["grid of near-identical boxed notices", "heavy condensed caps head, justified sans body", "bold centred name block", "double-height reversed head with phone tags"],
    specimens: ["cl-008"],
  },
  {
    id: "mosaic",
    family: fam("color-display-mosaic"),
    label: "Colour Mosaic",
    era: "2020s bilingual community paper",
    columns: 3,
    gap: 12,
    pad: 28,
    head: "paired",
    units: [
      ["display", 8],
      ["reverse", 2],
      ["poster", 1.5],
      ["profile", 1.5],
      ["house", 1],
    ],
    bias: { poster: 2, profile: 1.5 },
    masthead: { title: "CLASSIFIEDS / Clasificados" },
    running: "CLASIFICADOS",
    devices: ["every ad a full-colour box in its own font and border", "paired red/blue bilingual tabs", "tint fills", "rainbow house ad"],
    specimens: ["cl-023", "cl-014"],
  },
  {
    id: "backpages",
    family: fam("comic-mailorder"),
    label: "Back Pages",
    era: "1950s–60s comic-book mail order",
    columns: 4,
    gap: 12,
    pad: 34,
    head: "reverse-bar",
    units: [
      ["offer", 10],
      ["coupon", 1.2],
      ["reverse", 1.5],
      ["stack", 1],
    ],
    bias: { mailorder: 4, classified: 0.4 },
    masthead: { title: "AMAZING OFFERS!", kicker: "All offers by mail or ArtDirect" },
    running: "BACK OF THE BOOK",
    devices: ["circus woodtype masthead with a red offset shadow", "tiny boxed offers with hook headline, typewriter copy and price", "scissor-dashed coupon with dotted lines", "spot-colour paper"],
    specimens: ["cl-030"],
  },
  {
    id: "woodtype",
    family: fam("victorian-woodtype"),
    label: "Pioneer",
    era: "1870s broadsheet",
    columns: 4,
    gap: 10,
    pad: 36,
    head: "smallcaps",
    units: [
      ["stack", 10],
      ["listing", 2],
      ["reverse", 1],
      ["liner", 2],
    ],
    bias: { listing: 1.5, poster: 1.2 },
    masthead: null,
    running: "DAILY PIONEER · ADVERTISEMENTS",
    devices: ["centred stacks, each line a different face", "small-cap category labels with a full stop", "timetables with dot leaders", "insertion codes at the ad foot", "reverse-out block"],
    specimens: ["cl-037"],
  },
  {
    id: "dense",
    family: fam("indian-dense-liner"),
    label: "Agate Wall",
    era: "present-day broadsheet",
    columns: 8,
    gap: 9,
    pad: 24,
    head: "tint-bar",
    units: [
      ["liner", 20],
      ["display", 1.5],
      ["boxed", 1],
    ],
    bias: { classified: 3 },
    masthead: null,
    running: "CLASSIFIEDS · CLASS CONTD",
    devices: ["eight columns of tight justified liners with bold openings", "booking codes between ads", "a single spot-colour bar per sub-head", "tall condensed displays"],
    specimens: ["cl-027", "cl-038"],
  },
  {
    id: "bazaar",
    family: fam("indian-color-display"),
    label: "Bazaar",
    era: "present-day regional daily",
    columns: 8,
    gap: 9,
    pad: 24,
    head: "icon-label",
    units: [
      ["liner", 12],
      ["liner-tint", 5],
      ["display", 3],
      ["reverse", 1],
    ],
    bias: { classified: 2, poster: 0.8 },
    masthead: { title: "CLASSIFIEDS", kicker: "Yoga · Studios · Frames · Pianos · Prints · Lessons · Vans" },
    running: "CLASSIFIEDS",
    devices: ["loud banner on an orange field", "category labels over coloured bars with a clip-art cut", "tinted premium liners", "small yellow boxes with huge phone numbers"],
    specimens: ["cl-015", "cl-021", "cl-029", "cl-033", "cl-036"],
  },
  {
    id: "lovelines",
    family: fam("seasonal-personals"),
    label: "Love Lines",
    era: "once-a-year section",
    columns: 7,
    gap: 10,
    pad: 30,
    head: "rule-label",
    units: [
      ["personal", 10],
      ["liner", 6],
    ],
    bias: { seasonal: 5, classified: 0.2 },
    masthead: { title: "VALENTINE", kicker: "Love Lines · Love Lines · Love Lines" },
    running: "LOVE LINES",
    devices: ["illustrated banner with ribbon and textured letters", "short bold-lead notes", "boxed centred messages with slab names and italic sign-offs"],
    specimens: ["cl-009"],
  },
  {
    id: "vacancies",
    family: fam("recruitment-display"),
    label: "Situations Vacant",
    era: "1970s display page",
    columns: 2,
    gap: 18,
    pad: 36,
    head: "reverse-bar",
    units: [
      ["display", 6],
      ["coupon", 1],
      ["reverse", 1],
    ],
    bias: { classified: 1.5, profile: 0.8 },
    masthead: { title: "situations vacant" },
    running: "situations vacant",
    devices: ["chunky lowercase banner", "one-word condensed gothic headlines", "script accents", "bullet lists of perks", "dashed coupon"],
    specimens: ["cl-016"],
  },
  {
    id: "cinemafare",
    family: fam("modern-condensed-sans"),
    label: "Cinemafare",
    era: "1980s listings page",
    columns: 7,
    gap: 8,
    pad: 26,
    head: "reverse-bar",
    units: [
      ["listing", 8],
      ["poster", 4],
      ["display", 2],
    ],
    bias: { listing: 4, poster: 3, classified: 0.2 },
    masthead: null,
    running: "VALLEY CINEMAFARE",
    devices: ["hairline-boxed theatre blocks with show times in agate", "poster blocks with huge titles", "black reverse heads at column tops"],
    specimens: ["cl-028", "cl-032"],
  },
  {
    id: "tabloid",
    family: fam("modern-condensed-sans"),
    label: "Free Ads",
    era: "2000s tabloid",
    columns: 6,
    gap: 10,
    pad: 28,
    head: "reverse-bar",
    units: [
      ["liner", 14],
      ["house", 1.5],
      ["display", 1],
      ["boxed", 1],
      ["profile", 1],
    ],
    bias: { classified: 2 },
    masthead: { title: "Classifieds", kicker: "Free ads · deadline 5pm Mondays" },
    running: "FREE ADS",
    devices: ["condensed sans everywhere", "black reverse heads at every column top", "liners opening with a bold caps keyword", "tiny booking codes between ads", "grey how-to-place panels"],
    specimens: ["cl-010", "cl-012"],
  },
  {
    id: "photosheet",
    family: fam("photo-liner-specialty"),
    label: "Trade Sheet",
    era: "hobby trade paper",
    columns: 5,
    gap: 12,
    pad: 30,
    head: "reverse-bar",
    units: [
      ["profile", 6],
      ["liner", 6],
      ["display", 1.5],
    ],
    bias: { profile: 4 },
    masthead: { title: "The Directory", kicker: "Artists on file this week" },
    running: "ARTISTS ON FILE",
    devices: ["every ad a greyscale cut over a liner", "bold caps lead naming the item", "black reverse category bars repeating at column tops", "one big framed display in a corner"],
    specimens: ["cl-011"],
  },
];

export const RECIPES: Recipe[] = RAW.map((r) => ({ ...r, dials: PRESETS[r.id] ?? { density: 5, breaks: 5, heterogeneity: 5, colour: 5, fontMix: 5, borders: 5, headers: 5, scale: 5, structures: 5, editorial: 5 } }));

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

/**
 * Global ratio dials: how much of the plane each entry type takes. A recipe's
 * `bias` multiplies these. Admin-editable later (HANDOFF.md "Ratios").
 */
export const RATIOS: Record<EntryType, number> = {
  classified: 10,
  notice: 2.5,
  seasonal: 1,
  listing: 1.2,
  poster: 0.7,
  mailorder: 1.5,
  profile: 2,
  editorial: 1,
};

/** Classification labels the generator sets heads from, by entry type. */
export const CLASSES: Record<EntryType, string[]> = {
  classified: [
    "Studios & Space to Let", "Wanted to Buy", "For Sale", "Instruction", "Services", "Collaborators Wanted",
    "Lost & Found", "Help Wanted", "Work Wanted", "Materials", "Instruments", "Frames & Glass", "Print & Press",
    "Models Wanted", "Business Chances", "Personal", "Rides & Removals", "Swap",
  ],
  notice: ["Public Notices", "Card of Thanks", "In Memoriam", "Change of Name", "Meetings", "Cancellations", "Marriages", "Births", "Legal Notices"],
  seasonal: ["Love Lines", "Valentine", "Season's Greetings", "Harvest Fair", "Year's End"],
  listing: ["Now Showing", "This Week", "Venues", "Open Studios", "Timetable", "Agencies"],
  poster: ["Tonight", "Coming", "One Night Only", "Opening"],
  mailorder: ["Amazing Offers", "By Mail", "Send No Money", "Free Catalog", "Novelties"],
  profile: ["Artists on File", "On Record", "Directory", "Open Files", "Claimed This Week"],
  editorial: ["News", "Local", "Weather", "The Arts", "Letters", "Around the River"],
};

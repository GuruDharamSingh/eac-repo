// Content of the "A theme from five colours" page. Sources: docs/open/THEME_SYSTEM_2026-11-22/STRUCTURE.md (palettes,
// role assignments, notes N1 to N8) and INVENTORY.md (section names, counts, off-palette examples). Nothing here is saved to a site.

export type SiteId = "elkdonis" | "amrit";
export type Tone = "plain" | "soft" | "deep" | "accent";
/** 0 means the colour as chosen; 100 to 900 are the nine shades, light to dark. */
export type Shade = 0 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
export const SHADES: Shade[] = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900];
export const TONES: Tone[] = ["plain", "soft", "deep", "accent"];

export type RoleKey = "ground" | "panel" | "soft" | "ink" | "muted" | "line" | "accent" | "accent2" | "accent3" | "danger";
export const ROLE_LABEL: Record<RoleKey | "onAccent", string> = {
  ground: "Ground",
  panel: "Panel",
  soft: "Soft ground",
  ink: "Ink",
  muted: "Muted ink",
  line: "Line",
  accent: "Accent",
  accent2: "Accent 2",
  accent3: "Accent 3",
  onAccent: "On-accent",
  danger: "Danger",
};
export const ROLE_JOB: Record<RoleKey | "onAccent", string> = {
  ground: "The page behind everything",
  panel: "Cards and boxes sitting on the ground",
  soft: "A quieter ground for bands and fields",
  ink: "Main text",
  muted: "Small and secondary text",
  line: "Borders and dividers",
  accent: "Buttons and links",
  accent2: "Highlights and bands",
  accent3: "Small marks",
  onAccent: "Text on an accent colour",
  danger: "Errors and warnings",
};
export const ROLE_ORDER: RoleKey[] = ["ground", "panel", "soft", "ink", "muted", "line", "accent", "accent2", "accent3", "danger"];

/** Index 5 in a pointer is this fixed red, outside the five. Used when no palette colour reads as red. */
export const FIXED_RED = "#b3261e";
export const FIXED_RED_INDEX = 5;

export type Pointer = [number, Shade];
export interface SiteState {
  colours: string[];
  /** Amrit Canada's fifth slot. Ignored on the other site. */
  fifth: "orange" | "warm";
  pointers: Record<RoleKey, Pointer>;
  tones: Record<string, Tone>;
}

export interface SectionDef {
  key: string;
  name: string;
}
export interface OffPalette {
  where: string;
  literal: string[];
  becomes: string;
  /** The role (or tone's role) the "becomes" chip is drawn with, so it follows the palette. */
  role: RoleKey;
}
export interface SiteDef {
  id: SiteId;
  label: string;
  host: string;
  names: string[];
  start: SiteState;
  sections: SectionDef[];
  fonts: { titleStack: string; bodyStack: string; note: string };
  today: string;
  before: { what: string; today: string; proposal: string }[];
  offPalette: OffPalette[];
}

export const AMRIT_FIFTH = { orange: { name: "Orange", hex: "#F08A24" }, warm: { name: "Warm white", hex: "#FAF3E7" } } as const;

export const SITES: Record<SiteId, SiteDef> = {
  elkdonis: {
    id: "elkdonis",
    label: "elkdonis-arts.org",
    host: "elkdonis-arts.org",
    names: ["Space", "Water", "Fire", "Earth", "Wind"],
    start: {
      colours: ["#E8E4D6", "#2C4A96", "#C9483E", "#E4CC4E", "#548A5C"],
      fifth: "orange",
      pointers: {
        ground: [0, 100],
        panel: [0, 200],
        soft: [0, 300],
        ink: [1, 900],
        muted: [1, 700],
        line: [1, 200],
        accent: [2, 0],
        accent2: [3, 0],
        accent3: [4, 0],
        danger: [2, 800],
      },
      tones: { header: "plain", hero: "deep", offerings: "plain", mutual: "soft", forum: "deep", join: "accent", footer: "deep" },
    },
    sections: [
      { key: "header", name: "Header" },
      { key: "hero", name: "Hero" },
      { key: "offerings", name: "Current offerings" },
      { key: "mutual", name: "A Mutual Aid Society" },
      { key: "forum", name: "The Grand Forum" },
      { key: "join", name: "Join" },
      { key: "footer", name: "Footer" },
    ],
    fonts: {
      titleStack: '"Brothers", "Cormorant Garamond", Georgia, serif',
      bodyStack: '"Basteleur", "Cormorant Garamond", Georgia, serif',
      note: "Brothers for titles and Basteleur for body, the two faces the live site uses.",
    },
    today: "Today the home page shows about 57 different text styles (a face, size, weight, spacing and case each).",
    before: [
      { what: "Colours the site stores", today: "148 colour variables, named after old values", proposal: "5 colours" },
      { what: "Places a colour can be kept", today: "14, and the Site style panel reaches 5", proposal: "11 colour roles, each a pointer" },
      { what: "Section looks on the home page", today: "16 backgrounds and 24 text colours", proposal: "4 tones" },
      { what: "Text styles on the home page", today: "about 57", proposal: "6 text styles" },
    ],
    offPalette: [
      { where: "The Join panel's own parchment, in shared sign-up CSS (31 colours typed into one file)", literal: ["#fbf7ef", "#f2eade"], becomes: "Soft ground and panel", role: "soft" },
      { where: "Join's field fill and its ink", literal: ["#fffdf9", "#241b2f"], becomes: "Panel and ink", role: "panel" },
      { where: "Mutual Aid: colours typed into its saved boxes", literal: ["#000000", "#fffdf8"], becomes: "The deep tone", role: "ink" },
      { where: "The footer: 16 colour values written inline in its code", literal: ["#01124e", "#b79a55"], becomes: "The deep tone, with accent for links", role: "ink" },
      { where: "Cities band: a green typed into a saved box", literal: ["#2a5a2a", "#dde8d0"], becomes: "The accent tone", role: "accent" },
      { where: "The Grand Forum's text fields", literal: ["#fbf7ef"], becomes: "Panel", role: "panel" },
    ],
  },
  amrit: {
    id: "amrit",
    label: "Amrit Canada",
    host: "amritcanada.ca",
    names: ["White", "Deep blue", "Burnt orange", "Light pink", "Orange"],
    start: {
      colours: ["#FFFFFF", "#22295F", "#C8550F", "#F4CFD3", "#F08A24"],
      fifth: "orange",
      pointers: {
        ground: [0, 0],
        panel: [0, 100],
        soft: [3, 100],
        ink: [1, 900],
        muted: [1, 700],
        line: [1, 200],
        accent: [2, 0],
        accent2: [1, 0],
        accent3: [3, 0],
        danger: [FIXED_RED_INDEX, 0],
      },
      tones: { header: "plain", pinned: "plain", upcoming: "soft", subheader: "accent", teachers: "plain", guru: "deep", footer: "deep" },
    },
    sections: [
      { key: "header", name: "Header" },
      { key: "pinned", name: "Pinned gathering" },
      { key: "upcoming", name: "Upcoming" },
      { key: "subheader", name: "We are creating upward spirits" },
      { key: "teachers", name: "Teachers" },
      { key: "guru", name: "Guru Dharam" },
      { key: "footer", name: "Footer" },
    ],
    fonts: {
      titleStack: '"Cinzel", "Cormorant Garamond", Georgia, serif',
      bodyStack: '"Lora", Georgia, serif',
      note: "Cinzel for titles and Lora for body, the two faces the live site uses.",
    },
    today: "Today the site has about 6 text-style combinations, plus size classes added one by one in the code (the small size alone appears 108 times).",
    before: [
      { what: "Colours the site stores", today: "none stored; 39 typed into files (27 in styles, 12 in components)", proposal: "5 colours" },
      { what: "Places a colour can be kept", today: "two stylesheets and every component", proposal: "11 colour roles, each a pointer" },
      { what: "Section looks on the home page", today: "set by hand, section by section", proposal: "4 tones" },
      { what: "Text styles", today: "about 6 combinations plus size classes", proposal: "6 text styles" },
    ],
    offPalette: [
      { where: "The header: 29 uses of a typed-in gold and cream", literal: ["#f4c430", "#fdf5e6"], becomes: "Accent 2 and soft ground", role: "accent2" },
      { where: "The kundalini panel: 11 typed-in colours", literal: ["#f4c430", "#fdf5e6"], becomes: "The accent tone", role: "accent" },
      { where: "The page itself: background and text in the main stylesheet", literal: ["#f9f8f5", "#36454f"], becomes: "Ground and ink", role: "ground" },
      { where: "Teacher cards: 10 colours in their own stylesheet", literal: ["#f4c430"], becomes: "Panel and line", role: "panel" },
      { where: "Writing room: 8 colours in its stylesheet", literal: ["#fdf5e6"], becomes: "Soft ground and ink", role: "soft" },
      { where: "Gold fills written as bg-[#f4c430] in 8 places", literal: ["#f4c430"], becomes: "Accent", role: "accent" },
    ],
  },
};

export const NOTES: { id: string; where: string; text: string }[] = [
  { id: "N1", where: "Palette", text: "Five slots. For elkdonis-arts.org I used the Bon five-elements pigments already in the repo: water, wind, earth, fire, space. Are these the five, or would you rather start from another set, such as the tsakli card colours plus two?" },
  { id: "N2", where: "Amrit's fifth colour", text: "Amrit's fifth colour. Orange gives a second warm accent beside the burnt orange. Warm white gives a softer ground than pure white. Switch between them here and tell me which." },
  { id: "N3", where: "Ground", text: "Ground. On the live site you have been setting grounds to pure white and black. In this palette the lightest shade of Space is a warm off-white. Which should ground be: Space at its lightest, or pure white (white would then take one of the five slots)?" },
  { id: "N4", where: "The accent trio", text: "The accent trio. Accent is for buttons and links, accent 2 for highlights and bands, accent 3 for small marks. Is the order right for each site?" },
  { id: "N5", where: "Tones", text: "Tones. A section keeps only a tone's name: plain, soft, deep or accent. Mutual Aid, Join and The Grand Forum would each pick one instead of carrying typed-in colours. Are four enough, and are the names right?" },
  { id: "N6", where: "Text styles", text: "Text. Six named styles in two families would replace about 57 combinations on the home page today. Do these six names make sense to you?" },
  { id: "N7", where: "Off palette today", text: "Off palette. These are colours the theme cannot reach today. Under this structure each becomes a role or a tone. Should typing in a colour that is not in the palette stay possible (and be listed here), or be blocked?" },
  { id: "N8", where: "Dark and the deep tone", text: "Dark. You already settled that each site chooses dark or light. In this structure that choice is one switch that mirrors the shades, and the deep tone gives dark sections on a light site. Is that how you pictured it, and which way does each of these two sites start?" },
];

export const TEXT_STYLES: { name: string; family: "title" | "body"; size: string; weight: number; track: string; line: string; sample: string }[] = [
  { name: "Display", family: "title", size: "2.5rem", weight: 400, track: "0", line: "1.1", sample: "Art as a way of paying attention" },
  { name: "Title", family: "title", size: "1.9rem", weight: 400, track: "0", line: "1.15", sample: "A page or section title" },
  { name: "Heading", family: "title", size: "1.3rem", weight: 400, track: "0.01em", line: "1.25", sample: "A heading inside a section" },
  { name: "Body", family: "body", size: "1rem", weight: 400, track: "0", line: "1.6", sample: "Running text, set to read comfortably in a column." },
  { name: "Small", family: "body", size: "0.85rem", weight: 400, track: "0", line: "1.5", sample: "Notes, captions and secondary lines." },
  { name: "Label", family: "body", size: "0.78rem", weight: 700, track: "0.03em", line: "1.3", sample: "A field name or a tag" },
];

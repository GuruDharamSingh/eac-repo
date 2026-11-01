/**
 * The classified-ads style catalog: what one annotated specimen page records.
 *
 * Four layers, each written so it can become CSS without reinterpretation:
 *   frame   — the page grid (columns, gutters, rules)
 *   headers — how a classification is labelled
 *   units   — the ad building blocks the generator will choose from
 *   type / color — font roles and inks, each mapped to a web font or hex
 *
 * A specimen's `family` points at a StyleFamily (families.ts), which holds the
 * CSS custom properties a generated page actually uses. See README.md.
 */

/** A region of the page as fractions of its width/height: [x, y, w, h], 0–1. Eyeballed from the image, so approximate. */
export type Box = [x: number, y: number, w: number, h: number];

export type Status = "unannotated" | "draft" | "reviewed";

export type TypeClass =
  | "woodtype"
  | "slab"
  | "grotesque"
  | "condensed-grotesque"
  | "geometric"
  | "transitional"
  | "modern"
  | "oldstyle"
  | "news-serif"
  | "typewriter"
  | "script"
  | "blackletter"
  | "indic";

export interface TypeSample {
  role: "masthead" | "header" | "lead" | "body" | "display" | "phone" | "code" | "notice";
  classification: TypeClass;
  /** What it looks like, in words a designer would use. */
  look: string;
  weight: "light" | "regular" | "bold" | "black";
  width: "condensed" | "normal" | "extended";
  case: "upper" | "title" | "sentence" | "mixed";
  /** Nearest Google Fonts family, as you would put in a CSS font stack. */
  webFont: string;
}

export interface PageFrame {
  columns: number;
  columnWidth: "narrow" | "medium" | "wide" | "mixed";
  gutter: "tight" | "normal" | "open";
  columnRules: "none" | "hairline" | "thin" | "heavy";
  /** vertical: ads run down columns; modular: boxed blocks tile the page. */
  flow: "vertical" | "modular" | "mixed";
  masthead?: string;
  footer?: string;
}

export interface HeaderStyle {
  id: string;
  kind: "banner" | "reverse-bar" | "tint-bar" | "rule-label" | "icon-label" | "boxed-title" | "plain-caps";
  /** A header as printed, e.g. "024 Real Estate For Rent". */
  example: string;
  fg: string;
  bg: string;
  numbering?: "prefix" | "suffix";
  icon?: boolean;
  align: "left" | "center" | "split";
  box?: Box;
  notes?: string;
}

export interface AdUnit {
  id: string;
  kind:
    | "liner"
    | "liner-bold-lead"
    | "liner-tint"
    | "boxed-liner"
    | "display"
    | "reverse-display"
    | "photo-liner"
    | "listing-table"
    | "notice"
    | "house-ad";
  frequency: "dominant" | "common" | "occasional";
  /** How the first words are set. */
  lead: "none" | "bold" | "caps" | "bold-caps";
  align: "justify" | "left" | "center";
  border: "none" | "hairline" | "thin" | "double" | "heavy";
  fill?: string;
  example?: string;
  box?: Box;
  notes?: string;
}

export interface ColorUse {
  mode: "mono" | "spot" | "process";
  paper: string;
  ink: string;
  accents: Array<{ hex: string; use: string }>;
}

/** One row of data/manifest.json: the file as stored. Never edited by hand. */
export interface SpecimenFile {
  id: string;
  file: string;
  width: number;
  height: number;
  original: string;
  sha256: string;
  duplicates: string[];
}

/** One file in data/annotations/<id>.json. Everything but `id` is optional while a draft. */
export interface Annotation {
  id: string;
  status: Exclude<Status, "unannotated">;
  /** Omitted = a real classifieds page. reference: template, mock-up or decor; adjacent: a neighbouring ad section (movie listings). */
  role?: "reference" | "adjacent";
  source?: {
    paper?: string;
    place?: string;
    date?: string;
    era?: string;
    language?: string[];
  };
  summary?: string;
  family?: string;
  frame?: PageFrame;
  headers?: HeaderStyle[];
  units?: AdUnit[];
  type?: TypeSample[];
  color?: ColorUse;
  ornaments?: string[];
  notes?: string[];
}

export type Specimen = SpecimenFile & Partial<Annotation> & { status: Status };

export interface StyleFamily {
  id: string;
  name: string;
  /** provisional: resting on one or two specimens; expect it to merge or split as pages come in. */
  status: "established" | "provisional";
  specimens: string[];
  description: string;
  /** Google Fonts families this family's tokens name. */
  fonts: string[];
  /** CSS custom properties a generated page sets on its root. */
  tokens: Record<`--cl-${string}`, string>;
}

// ============================================================================
// Catalogue entries for the offer-page templates and the patterns inside them.
//
// Each template ships `<id>.meta.tsx` exporting `meta: TemplateMeta`. The
// development app reads these to draw the catalogue (docs + live example +
// code), and agents read them to learn what a template needs without opening
// its source. Plain data: no JSX, no imports beyond types.
// ============================================================================
import type { TemplateId } from "./types";

/** A reusable piece of UI inside a template: the unit the design system grows by. */
export interface PatternMeta {
  /** Stable slug, e.g. "fact-strip", "ticket-stub", "step-strip", "drop-cap". */
  id: string;
  name: string;
  /** One sentence: what it is and when to use it. */
  use: string;
  /** Root CSS class as written today, e.g. "ost-event-stub". */
  rootClass: string;
  /** Packet frame it comes from, e.g. "2m". */
  packet: string;
  /** True when another template draws the same thing (a candidate to lift into shared parts). */
  shared?: boolean;
}

export interface TemplateMeta {
  id: TemplateId;
  /** Exported component name, e.g. "EventTemplate". */
  component: string;
  /** Repo-relative paths. */
  files: { tsx: string; css: string; route: string };
  /** Packet frame, or "derived". */
  packet: string;
  /** Every data path the template reads, required first: "featured.title", "extras.program[]", "pieces[0].bodyHtml". */
  reads: Array<{ path: string; required?: boolean; note?: string }>;
  /** Fields it needed that the contract lacks (extended locally). */
  missing?: Array<{ path: string; why: string }>;
  /** What a visitor can do, and what each control opens: layer ids from ../descriptor, or "inert". */
  actions: Array<{ control: string; opens: string }>;
  patterns: PatternMeta[];
  /** Where it departs from the packet, and why. */
  adapted: string[];
  /** Measured at 390x844: document height in px. */
  phoneHeight?: number;
  status: "draft" | "matches-packet" | "derived";
}

// ============================================================================
// Offer-page templates: the contract (2026-11-27, board:
// docs/open/OFFER_SURFACES_2026-11-27/BOARD.md).
//
// A free-tier site shows ONE offer on its one offer page. A template is how
// that page is laid out. Every template takes the same data and draws inside
// <OfferSurfaceRoot> through <TemplateShell>. Types only; browser-safe.
// ============================================================================
import type { SurfaceSiteData, SurfaceWritingPiece } from "../types";

/** Template ids. One file per id: templates/<id>.tsx + templates/<id>.css. */
export type TemplateId =
  | "event" | "announcement" | "note" // lane A
  | "service" | "artwork" | "series" // lane B
  | "essay" | "feature" | "document" | "gazette" // lane C
  | "profile"; // lane D

/** What an offer may carry beyond SurfaceOffer. All optional: draw nothing when absent. */
export interface OfferExtras {
  /** Kicker beside the kind, e.g. "Music", "One to one". */
  category?: string;
  /** Event running order. */
  program?: Array<{ time: string; label: string }>;
  /** Who is coming (avatar stack). */
  attendees?: Array<{ name: string; avatar?: string | null }>;
  /** "From the night": guest photos ("" = placeholder). */
  photos?: string[];
  talkCount?: number;
  map?: string | null;
  /** "Usually replies within a day". */
  replyNote?: string;
  /** Three facts in a ruled row (announcement, series): WHEN / WHERE / COST. */
  facts?: Array<{ label: string; value: string; note?: string }>;
  /** Announcement ribbon: "New date added · 2 days ago". */
  ribbon?: string;
  /** Series sessions, newest first. */
  sessions?: Array<{ n: number; title: string; when: string; next?: boolean; /** The session is over (additive, 2026-11-27). */ past?: boolean }>;
}

/** A piece of writing with what the reading templates need. */
export interface TemplatePiece extends SurfaceWritingPiece {
  series?: string | null;
  /** Position in the series: 3 of 8. */
  n?: number;
  total?: number;
  /** ISO date. */
  date?: string | null;
  authorId?: string | null;
  /** Sanitised HTML. */
  bodyHtml?: string | null;
  sections?: Array<{ id: string; title: string; html: string }>;
  pullQuote?: string | null;
  picture?: string | null;
  caption?: string | null;
  tags?: string[];
  replies?: Array<{ name: string; ago: string; text: string }>;
  /** Document: "v1.2". */
  version?: string | null;
  footnotes?: string[];
  facts?: Array<{ label: string; value: string }>;
}

/** SurfaceSiteData plus the template extras. Passes straight to <OfferSurfaceRoot data>. */
export interface TemplateData extends SurfaceSiteData {
  /** Extras of the featured offer. */
  extras: OfferExtras;
  /** The featured piece first (reading templates), then the rest of the index. */
  pieces: TemplatePiece[];
  /**
   * Sandbox switch. true = an empty picture / avatar / map / photo slot draws its hatched sample
   * placeholder (the development sandbox). Absent or false = a real page: an empty slot draws nothing
   * and the layout closes up.
   */
  placeholders?: boolean;
}

export interface TemplateProps {
  data: TemplateData;
}

/** Catalogue row: what the template picker shows. */
export interface TemplateInfo {
  id: TemplateId;
  name: string;
  /** Which offer kinds it suits. */
  kinds: Array<"event" | "service" | "series" | "artwork" | "writing" | "profile">;
  /** Packet reference, e.g. "2m"; "derived" when the packet has no page for it. */
  packet: string;
  blurb: string;
}

export const TEMPLATES: TemplateInfo[] = [
  { id: "event", name: "Playbill", kinds: ["event"], packet: "2m", blurb: "Poster, countdown, running order, ticket stub." },
  { id: "announcement", name: "Announcement", kinds: ["event", "writing"], packet: "2j", blurb: "Ribbon, headline, three facts, one action." },
  { id: "note", name: "Note", kinds: ["writing"], packet: "2i", blurb: "Short entry, timeline, replies in the page." },
  { id: "service", name: "Session", kinds: ["service"], packet: "2n", blurb: "What it is on the left, the steps to book on the right." },
  { id: "artwork", name: "Work", kinds: ["artwork"], packet: "derived", blurb: "The work large, its facts and the order beside it." },
  { id: "series", name: "Series", kinds: ["series"], packet: "derived", blurb: "When, where, the next session and the ones before." },
  { id: "essay", name: "Essay", kinds: ["writing"], packet: "2g", blurb: "Drop cap, index rail, reading progress." },
  { id: "feature", name: "Feature", kinds: ["writing"], packet: "2h", blurb: "Cover carries the title; two-column intro." },
  { id: "document", name: "Document", kinds: ["writing"], packet: "2k", blurb: "Contents rail, numbered sections, footnotes." },
  { id: "gazette", name: "Gazette", kinds: ["writing"], packet: "2l", blurb: "Masthead and three justified columns." },
  { id: "profile", name: "Profile", kinds: ["profile"], packet: "3a / 4b", blurb: "The second page: who, what is on now, what else is offered." },
];

// ============================================================================
// The Content hub card's plain data (CONTRACT.md §8, §10.7). Types only: a client file may import this.
// The loader is ./server (`contentServer`); the card is ./card (`contentCard`).
// ============================================================================

import type { ContentIdentity, ContentListItem, ContentType, ContentView } from "../model";
import type { ContentScope } from "../search-types";

export type ContentGroupBy = "site" | "store" | "none";

/** What one mount of the card shows. The card is mounted twice on the market hub ("Artworks", "Content library"). */
export interface ContentCardPreset {
  /** Carried to the detail page as ?preset=<id> so /hub/content opens the same lens. */
  id?: string;
  title?: string;
  scope?: ContentScope;
  types?: ContentType[];
  view?: ContentView;
  groupBy?: ContentGroupBy;
  /** Keepers only: also list hidden pieces (the Hidden badge and a Show button). The server checks it against rights. */
  includeHidden?: boolean;
  /**
   * Round 2 (2026-11-26): set it and the card draws the one-card design: a dark popup stack (list, piece, edit),
   * with a fixed toggle between the site's own works (`scope`) and the network's. Labels for the two ends.
   * Left out, the card is the one it always was.
   */
  scopes?: { site: string; network: string };
  /** The Kind select of the round 2 popup. Default Artwork / Writing / Everything. `types` left out = everything. */
  kinds?: Array<{ label: string; types?: ContentType[] }>;
}

export type ResolvedContentPreset = Required<Pick<ContentCardPreset, "title" | "scope" | "view" | "groupBy">> &
  Pick<ContentCardPreset, "id" | "types" | "includeHidden" | "scopes" | "kinds">;

export const DEFAULT_CONTENT_PRESET: ResolvedContentPreset = {
  title: "Content library",
  scope: { kind: "site" },
  view: "published",
  groupBy: "none",
};

export interface ContentFaceData {
  preset: ResolvedContentPreset;
  /** False when the viewer may not use this lens (the site scope needs an owner or guide). Nothing else is loaded. */
  allowed: boolean;
  endpoints: { search: string; folders: string | null };
  /** Roots the Files view may browse (host.fileSources), keys and labels only. */
  sources: Array<{ key: string; label: string }>;
  identities: ContentIdentity[];
  timeZone: string;
  siteName: string;
  total: number;
  byType: Partial<Record<ContentType, number>>;
  /** The newest few, for the face. */
  latest: ContentListItem[];
  /** host.actions: the registry ids the lightbox may offer here. */
  actions: string[];
}

/** The detail page carries the same data: the page is the full library over the same remote source. */
export type ContentDetailData = ContentFaceData;

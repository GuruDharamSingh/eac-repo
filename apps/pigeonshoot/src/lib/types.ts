/**
 * View-model types for the read layer.
 *
 * These are local rather than imported from @elkdonis/types on purpose: that
 * package still models the pre-migration-030 Post/Meeting shapes, and nothing
 * in it describes a pigeon card. Everything here is camelCase — the snake_case
 * Row interfaces in data.ts never leave that file.
 */

/** A rarity band. Rows in pigeon_tiers, so this list is data, not a union. */
export interface Tier {
  slug: string;
  label: string;
  blurb: string | null;
  minScore: number;
  accentHex: string;
  frameStyle: "plain" | "metal" | "foil" | "holo";
  sortOrder: number;
}

/** One rubric line item. Rows in pigeon_criteria. */
export interface Criterion {
  key: string;
  label: string;
  hint: string | null;
  category: string;
  points: number;
  /**
   * submitter — a tick-box the contributor sees
   * auto      — evaluated server-side; `autoCheck` names the evaluator
   * owner     — only the owner can tick it
   */
  source: "submitter" | "auto" | "owner";
  autoCheck: string | null;
  sortOrder: number;
}

/** How a criterion landed on one specific card. */
export interface CardCriterion {
  key: string;
  label: string;
  hint: string | null;
  points: number;
  source: Criterion["source"];
  /** The submitter (or the auto evaluator) said yes. */
  claimed: boolean;
  /** The owner's verdict. null = not yet reviewed. */
  confirmed: boolean | null;
  /** Frozen at rating time, so re-weighting a criterion can't re-score old cards. */
  pointsAwarded: number | null;
}

export interface Species {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  traits: string[];
  accentHex: string | null;
  status: "proposed" | "published" | "merged" | "rejected";
  mergedInto: string | null;
  heroUrl: string | null;
  /** Only populated by queries that ask for it. */
  cardCount?: number;
}

export interface Area {
  citySlug: string;
  slug: string;
  name: string;
  centroidLat: number | null;
  centroidLng: number | null;
  cardCount?: number;
}

export interface City {
  slug: string;
  name: string;
  region: string | null;
  country: string;
  centerLat: number;
  centerLng: number;
  defaultZoom: number;
  boundaryFile: string | null;
  cardCount?: number;
}

export interface CardImage {
  mediaId: string;
  role: "front" | "side" | "detail" | "context";
  /** Full-size stored original (re-encoded, metadata stripped). */
  url: string;
  width: number | null;
  height: number | null;
  /** 800px derivative used in grids and on the card face. */
  cardUrl: string | null;
  cardWidth: number | null;
  cardHeight: number | null;
  altText: string | null;
}

export interface Card {
  id: string;
  slug: string;
  title: string;
  story: string | null;
  createdAt: Date;
  publishedAt: Date | null;
  viewCount: number;

  species: Pick<Species, "id" | "slug" | "name" | "accentHex"> | null;
  /** Set when the contributor suggested a species that doesn't exist yet. */
  proposedSpeciesName: string | null;

  citySlug: string | null;
  cityName: string | null;
  areaSlug: string | null;
  areaName: string | null;
  lat: number | null;
  lng: number | null;
  geoSource: "pin" | "exif" | "area" | "none";
  geoPrecision: "exact" | "block";
  placeNote: string | null;
  spottedAt: Date | null;

  /** What the machine could verify. Shown as a provisional band until rated. */
  autoScore: number;
  autoMax: number;
  /** The owner's number. null means unrated. */
  ownerScore: number | null;
  /** The owner's verdict. null means unrated — render provisional. */
  tierSlug: string | null;
  ratingNote: string | null;
  ratedAt: Date | null;

  /** Display name of the contributor: a guest handle or a member's name. */
  submitterName: string | null;
  /** True when this card belongs to the current viewer (guest cookie or account). */
  isMine?: boolean;

  moderationState: "live" | "hidden" | "removed";
  openReportCount: number;

  images: CardImage[];
}

/** A card reduced to what a map pin needs. */
export interface CardPin {
  slug: string;
  title: string;
  lat: number;
  lng: number;
  tierSlug: string | null;
  thumbUrl: string | null;
}

/** org_site_sections, keyed by section_key. */
export type SiteSections = Record<string, Record<string, string>>;

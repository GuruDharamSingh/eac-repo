// Type-only and constants: safe for client and server. Owned by STAGE (tour-page hero, 2026-11-20).

/** Settings of the tour-page hero stage. A Puck block stores a Partial of this; DEFAULT_TOUR_STAGE fills the rest. */
export interface TourStageOptions {
  /** Which face is open first. */
  startAt: "overview" | "first-stop";
  /** Which media pill is active first on a stop: its pictures, or the live Street View. */
  lead: "photos" | "streetview";
  /**
   * What a stop's picture pills hold: the stop's own pictures, the stop's then the place's, or the place's only
   * (the place's pictures fall back to the stop's when the place has none).
   */
  media: "stop" | "stop-then-place" | "place";
  /** Draw the strip of faces under the stage. */
  showStrip: boolean;
  /** Stage height in px. */
  height: number;
  /** Longest narrative shown, in characters (cut at a word, with an ellipsis). */
  narrativeMax: number;
  /** Per stop id overrides. `hidden` removes the stop's face (it stays in the walk's numbering); `caption` replaces the picture caption. */
  perStop: Record<string, { media?: TourStageOptions["media"]; lead?: TourStageOptions["lead"]; hidden?: boolean; caption?: string }>;
}

export const DEFAULT_TOUR_STAGE: TourStageOptions = {
  startAt: "overview",
  lead: "photos",
  media: "stop-then-place",
  showStrip: true,
  height: 552,
  narrativeMax: 240,
  perStop: {},
};

// ── data (computed on the server by lib/tour-stage-data.ts, passed down in TourPageData.stage) ──

export interface StagePhoto {
  url: string;
  caption: string | null;
  alt: string | null;
  credit: string | null;
}

/** A linked place, public facts only (never private notes). */
export interface StagePlace {
  id: string;
  slug: string;
  title: string;
  address: string | null;
  excerpt: string | null;
  website: string | null;
  /** Other confident public links (Wikipedia, ...), website excluded. */
  links: { kind: string; url: string }[];
  /** OSM opening_hours syntax, from the place's primary business; null when none. */
  hours: string | null;
  /** The primary business's name when the place is an operating business. */
  businessName: string | null;
  /** "Ticket ..." style facts are not stored anywhere yet: always null until a field exists. */
  ticket: string | null;
}

export interface StageTake {
  guideUserId?: string | null;
  guideName: string | null;
  body: string | null;
  mediaUrl: string | null;
}

export interface StageStopData {
  id: string;
  /** 1-based position among all the tour's stops (hidden ones included): the Roman numeral follows it. */
  number: number;
  /** Roman numeral of `number`. */
  numeral: string;
  title: string;
  /** tour_stops.excerpt, else the first sentence or two of the stop body (plain text, <= 240 chars); null when neither. */
  narrative: string | null;
  narrativeFrom: "excerpt" | "body" | null;
  /** True when `narrative` was cut from the stop body because no excerpt is written (the wizard shows it as a placeholder). */
  narrativeIsFallback: boolean;
  /** The stop's own pictures: its visible images, its photo (image_url); the Street View still only when it has nothing else. */
  stopPhotos: StagePhoto[];
  /** The linked place's public pictures (lib/places-public listPlacePhotos), stop-sourced duplicates removed. */
  placePhotos: StagePhoto[];
  /** First stop picture, else first place picture, else the Street View still: for faces and the backdrop. */
  cover: string | null;
  /** Street View pose, or null (no position, or the guide switched Street View off for the stop). */
  streetView: { lat: number; lng: number; heading: number | null; pitch: number | null; fov: number | null; stillUrl: string | null } | null;
  place: StagePlace | null;
  /** Minutes on foot to the next stop (cached route, 75 m/min), null for the last stop or without a route. */
  walkMinutesToNext: number | null;
  /** Public guide takes about this stop (guide_notes are never read). */
  takes: StageTake[];
  durationMinutes: number | null;
}

export interface TourStageData {
  /** In tour order, hidden-by-options stops included (the client filters). */
  stops: StageStopData[];
  /** Same stops by id, for a block that is given one stop id. */
  byStop: Record<string, StageStopData>;
  /** The overview's narrative: the tour excerpt, else the first sentences of the tour body (plain text, <= 320 chars). */
  tourLede: string | null;
  /** The overview's pictures: the cover, the tour poster, the visible tour gallery images (never Private/ media). */
  overviewPhotos: StagePhoto[];
  /** Takes about the whole tour (stop_id null). */
  tourTakes: StageTake[];
  nextDeparture: { id: string; startsAt: string; seatsLeft: number } | null;
  /** Price per person in major units (null or 0 = not priced) and its currency. */
  price: number | null;
  currency: string;
  /** Profile pictures of the people who lead the tour (the author, the departures' guides, the takes' guides), by user id. Public paths only. */
  guidePhotos?: Record<string, string>;
}

const ROMAN: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];

export function toRoman(n: number): string {
  let out = "";
  let rest = Math.max(1, Math.floor(n));
  for (const [v, s] of ROMAN) while (rest >= v) { out += s; rest -= v; }
  return out;
}

// Type-only: safe for client and server. STAGE lane, 2026-11-21.
// The neutral shape of a "stage": an ordered walk through steps, each with words, media and an optional attached card,
// one primary action, and a few side sections. A tour is the first kind; a workshop is the second. Nothing here says
// "stop", "place" or "book": those words live in vocabulary.ts, chosen by `kind`.

export type StageKind = "tour" | "workshop";

/** A picture or clip reference (the shape the stage draws today; MEDIA may change how it is stored, not what the stage needs). */
export interface StageMediaRef {
  url: string;
  caption: string | null;
  alt: string | null;
  credit: string | null;
}

/** A live view that can stand in for pictures (Street View for a tour stop; a recording or a room for a session). */
export interface StageLiveView {
  kind: "streetview";
  lat: number;
  lng: number;
  heading: number | null;
  pitch: number | null;
  fov: number | null;
  stillUrl: string | null;
}

/** The thing a step is about, as a small card: a place on a tour, a material in a workshop. Public facts only. */
export interface StageCard {
  id: string;
  slug: string;
  title: string;
  /** A place's address; a material's file name or origin. */
  where: string | null;
  summary: string | null;
  /** The card's main link (a place's website; a material's file or page). */
  link: string | null;
  /** Other confident public links. */
  links: { kind: string; url: string }[];
  /** Opening hours of a place; a material has none. */
  when: string | null;
  /** The business that runs a place; the author of a material. */
  by: string | null;
  /** Entry cost of a place; always null until a field exists. */
  cost: string | null;
}

/** What someone said about a step or the whole thing (a guide's take; a facilitator's note). */
export interface StageVoice {
  personId?: string | null;
  personName: string | null;
  body: string | null;
  mediaUrl: string | null;
}

export interface StageStep {
  id: string;
  /** 1-based position among all steps (hidden ones included). */
  number: number;
  /** Roman numeral of `number` (the stage's marker); a kind may show the plain number instead. */
  marker: string;
  title: string;
  narrative: string | null;
  narrativeFrom: "excerpt" | "body" | null;
  narrativeIsFallback: boolean;
  /** The step's own media, and the attached thing's media (the stage chooses between them by setting). */
  media: { own: StageMediaRef[]; related: StageMediaRef[]; cover: string | null; live: StageLiveView | null };
  card: StageCard | null;
  /** Minutes of travel to the next step (null for the last, or without a route). A workshop leaves it null. */
  travelToNext: number | null;
  /** Minutes spent in this step. */
  minutes: number | null;
  voices: StageVoice[];
}

/** One date/time the thing runs: a tour departure, a workshop session run or cohort. */
export interface StageOccasion {
  id: string;
  day: string;
  date: string;
  time: string;
  host: string | null;
  hostId: string | null;
  /** "3 of 8 left" or "Full". */
  availability: string;
  full: boolean;
  note: string | null;
  label: string;
}

export interface StageHost {
  name: string | null;
  photo: string | null;
  sub: string | null;
  voice: { body: string; by: string | null } | null;
}

/** The stage's one big button: Book on a tour, Join on a workshop. */
export interface StageAction {
  kind: "book" | "join";
  /** True when the thing has a price. */
  priced: boolean;
  priceLabel: string;
  /** Only for "join": where the link goes, filled on the server for those who may receive it (never for others). */
  href: string | null;
}

export type StageSectionId = "about" | "sequence" | "occasions" | "gathering" | "included" | "host" | "notes";

export interface StageSection {
  id: StageSectionId;
  /** "01".."07" over the sections that exist. */
  n: string;
  title: string;
  teaser: string;
}

export interface StageModel {
  kind: StageKind;
  steps: StageStep[];
  occasions: StageOccasion[];
  /** The occasion the action bar shows: the one chosen, else the next with room. */
  selectedId: string | null;
  selectedIsNext: boolean;
  moreOccasions: number;
  action: StageAction;
  /** Short label/value facts for the index face and the "what to expect" section. */
  headlineFacts: [string, string][];
  aboutFacts: [string, string][];
  summary: string | null;
  highlights: string[];
  /** Length of the whole journey as words ("4.2 km"); a workshop leaves it null. */
  extent: string | null;
  /** Pins for the map: one per step that has a position. */
  pins: { id: string; title: string; lat: number; lng: number }[];
  /** Where it starts (a tour's meeting point; a workshop's room or address). */
  gathering: { lat: number; lng: number; label: string | null } | null;
  gatheringHelp: { label: string; directions: string; startLine: string | null } | null;
  included: string[];
  host: StageHost | null;
  notes: [string, { text: string; href?: string }][];
  goodToKnow: string[];
  sections: StageSection[];
}

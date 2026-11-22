// The words on screen, per kind. Safe for client and server. STAGE lane, 2026-11-21.
// The "tour" row reproduces, word for word, what the stage and its index draw today (the check proves the index words);
// the "workshop" row is the proposal for a workshop. Adding a kind adds a row, never a code path.

import type { StageKind, StageSectionId } from "./types";

export interface StageVocabulary {
  /** One step / many steps, lower case ("stop", "stops"). */
  step: [string, string];
  /** A step's marker line: "Stop IV". */
  stepMarker: (marker: string) => string;
  /** The attached thing: "Place", "Material". */
  card: { name: string; kicker: string; pageLink: string };
  /** The face for the whole thing, its kicker and the lines around the walk. */
  overview: { title: string; kicker: string; aria: string; empty: string; start: string; end: string };
  about: { title: string };
  noMedia: string;
  live: { label: string; load: string; caption: (at: string) => string };
  travel: (minutes: number) => string;
  here: { fact: string; line: (minutes: number) => string };
  action: Record<"book" | "join", { label: string; sheetTitle: string }>;
  host: { title: string; takeSuffix: string };
  back: { label: string; aria: string };
  sections: Record<StageSectionId, string>;
  occasions: { none: string; offered: (n: number, nextDay: string | null, nextDate: string | null) => string };
  gathering: { fallback: string; teaser: string };
  notes: { add: string; points: (n: number) => string };
}

const plural = (n: number, [one, many]: [string, string]) => `${n} ${n === 1 ? one : many}`;

export const STAGE_VOCABULARY: Record<StageKind, StageVocabulary> = {
  tour: {
    step: ["stop", "stops"],
    stepMarker: (m) => `Stop ${m}`,
    card: { name: "Place", kicker: "Place", pageLink: "Place page →" },
    overview: { title: "The walk", kicker: "Overview", aria: "the walk, stop by stop", empty: "The walk, stop by stop.", start: "Start with stop", end: "The end of the walk · back to the overview" },
    about: { title: "About this tour" },
    noMedia: "No pictures for this stop yet",
    live: { label: "Street View", load: "Load Street View", caption: (at) => `Street View at ${at}` },
    travel: (m) => `${m} min walk`,
    here: { fact: "Time here", line: (m) => `${m} min here` },
    action: { book: { label: "Book", sheetTitle: "Book this walk" }, join: { label: "Join", sheetTitle: "Join this walk" } },
    host: { title: "Your guide", takeSuffix: " · and their take" },
    back: { label: "TOURS", aria: "All tours" },
    sections: { about: "What to expect", sequence: "The route", occasions: "Dates & times", gathering: "Meeting point", included: "What's included", host: "Your guide", notes: "Good to know" },
    occasions: { none: "No dates open yet", offered: (n, d, dt) => `${n} offered${d ? ` · next ${d} ${dt}` : ""}` },
    gathering: { fallback: "Meeting point", teaser: "Marked on the map" },
    notes: { add: "Add points", points: (n) => plural(n, ["point", "points"]) },
  },
  workshop: {
    step: ["session", "sessions"],
    stepMarker: (m) => `Session ${m}`,
    card: { name: "Material", kicker: "Material", pageLink: "Open material →" },
    overview: { title: "The sessions", kicker: "Overview", aria: "the workshop, session by session", empty: "The workshop, session by session.", start: "Start with session", end: "The end of the workshop · back to the overview" },
    about: { title: "About this workshop" },
    noMedia: "No pictures for this session yet",
    live: { label: "Recording", load: "Load the recording", caption: (at) => `Recording of ${at}` },
    travel: () => "",
    here: { fact: "Length", line: (m) => `${m} min` },
    action: { book: { label: "Reserve", sheetTitle: "Reserve a place" }, join: { label: "Join", sheetTitle: "Join this workshop" } },
    host: { title: "Your facilitator", takeSuffix: " · and their note" },
    back: { label: "WORKSHOPS", aria: "All workshops" },
    sections: { about: "What to expect", sequence: "The sessions", occasions: "Dates & times", gathering: "Where we meet", included: "What's included", host: "Your facilitator", notes: "Good to know" },
    occasions: { none: "No dates open yet", offered: (n, d, dt) => `${n} offered${d ? ` · next ${d} ${dt}` : ""}` },
    gathering: { fallback: "Where we meet", teaser: "Room or link" },
    notes: { add: "Add points", points: (n) => plural(n, ["point", "points"]) },
  },
};

export function vocabularyFor(kind: StageKind): StageVocabulary {
  return STAGE_VOCABULARY[kind];
}

/** "3 stops" / "1 session". */
export function countOf(kind: StageKind, n: number): string {
  return plural(n, STAGE_VOCABULARY[kind].step);
}

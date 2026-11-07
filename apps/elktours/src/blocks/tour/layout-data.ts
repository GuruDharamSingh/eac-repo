/**
 * The tour page layout as a Puck document (`{ root, content }`), shared by
 * every tour: blocks and their settings only, never a tour's own words.
 * Client-safe (no database); the store is lib/tour-layout.ts.
 */
export interface TourLayoutItem {
  type: string;
  props: { id: string } & Record<string, unknown>;
}

export interface TourLayoutData {
  root: { props: Record<string, unknown> };
  content: TourLayoutItem[];
}

export const TOUR_BLOCK_TYPES = ["TourFilm", "TourIntro", "TourMain", "TourMore", "TourText"] as const;

/** Today's page, as blocks: what every tour shows until someone designs the layout. */
export const DEFAULT_TOUR_LAYOUT: TourLayoutData = {
  root: { props: {} },
  content: [
    { type: "TourFilm", props: { id: "TourFilm-default", size: "wide", interactive: false } },
    { type: "TourIntro", props: { id: "TourIntro-default", showFacts: true } },
    { type: "TourMain", props: { id: "TourMain-default", showHighlights: true, showRoute: true, routeHeading: "The route", showBooking: true } },
    { type: "TourMore", props: { id: "TourMore-default", heading: "More tours", count: 3 } },
  ],
};

/** A stored document, checked: unknown block types are dropped; a document with nothing usable is null. */
export function readTourLayout(v: unknown): TourLayoutData | null {
  const d = v as { content?: unknown; root?: unknown } | null;
  if (!d || !Array.isArray(d.content)) return null;
  const known = new Set<string>(TOUR_BLOCK_TYPES);
  const content = d.content.filter(
    (c): c is TourLayoutItem =>
      !!c && typeof c === "object" && known.has((c as TourLayoutItem).type) &&
      !!(c as TourLayoutItem).props && typeof (c as TourLayoutItem).props.id === "string"
  );
  if (content.length === 0) return null;
  const root = d.root && typeof d.root === "object" && (d.root as { props?: unknown }).props ? (d.root as TourLayoutData["root"]) : { props: {} };
  return { root, content };
}

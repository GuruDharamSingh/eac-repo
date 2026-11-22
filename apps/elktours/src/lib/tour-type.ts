// The tour type behind the Tours chips (design screen 02). Stored top-level at
// threads.metadata.tourType, like metadata.film and heroLead, so the tour form's
// whole-object write of metadata.tour never drops it. No migration.
// The write is lib/tour-type-actions.ts. Tour rows carry it as `tour.tourType`.

export const TOUR_TYPES = ["walk", "atelier", "museum", "food", "private"] as const;
export type TourType = (typeof TOUR_TYPES)[number];

/** Default chip labels; the Puck block may override them with its own words. */
export const TOUR_TYPE_LABELS: Record<TourType, string> = {
  walk: "Walks",
  atelier: "Ateliers",
  museum: "Museums",
  food: "Food & markets",
  private: "Private",
};

export function readTourType(v: unknown): TourType | null {
  return typeof v === "string" && (TOUR_TYPES as readonly string[]).includes(v) ? (v as TourType) : null;
}

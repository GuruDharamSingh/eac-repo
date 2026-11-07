// What the `experience` and `place` popups read from /api/surfaces/*.
import type {
  Experience,
  ExperienceTourUse,
  PlaceUsage,
  PlaceWithStats,
  TourAsset,
} from "@/lib/catalogue-types";

export interface ExperiencePopupData {
  /** `page` is always null here: the popup never draws the Puck layout. */
  experience: Experience;
  tours: ExperienceTourUse[];
  canEdit: boolean;
}

/** Editors only: carries private notes and stats. */
export interface PlacePopupData {
  place: PlaceWithStats;
  usage: PlaceUsage[];
  assets: TourAsset[];
}

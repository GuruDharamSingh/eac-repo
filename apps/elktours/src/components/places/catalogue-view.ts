import type { PlaceBusinessSummary, PlaceLink, ReviewSummary } from "@/lib/catalogue-types";

/**
 * One place as the PUBLIC catalogue (/places) draws it. Public fields only:
 * the server page builds these from the lib's public read, so private notes,
 * stats and unpublished tours never cross into client components.
 */
export interface CataloguePlaceView {
  id: string;
  slug: string;
  title: string;
  lat: number | null;
  lng: number | null;
  imageUrl: string | null;
  /** One short line of public copy. */
  excerpt: string | null;
  /** Full public copy (sanitised HTML), for the expanded card. */
  body: string | null;
  address: string | null;
  tags: string[];
  /** Published tours that stop here. */
  tours: { id: string; slug: string; title: string }[];
  links: PlaceLink[];
  reviews: ReviewSummary | null;
  /** Network business listings at the place (public facts only), primary first. */
  businesses: PlaceBusinessSummary[];
}

// What the `tour` popup reads from /api/surfaces/tour/[id]. Public data only:
// no guide notes, no private media, no booking manifests.

import type { TourFilm } from "@/lib/tours";
import type { PlaceBusinessSummary, PlaceLink } from "@/lib/catalogue-types";

export interface TourPopupStop {
  id: string;
  position: number;
  title: string;
  /** Plain-text excerpt of the stop's public copy. */
  excerpt: string | null;
  /** The stop's full public copy (sanitised HTML), shown when the stop is expanded. */
  body: string | null;
  /** The linked place's confident outbound links (Wikipedia, official site, ...), with their source. */
  links: PlaceLink[];
  /** The place's primary business (public facts, shells marked). */
  business: PlaceBusinessSummary | null;
  stillUrl: string | null;
  lat: number | null;
  lng: number | null;
  experienceId: string | null;
  /** The catalogue place the stop came from; its public reviews show under the stop. */
  placeId: string | null;
}

export interface TourPopupDeparture {
  id: string;
  startsAt: string;
  seatsLeft: number;
}

export interface TourPopupData {
  tour: {
    id: string;
    slug: string;
    title: string;
    status: string;
    excerpt: string | null;
    coverImageUrl: string | null;
    film: TourFilm | null;
    price: number | null;
    currency: string;
    durationMinutes: number | null;
    location: string | null;
    languages: string[];
    highlights: string[];
    effort: string | null;
    maxParty: number | null;
    meetingPoint: { lat: number; lng: number } | null;
  };
  stops: TourPopupStop[];
  departures: TourPopupDeparture[];
  /** Why booking is off, or null when it is on. */
  unavailable: string | null;
  canEdit: boolean;
}

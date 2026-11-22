// What the editor draws for a block that needs a tour (booking-options, locations): a made-up walk, never stored and
// never read from the database. The tour page supplies the real one (TourPageProvider, blocks/tour/context.tsx).
// TEMPLATE lane, 2026-11-21. Plain data: no server imports, so every config (client and server) can reach it.

import type { TourPageData } from "@/blocks/tour/context";
import type { StageStopData } from "@/components/tours/stage/types";

/** The id a sample tour carries: the blocks use it to keep a sample inert (no real booking from the editor). */
export const SAMPLE_TOUR_ID = "sample-tour";

const STOPS: { title: string; lat: number; lng: number; place: string | null; address: string | null; min: number }[] = [
  { title: "Cathedral square", lat: 48.8530, lng: 2.3499, place: "Cathedral", address: "6 Parvis Notre-Dame, 75004 Paris", min: 15 },
  { title: "The flower market", lat: 48.8556, lng: 2.3469, place: null, address: null, min: 10 },
  { title: "Courtyard of the old palace", lat: 48.8559, lng: 2.3450, place: "Palace courtyard", address: "2 Boulevard du Palais, 75001 Paris", min: 20 },
];

function sampleStops(): StageStopData[] {
  return STOPS.map((s, i) => ({
    id: `sample-stop-${i + 1}`,
    number: i + 1,
    numeral: ["I", "II", "III"][i]!,
    title: s.title,
    narrative: null,
    narrativeFrom: null,
    narrativeIsFallback: false,
    stopPhotos: [],
    placePhotos: [],
    cover: null,
    streetView: null,
    place: s.place
      ? { id: `sample-place-${i + 1}`, slug: `sample-place-${i + 1}`, title: s.place, address: s.address, excerpt: null, website: null, links: [], hours: null, businessName: null, ticket: null }
      : null,
    walkMinutesToNext: i < STOPS.length - 1 ? 4 : null,
    takes: [],
    durationMinutes: s.min,
  }));
}

/** A made-up walk with three stops and three dates, shaped like loadTourPageData's answer. Dates are computed from now. */
export function samplePage(): TourPageData {
  const day = 86_400_000;
  const at = (n: number, hour: number) => {
    const d = new Date(Date.now() + n * day);
    d.setUTCHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  const dep = (i: number, startsAt: string, seatsLeft: number, guideName: string) => ({
    id: `sample-dep-${i}`, threadId: SAMPLE_TOUR_ID, orgId: "sample", startsAt, capacity: 8, guideUserId: null, guideName,
    status: "scheduled", note: null, seatsTaken: 8 - seatsLeft, seatsLeft, confirmedBookings: 0,
  });
  const stops = sampleStops();
  const tour = {
    id: SAMPLE_TOUR_ID, title: "A sample walk", slug: "sample-walk", status: "published", body: null, excerpt: "Three stops on foot, with a local artist.",
    coverImageUrl: null, coverFrame: null, film: null, tourType: null, price: 45, currency: "EUR", durationMinutes: 150, location: "By the fountain, cathedral square",
    details: { highlights: [], includes: ["Your guide", "A small group"], languages: ["English"], meetingPoint: { lat: 48.8527, lng: 2.3497 }, maxParty: 8, effort: "Easy walking", route: null, city: "Paris", via: null },
    goodToKnow: [], contact: null, pinned: false, authorId: null, authorName: null, authorSlug: null, authorPhoto: null,
    publishedAt: null, createdAt: "1970-01-01T00:00:00.000Z", updatedAt: "1970-01-01T00:00:00.000Z",
    stops: stops.map((s, i) => ({ id: s.id, lat: STOPS[i]!.lat, lng: STOPS[i]!.lng, title: s.title, guideNotes: null })),
    departures: [dep(1, at(5, 9), 5, "Sample guide"), dep(2, at(9, 14), 2, "Sample guide"), dep(3, at(16, 9), 0, "Sample guide")],
  };
  return {
    tour,
    canEdit: false,
    unavailable: null,
    maxParty: 8,
    signedInEmail: null,
    googleMapsKey: null,
    others: [],
    contactEmail: null,
    stage: { stops, byStop: Object.fromEntries(stops.map((s) => [s.id, s])), tourLede: null, overviewPhotos: [], tourTakes: [], nextDeparture: null, price: 45, currency: "EUR" },
    fieldEditId: null,
  } as unknown as TourPageData;
}

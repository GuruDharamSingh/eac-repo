// Example services, shown only in the page editor when the site has none yet.

export interface WireService {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  bodyHtml: string;
  bookingType: "one_on_one" | "group" | "async" | null;
  format: "in_person" | "online" | "hybrid" | null;
  priceLabel: string | null;
  price: number | null;
  currency: string;
  priceSlidingMin: number | null;
  slidingScaleNote: string | null;
  registrationStatus: "open" | "waitlist" | "full" | "closed";
  sessionCount: number | null;
  sessionDurationHrs: number | null;
  recurrenceLabel: string | null;
  location: string | null;
  coverImageUrl: string | null;
}

export const SAMPLE_SERVICES: WireService[] = [
  {
    id: "sample-1",
    slug: "movement-lab-series",
    title: "Movement Lab series",
    subtitle: "Six evenings of voice and movement",
    summary: "A small group meets weekly to work from the body's own impulses.",
    bodyHtml: "<p>Each evening begins with a warm-up and moves into guided exploration. No experience needed.</p>",
    bookingType: "group",
    format: "in_person",
    priceLabel: "CA$40–80",
    price: 80,
    currency: "CAD",
    priceSlidingMin: 40,
    slidingScaleNote: "Pay what you can within the range.",
    registrationStatus: "open",
    sessionCount: 6,
    sessionDurationHrs: 2,
    recurrenceLabel: "Weekly",
    location: "Toronto",
    coverImageUrl: null,
  },
  {
    id: "sample-2",
    slug: "one-to-one-session",
    title: "One-to-one session",
    subtitle: null,
    summary: "An hour of private work, arranged to suit you.",
    bodyHtml: "",
    bookingType: "one_on_one",
    format: "online",
    priceLabel: "CA$90",
    price: 90,
    currency: "CAD",
    priceSlidingMin: null,
    slidingScaleNote: null,
    registrationStatus: "open",
    sessionCount: 1,
    sessionDurationHrs: 1,
    recurrenceLabel: null,
    location: null,
    coverImageUrl: null,
  },
];

export interface WireBooking {
  service: WireService | null;
  /** A sentence in place of the form, or null when the form may be shown. */
  unavailable: string | null;
  /** Show the enquiry form instead (a one-to-one service is arranged first). */
  inquiry: boolean;
  defaultName: string | null;
  defaultEmail: string | null;
}

export const SAMPLE_BOOKING: WireBooking = {
  service: SAMPLE_SERVICES[0],
  unavailable: "Booking opens once payouts are set up. This is an example.",
  inquiry: false,
  defaultName: null,
  defaultEmail: null,
};


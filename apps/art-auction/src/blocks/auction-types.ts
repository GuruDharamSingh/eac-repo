// ============================================================================
// What the auction blocks receive. Plain JSON on purpose: the same shapes come
// from the resolver on the published page and from /api/auction/live while a
// page is open, and Puck deep-copies resolver output (a Date would arrive as
// `{}`). Times are ISO strings; money is minor units with its currency.
// ============================================================================

export type LotPhase = "upcoming" | "open" | "closed";

export interface WireLot {
  id: string;
  title: string;
  artist: string | null;
  image: string | null;
  imageAlt: string | null;
  status: string;
  phase: LotPhase;
  startAt: string;
  endAt: string;
  startingBidMinor: number;
  currentBidMinor: number | null;
  bidCount: number;
  incrementMinor: number;
  currency: string;
  event: string | null;
  href: string;
  /** Present once a lot has closed and sold: the hammer price. No name, ever. */
  soldMinor: number | null;
}

export interface WireBid {
  id: string;
  lotId: string;
  lotTitle: string;
  lotHref: string;
  amountMinor: number;
  currency: string;
  /** "Paddle 214": a stable number per bidder. Never a name or an email. */
  paddle: string;
  at: string;
}

export interface WireStats {
  lotsOpen: number;
  bids: number;
  bidders: number;
  highBidMinor: number | null;
  currency: string;
  /** When the next open lot closes; null with nothing open. */
  nextEndAt: string | null;
  lastEndAt: string | null;
}

export interface LiveParts {
  now: string;
  lots?: WireLot[];
  bids?: WireBid[];
  stats?: WireStats;
}

export const SAMPLE_NOW = "2026-10-24T18:00:00.000Z";

const art = (n: number) => `Sample piece ${n}`;
export const SAMPLE_LOTS: WireLot[] = [
  ["a1", "Harbour at dusk", "A. Painter", 41000, 7, 52, 120],
  ["a2", "Study in red", "B. Sculptor", 18000, 3, 88, 240],
  ["a3", "Quiet room", "C. Printmaker", 9500, 1, 135, 400],
  ["a4", art(4), "D. Draughtsman", 26000, 5, 410, 700],
].map(([id, title, artist, bid, count, mins, start]) => ({
  id: String(id),
  title: String(title),
  artist: String(artist),
  image: null,
  imageAlt: null,
  status: "live",
  phase: "open" as const,
  startAt: new Date(Date.parse(SAMPLE_NOW) - Number(start) * 60000).toISOString(),
  endAt: new Date(Date.parse(SAMPLE_NOW) + Number(mins) * 60000).toISOString(),
  startingBidMinor: 5000,
  currentBidMinor: Number(bid),
  bidCount: Number(count),
  incrementMinor: 1000,
  currency: "CAD",
  event: "sample",
  href: "/lots",
  soldMinor: null,
}));

export const SAMPLE_BIDS: WireBid[] = [
  { id: "b1", lotId: "a1", lotTitle: "Harbour at dusk", lotHref: "/lots", amountMinor: 41000, currency: "CAD", paddle: "Paddle 214", at: new Date(Date.parse(SAMPLE_NOW) - 2 * 60000).toISOString() },
  { id: "b2", lotId: "a2", lotTitle: "Study in red", lotHref: "/lots", amountMinor: 18000, currency: "CAD", paddle: "Paddle 107", at: new Date(Date.parse(SAMPLE_NOW) - 9 * 60000).toISOString() },
  { id: "b3", lotId: "a1", lotTitle: "Harbour at dusk", lotHref: "/lots", amountMinor: 39000, currency: "CAD", paddle: "Paddle 352", at: new Date(Date.parse(SAMPLE_NOW) - 21 * 60000).toISOString() },
];

export const SAMPLE_STATS: WireStats = {
  lotsOpen: 4,
  bids: 16,
  bidders: 9,
  highBidMinor: 41000,
  currency: "CAD",
  nextEndAt: new Date(Date.parse(SAMPLE_NOW) + 52 * 60000).toISOString(),
  lastEndAt: new Date(Date.parse(SAMPLE_NOW) + 410 * 60000).toISOString(),
};

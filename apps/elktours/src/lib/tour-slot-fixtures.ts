import type { TourDeparture } from "@elkdonis/commerce/server";
import type { TourInfo } from "@/lib/tour-slots";

/**
 * Sample slots for previewing the mobile Dates, Pay, Schedule, Slot and
 * Decisions screens while no real departure is upcoming. Read-only, modelled
 * on the design prototype's seed, built on real published tours and timed
 * from now so every state is always on screen.
 *
 * ON only when ELK_FIXTURES=1 and NODE_ENV is not "production": the check is
 * `fixturesOn()` and nothing else decides it. A production build never takes
 * the fixture path. Every write action refuses with PREVIEW_REFUSAL while
 * fixtures are on.
 *
 * This file imports only types from tour-slots (no cycle at runtime).
 */

export function fixturesOn(): boolean {
  return process.env.ELK_FIXTURES === "1" && process.env.NODE_ENV !== "production";
}

export const PREVIEW_REFUSAL = "Preview data: nothing is saved.";

/** What a fixture adds to a slot beyond its departure row. */
export interface FixtureExtra {
  waitlistCount?: number;
  runDecision?: "run" | null;
  /** Per-slot settings (booking tables); undefined = the tour's defaults. */
  minToRun?: number | null;
  closeBeforeMinutes?: number;
  waitlistCap?: number | null;
  priceMinor?: number;
}

export interface FixtureWorld {
  /** The chosen tours, with fixture defaults (minimum, cutoff, waitlist size, a price if unset). */
  tours: Map<string, TourInfo>;
  departures: TourDeparture[];
  extras: Map<string, FixtureExtra>;
}

export interface FixtureManifestRow {
  bookingId: string;
  name: string | null;
  email: string;
  party: number;
  note: string | null;
  status: "awaiting_payment" | "confirmed" | "cancelled";
  orderNumber: string | null;
  createdAt: string;
}

// [tour index, hours from now to start, capacity, booked, status, waitlist, run decision, note]
type Seed = [number, number, number, number, "scheduled" | "cancelled", number, ("run" | null)?, string?];

const SEEDS: Seed[] = [
  [0, 3 * 24, 8, 2, "scheduled", 0], //                 open, 2 short of the minimum (4)
  [0, 4 * 24 + 1, 12, 6, "scheduled", 0], //            open, minimum reached
  [0, 5 * 24, 8, 8, "scheduled", 2], //                 full, two on the waitlist
  [0, 20, 10, 2, "scheduled", 0], //                    closed below the minimum: needs the guide's call
  [0, 21, 10, 1, "scheduled", 0, "run"], //             guide chose to run it below the minimum
  [0, 22, 8, 5, "scheduled", 0], //                     closed, confirmed
  [0, 6 * 24, 8, 3, "cancelled", 0], //                 cancelled by hand
  [1, 6 * 24 + 4, 10, 1, "scheduled", 0], //            second tour, open, short (minimum 3)
  [1, 7 * 24, 10, 9, "scheduled", 0], //                nearly full
  [1, 26, 8, 2, "scheduled", 0], //                     closed below the minimum (cutoff 2 days), needs a call
  [2, 8, 8, 2, "scheduled", 0], //                      third tour, closed, confirmed (minimum 2)
  [2, 9 * 24, 8, 0, "scheduled", 0, null, "Private group asked for the morning"],
  [2, -26, 8, 4, "scheduled", 0], //                    finished (yesterday)
];

// Fixture defaults per tour: [minToRun, closeBeforeMinutes, waitlistCap]
const DEFAULTS: Array<[number, number, number | null]> = [
  [4, 24 * 60, 6],
  [3, 48 * 60, 6],
  [2, 12 * 60, null],
];

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** The sample world, built on the site's first three published tours (priced ones first). */
export function fixtureWorld(allTours: Map<string, TourInfo>, now: Date = new Date()): FixtureWorld {
  const published = [...allTours.values()].filter((t) => t.published);
  published.sort((a, b) => Number(b.priceMinor != null) - Number(a.priceMinor != null) || a.title.localeCompare(b.title));
  const chosen = published.slice(0, 3);
  const tours = new Map<string, TourInfo>();
  chosen.forEach((t, i) => {
    const [minToRun, closeBeforeMinutes, waitlistCap] = DEFAULTS[i]!;
    tours.set(t.id, { ...t, priceMinor: t.priceMinor ?? 4500, defaults: { minToRun, closeBeforeMinutes, waitlistCap } });
  });
  const departures: TourDeparture[] = [];
  const extras = new Map<string, FixtureExtra>();
  SEEDS.forEach(([tourIx, hours, capacity, booked, status, wait, run, note], n) => {
    const tour = chosen[tourIx];
    if (!tour) return;
    const start = new Date(Math.round((now.getTime() + hours * 3600_000) / 300_000) * 300_000);
    const slotId = id(n + 1);
    departures.push({
      id: slotId,
      threadId: tour.id,
      orgId: "elktours",
      startsAt: start.toISOString(),
      capacity,
      guideUserId: null,
      guideName: null,
      status,
      note: note ?? null,
      seatsTaken: booked,
      seatsLeft: Math.max(0, capacity - booked),
      confirmedBookings: Math.max(0, Math.ceil(booked / 2)),
    });
    extras.set(slotId, { waitlistCount: wait, runDecision: run ?? null });
  });
  departures.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return { tours, departures, extras };
}

const NAMES = ["Ana Ribeiro", "Tom Becker", "Lucie Martin", "Sam Okafor", "Marta Silva", "Jin Park", "Ola Nordin", "Rafi Haddad", "Chloe Bernard", "Ivo Petrov"];
const NOTES = [null, "Vegetarian", "Using a wheelchair, please advise on stairs", null, "Celebrating a birthday", null];

/** A plausible guest list for a fixture slot: parties of 2 and 1 adding up to the places taken. */
export function fixtureManifest(slotId: string, seatsTaken: number): FixtureManifestRow[] {
  const rows: FixtureManifestRow[] = [];
  let left = seatsTaken;
  let k = Number(slotId.slice(-4)) || 0;
  while (left > 0) {
    const party = left >= 2 && k % 3 !== 2 ? 2 : 1;
    const name = NAMES[k % NAMES.length]!;
    rows.push({
      bookingId: `${slotId}-b${rows.length + 1}`,
      name,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.invalid`,
      party,
      note: NOTES[k % NOTES.length] ?? null,
      status: "confirmed",
      orderNumber: `ELK-${4800 + k * 13}`,
      createdAt: new Date(Date.now() - (k + 1) * 3600_000).toISOString(),
    });
    left -= party;
    k += 1;
  }
  return rows;
}

export function fixtureWaitlist(count: number): Array<{ position: number; name: string; party: number }> {
  return Array.from({ length: count }, (_, i) => ({ position: i + 1, name: NAMES[(i + 5) % NAMES.length]!, party: 1 }));
}

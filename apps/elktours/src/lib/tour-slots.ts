import { db } from "@elkdonis/db";
import {
  MAX_PARTY_SIZE,
  getDeparture,
  listOrgDepartures,
  listTourDepartures,
  parsePartySize,
  type TourDeparture,
} from "@elkdonis/commerce/server";
import {
  bookingRuleText,
  slotState,
  type BelowMinimumRule,
  type ExistingSlot,
  type SlotStateKey,
  type SlotTone,
} from "@elkdonis/checkout/booking-core";
import { getOrgSlot, listOrgSlots, sweepSlots, type OrgSlot } from "@elkdonis/checkout/booking-server";
import { getSiteSettings } from "@/lib/site-settings";
import { fixtureWorld, fixturesOn, type FixtureExtra, type FixtureWorld } from "@/lib/tour-slot-fixtures";
import { siteConfig } from "@/config/site";

/**
 * Slot reads for the mobile Dates, Schedule, Decisions and Board screens
 * (docs/open/ELKTOURS_MOBILE_2026-11-15/backend-map-booking.md, section 6).
 *
 * Step A adapter: today a "slot" is a `tour_departures` row and its bookings
 * are `tour_bookings`, read through @elkdonis/commerce. After the booking
 * cutover the same shapes come from `booking_slots`; the UI does not change.
 * `slotId` is the departure id and is kept by the backfill.
 *
 * Per-tour defaults (minimum to run, cutoff, waitlist size) live on the tour
 * thread at the top-level metadata key `tourBooking`, NOT under `metadata.tour`:
 * the tour form rewrites `metadata.tour` as a whole and would drop them (the
 * same reason `metadata.film` is top-level). Until the slot columns exist
 * (gap 5) every slot of a tour shares them. Server only, fail-soft.
 */

const ORG = siteConfig.orgId;
const DEFAULT_DURATION_MINUTES = 120;

/** Waitlists need the booking tables; until the cutover no slot takes a waitlist join. */
export const WAITLIST_AVAILABLE = false;

export interface TourBookingDefaults {
  /** "Runs with N or more"; null = no minimum (1). */
  minToRun: number | null;
  /** Booking closes this many minutes before the start; 0 = at the start. */
  closeBeforeMinutes: number;
  /** Waitlist places; null = no waitlist. */
  waitlistCap: number | null;
}

export type SlotViewState = "open" | "full_waitlist" | "full" | "closed" | "cancelled";

export interface SlotGuide {
  id: string;
  name: string;
  /** First name, for "Dana decides". */
  short: string;
}

export interface TourSlotView {
  /** The departure id (kept as the booking_slots id after the cutover). */
  slotId: string;
  tourId: string;
  /** ISO instants. */
  startsAt: string;
  endsAt: string;
  guide: SlotGuide | null;
  capacity: number;
  seatsTaken: number;
  seatsLeft: number;
  minToRun: number | null;
  /** ISO instant booking closes. */
  closesAt: string;
  /** What the guest screen shows: open, full (waitlist open), full, closed (booking shut or past) or cancelled. */
  state: SlotViewState;
  /** The finer state the board uses. */
  stateKey: SlotStateKey;
  /** "Booking closes in 2d 3h", "Needs your call · 2 of 4 minimum", ... */
  label: string;
  tone: SlotTone;
  /** Open slots: "N short of the minimum" / "Minimum reached". */
  note: string | null;
  minimumReached: boolean;
  shortBy: number;
  waitlistCount: number;
  /** Null = no waitlist. */
  waitlistCap: number | null;
  /** Price per person, minor units; null = no price set. */
  priceMinor: number | null;
  currency: string;
  /** Largest party one booking may hold on this tour. */
  maxParty: number;
  /** The below-minimum rule in words, for this slot; empty when the tour has no minimum. */
  ruleText: string;
}

export interface BoardSlot extends TourSlotView {
  tourTitle: string;
  tourSlug: string;
  /** The stored status: scheduled or cancelled. */
  status: "scheduled" | "cancelled";
  /** Confirmed bookings (parties), not people. */
  bookings: number;
  /** The guide's own note on the departure. */
  slotNote: string | null;
  /** The guide chose to run it below the minimum. Always null until the cutover. */
  runDecision: "run" | null;
}

// ── tours ─────────────────────────────────────────────────────────────────

export interface TourInfo {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  /** Archived tours stay loadable (their past runs name them) but are not offered for new dates. */
  archived?: boolean;
  authorId: string | null;
  authorName: string | null;
  durationMinutes: number;
  priceMinor: number | null;
  currency: string;
  maxParty: number;
  defaults: TourBookingDefaults;
}

function intOrNull(v: unknown, lo: number, hi: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= lo && n <= hi ? Math.floor(n) : null;
}

export function readTourBookingDefaults(raw: unknown): TourBookingDefaults {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    minToRun: intOrNull(r.minToRun, 1, 500),
    closeBeforeMinutes: intOrNull(r.closeBeforeMinutes, 0, 60 * 24 * 60) ?? 0,
    waitlistCap: intOrNull(r.waitlistCap, 1, 100),
  };
}

/** Every tour of the site (any status), keyed by thread id. */
export async function loadTours(): Promise<Map<string, TourInfo>> {
  const out = new Map<string, TourInfo>();
  try {
    const rows = (await db`
      SELECT t.id, t.title, t.slug, t.status, t.visibility, t.author_id, t.duration_minutes, t.price, t.currency,
             t.metadata->'tourBooking' AS tour_booking, t.metadata->'tour'->'maxParty' AS max_party,
             u.display_name AS author_name
      FROM threads t LEFT JOIN users u ON u.id = t.author_id
      WHERE t.org_id = ${ORG} AND t.kind = 'tour'
    `) as unknown as Record<string, unknown>[];
    for (const r of rows) {
      const price = r.price == null ? null : Number(r.price);
      const maxParty = intOrNull(r.max_party, 1, MAX_PARTY_SIZE) ?? MAX_PARTY_SIZE;
      out.set(r.id as string, {
        id: r.id as string,
        title: r.title as string,
        slug: r.slug as string,
        published: r.status === "published" && r.visibility === "PUBLIC",
        archived: r.status === "archived",
        authorId: (r.author_id as string | null) ?? null,
        authorName: (r.author_name as string | null) ?? null,
        durationMinutes: Number(r.duration_minutes) > 0 ? Number(r.duration_minutes) : DEFAULT_DURATION_MINUTES,
        priceMinor: price != null && Number.isFinite(price) && price > 0 ? Math.round(price * 100) : null,
        currency: (r.currency as string | null) ?? siteConfig.currency,
        maxParty,
        defaults: readTourBookingDefaults(r.tour_booking),
      });
    }
  } catch (err) {
    console.error("[elktours] loadTours:", err);
  }
  return out;
}

/** A tour's booking defaults (what every slot of it shares until the slot columns exist). */
export async function getTourBookingDefaults(tourId: string): Promise<TourBookingDefaults | null> {
  return (await loadTours()).get(tourId)?.defaults ?? null;
}

// ── mapping ───────────────────────────────────────────────────────────────

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** The effective guide of a departure: its own, else the tour's author (as the booking emails do). */
function guideOf(d: TourDeparture, tour: TourInfo): SlotGuide | null {
  const id = d.guideUserId ?? tour.authorId;
  const name = d.guideName ?? tour.authorName;
  if (!id || !name) return null;
  return { id, name, short: firstName(name) };
}

export function endsAtOf(startsAt: string, tour: Pick<TourInfo, "durationMinutes">): string {
  return new Date(new Date(startsAt).getTime() + tour.durationMinutes * 60000).toISOString();
}

/**
 * Where slots come from. Off (default): `tour_departures` through @elkdonis/commerce.
 * BOOKING_TABLES=1: `booking_slots` through @elkdonis/booking. The booking path
 * reads the per-slot columns of the draft migration, so the flag must stay off
 * until that migration and the backfill are applied (CUTOVER.md).
 */
export function bookingTablesOn(): boolean {
  return process.env.BOOKING_TABLES === "1";
}

export function fromOrgSlot(s: OrgSlot): { d: TourDeparture; extra: FixtureExtra } {
  return {
    d: {
      id: s.slotId,
      threadId: s.threadId,
      orgId: s.orgId,
      startsAt: s.startsAt,
      capacity: s.capacity,
      guideUserId: s.guideUserId,
      guideName: s.guideName,
      status: s.status,
      note: s.note,
      seatsTaken: s.seatsTaken,
      seatsLeft: s.seatsLeft,
      confirmedBookings: s.confirmedBookings,
    },
    extra: {
      waitlistCount: s.waitlistCount,
      runDecision: s.runDecision,
      minToRun: s.minToRun,
      closeBeforeMinutes: s.closeBeforeMinutes,
      waitlistCap: s.overrides.waitlistCap ?? undefined,
      priceMinor: s.overrides.priceMinor ?? undefined,
    },
  };
}

function toView(d: TourDeparture, tour: TourInfo, rule: BelowMinimumRule, now: Date, extra: FixtureExtra = {}): TourSlotView & { guideShort: string } {
  const endsAt = endsAtOf(d.startsAt, tour);
  const rawMin = extra.minToRun !== undefined ? extra.minToRun : tour.defaults.minToRun;
  // A minimum of 1 is how a slot says "None"; the view says null for both.
  const minToRun = rawMin != null && rawMin > 1 ? rawMin : null;
  const closeBefore = extra.closeBeforeMinutes ?? tour.defaults.closeBeforeMinutes;
  const waitlistCap = extra.waitlistCap !== undefined ? extra.waitlistCap : tour.defaults.waitlistCap;
  const st = slotState({
    startsAt: d.startsAt,
    endsAt,
    status: d.status,
    booked: d.seatsTaken,
    capacity: d.capacity,
    runDecision: extra.runDecision ?? null,
    minToRun,
    closeBeforeMinutes: closeBefore,
    rule,
    now,
  });
  const guide = guideOf(d, tour);
  const waitlistCount = extra.waitlistCount ?? 0;
  const waitlistOn = WAITLIST_AVAILABLE || fixturesOn();
  let state: SlotViewState;
  if (st.key === "cancelled") state = "cancelled";
  else if (st.key === "open") {
    state = st.full ? (waitlistOn && waitlistCap && waitlistCount < waitlistCap ? "full_waitlist" : "full") : "open";
  } else state = "closed";
  return {
    slotId: d.id,
    tourId: d.threadId,
    startsAt: d.startsAt,
    endsAt,
    guide,
    capacity: d.capacity,
    seatsTaken: d.seatsTaken,
    seatsLeft: d.seatsLeft,
    minToRun,
    closesAt: st.closesAt.toISOString(),
    state,
    stateKey: st.key,
    label: st.label,
    // No minimum set on the tour: nothing to be short of, and no rule to state.
    tone: minToRun == null && st.tone === "short" ? "ok" : st.tone,
    note: minToRun == null ? null : st.note,
    minimumReached: minToRun == null ? true : st.minimumReached,
    shortBy: minToRun == null ? 0 : st.shortBy,
    waitlistCount,
    waitlistCap,
    priceMinor: extra.priceMinor ?? tour.priceMinor,
    currency: tour.currency,
    maxParty: tour.maxParty,
    ruleText: minToRun == null ? "" : bookingRuleText({ rule, min: minToRun, guideShort: guide?.short ?? "The guide" }),
    guideShort: guide?.short ?? "The guide",
  };
}

function toBoard(d: TourDeparture & { tourTitle?: string; tourSlug?: string }, tour: TourInfo, rule: BelowMinimumRule, now: Date, extra: FixtureExtra = {}): BoardSlot {
  const { guideShort: _g, ...view } = toView(d, tour, rule, now, extra);
  return {
    ...view,
    tourTitle: tour.title,
    tourSlug: tour.slug,
    status: d.status,
    bookings: d.confirmedBookings,
    slotNote: d.note,
    runDecision: extra.runDecision ?? null,
  };
}

/** The sample world when fixtures are on (ELK_FIXTURES=1, never in production), else null. */
export async function fixtureCtx(): Promise<{ world: FixtureWorld; rule: BelowMinimumRule } | null> {
  if (!fixturesOn()) return null;
  const [tours, settings] = await Promise.all([loadTours(), getSiteSettings()]);
  return { world: fixtureWorld(tours, new Date()), rule: settings.belowMinimumRule };
}

const asDate = (v: Date | string | undefined, fallback: Date): Date => {
  if (!v) return fallback;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? fallback : d;
};

// ── guest reads ───────────────────────────────────────────────────────────

/** The rule that decides a departure below its minimum, from the site settings. */
export async function getBookingRule(): Promise<{ kind: BelowMinimumRule }> {
  return { kind: (await getSiteSettings()).belowMinimumRule };
}

/**
 * A published tour's upcoming scheduled slots (Dates, 04). Closed slots are
 * included, marked `closed`, so the screen can say "Booking closed".
 */
export async function listTourSlots(tourId: string, opts: { from?: Date | string; to?: Date | string } = {}): Promise<TourSlotView[]> {
  try {
    const fx = await fixtureCtx();
    const [tours, settings] = fx ? [fx.world.tours, { belowMinimumRule: fx.rule }] : await Promise.all([loadTours(), getSiteSettings()]);
    const tour = tours.get(tourId);
    if (!tour || !tour.published) return [];
    const now = new Date();
    const from = asDate(opts.from, now).getTime();
    const to = opts.to ? asDate(opts.to, new Date(8.64e15)).getTime() : Infinity;
    const sourced: Array<{ d: TourDeparture; extra: FixtureExtra }> = fx
      ? fx.world.departures
          .filter((d) => d.threadId === tourId && d.status === "scheduled" && new Date(d.startsAt).getTime() >= now.getTime())
          .map((d) => ({ d, extra: fx.world.extras.get(d.id) ?? {} }))
      : bookingTablesOn()
        ? (await listOrgSlots(ORG, { from: now, threadId: tourId, includeCancelled: false })).map(fromOrgSlot)
        : (await listTourDepartures(tourId, { upcomingOnly: true })).map((d) => ({ d, extra: {} }));
    return sourced
      .filter(({ d }) => {
        const t = new Date(d.startsAt).getTime();
        return t >= from && t < to;
      })
      .map(({ d, extra }) => {
        const { guideShort: _g, ...view } = toView(d, tour, settings.belowMinimumRule, now, extra);
        return view;
      });
  } catch (err) {
    console.error("[elktours] listTourSlots:", err);
    return [];
  }
}

export type Quote =
  | {
      ok: true;
      slotId: string;
      tourId: string;
      partySize: number;
      perPersonMinor: number;
      totalMinor: number;
      currency: string;
      /** ISO instant booking closes. */
      closesAt: string;
      /** "Free cancellation until booking closes, Fri 20 Nov, 09:00." */
      policyText: string;
      ruleText: string;
    }
  | { ok: false; error: string };

const closeFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: siteConfig.timeZone,
});

/** What a party pays for a slot, and the words around it (Pay, 05). Reads only. */
export async function quoteBooking(input: { slotId: string; partySize: number }): Promise<Quote> {
  try {
    const party = parsePartySize(input.partySize);
    if (!party) return { ok: false, error: `Party size must be between 1 and ${MAX_PARTY_SIZE}.` };
    const fx = await fixtureCtx();
    let extra: FixtureExtra = {};
    let d: TourDeparture | null;
    if (fx) {
      d = fx.world.departures.find((x) => x.id === input.slotId) ?? null;
      extra = (d && fx.world.extras.get(d.id)) || {};
    } else if (bookingTablesOn()) {
      const os = await getOrgSlot(ORG, input.slotId);
      const m = os ? fromOrgSlot(os) : null;
      d = m?.d ?? null;
      extra = m?.extra ?? {};
    } else {
      d = await getDeparture(input.slotId);
    }
    if (!d) return { ok: false, error: "That date is not open for booking." };
    const [tours, settings] = fx ? [fx.world.tours, { belowMinimumRule: fx.rule }] : await Promise.all([loadTours(), getSiteSettings()]);
    const tour = tours.get(d.threadId);
    if (!tour || !tour.published) return { ok: false, error: "That tour is not available." };
    const v = toView(d, tour, settings.belowMinimumRule, new Date(), extra);
    if (v.state === "cancelled") return { ok: false, error: "That date has been cancelled." };
    if (v.state === "closed") return { ok: false, error: "Booking for that date has closed." };
    if (v.state !== "open") return { ok: false, error: "That date is full." };
    if (party > tour.maxParty) return { ok: false, error: `This tour takes at most ${tour.maxParty} per booking.` };
    if (party > v.seatsLeft) return { ok: false, error: `Only ${v.seatsLeft} place${v.seatsLeft === 1 ? "" : "s"} left on that date.` };
    if (tour.priceMinor == null) return { ok: false, error: "This tour has no price yet." };
    return {
      ok: true,
      slotId: v.slotId,
      tourId: v.tourId,
      partySize: party,
      perPersonMinor: tour.priceMinor,
      totalMinor: tour.priceMinor * party,
      currency: tour.currency,
      closesAt: v.closesAt,
      policyText: `Free cancellation until booking closes, ${closeFormat.format(new Date(v.closesAt))}.`,
      ruleText: v.ruleText,
    };
  } catch (err) {
    console.error("[elktours] quoteBooking:", err);
    return { ok: false, error: "Could not price that booking." };
  }
}

// ── board reads ───────────────────────────────────────────────────────────

export interface BoardQuery {
  from?: Date | string;
  to?: Date | string;
  /** Only slots led by this guide (the departure's guide, else the tour's author). */
  guideUserId?: string;
  includeCancelled?: boolean;
}

/** Slots of the site in a window, with state (Schedule, 31). The caller has checked the role. */
export async function listBoardSlots(opts: BoardQuery = {}): Promise<BoardSlot[]> {
  try {
    const now = new Date();
    const from = asDate(opts.from, new Date(now.getTime() - 24 * 3600_000));
    const fx = await fixtureCtx();
    if (fx) {
      const toMs = opts.to ? asDate(opts.to, new Date(8.64e15)).getTime() : Infinity;
      return fx.world.departures
        .filter((d) => (opts.includeCancelled ?? true) || d.status === "scheduled")
        .filter((d) => new Date(d.startsAt).getTime() >= from.getTime() && new Date(d.startsAt).getTime() < toMs)
        .map((d) => toBoard(d, fx.world.tours.get(d.threadId)!, fx.rule, now, fx.world.extras.get(d.id)))
        .filter((slot) => !opts.guideUserId || slot.guide?.id === opts.guideUserId);
    }
    if (bookingTablesOn()) {
      const [slots, tours, settings] = await Promise.all([
        listOrgSlots(ORG, { from, ...(opts.to ? { to: asDate(opts.to, new Date(from.getTime() + 366 * 86400000)) } : {}), includeCancelled: opts.includeCancelled ?? true }),
        loadTours(),
        getSiteSettings(),
      ]);
      const out: BoardSlot[] = [];
      for (const os of slots) {
        const tour = tours.get(os.threadId);
        if (!tour) continue;
        const m = fromOrgSlot(os);
        const slot = toBoard(m.d, tour, settings.belowMinimumRule, now, m.extra);
        if (opts.guideUserId && slot.guide?.id !== opts.guideUserId) continue;
        out.push(slot);
      }
      return out;
    }
    const [deps, tours, settings] = await Promise.all([
      listOrgDepartures(ORG, {
        from,
        ...(opts.to ? { to: asDate(opts.to, new Date(from.getTime() + 366 * 86400000)) } : {}),
        includeCancelled: opts.includeCancelled ?? true,
      }),
      loadTours(),
      getSiteSettings(),
    ]);
    const out: BoardSlot[] = [];
    for (const d of deps) {
      const tour = tours.get(d.threadId);
      if (!tour) continue;
      const slot = toBoard(d, tour, settings.belowMinimumRule, now);
      if (opts.guideUserId && slot.guide?.id !== opts.guideUserId) continue;
      out.push(slot);
    }
    return out;
  } catch (err) {
    console.error("[elktours] listBoardSlots:", err);
    return [];
  }
}

/** One slot with its state, or null (Slot, 33). The caller has checked the role. */
export async function getBoardSlot(slotId: string): Promise<BoardSlot | null> {
  try {
    const fx = await fixtureCtx();
    if (fx) {
      const f = fx.world.departures.find((x) => x.id === slotId);
      return f ? toBoard(f, fx.world.tours.get(f.threadId)!, fx.rule, new Date(), fx.world.extras.get(f.id)) : null;
    }
    if (bookingTablesOn()) {
      const os = await getOrgSlot(ORG, slotId);
      if (!os) return null;
      const [tours, settings] = await Promise.all([loadTours(), getSiteSettings()]);
      const tour = tours.get(os.threadId);
      const m = fromOrgSlot(os);
      return tour ? toBoard(m.d, tour, settings.belowMinimumRule, new Date(), m.extra) : null;
    }
    const d = await getDeparture(slotId);
    if (!d || d.orgId !== ORG) return null;
    const [tours, settings] = await Promise.all([loadTours(), getSiteSettings()]);
    const tour = tours.get(d.threadId);
    return tour ? toBoard(d, tour, settings.belowMinimumRule, new Date()) : null;
  } catch (err) {
    console.error("[elktours] getBoardSlot:", err);
    return null;
  }
}

/** Counts for the Board screen: slots waiting for the guide's call, slots with a waitlist, the next slot. */
export async function boardCounts(opts: { guideUserId?: string } = {}): Promise<{
  belowMinimum: number;
  withWaitlist: number;
  nextSlot: BoardSlot | null;
}> {
  const slots = await listBoardSlots({ from: new Date(Date.now() - 7 * 86400000), guideUserId: opts.guideUserId, includeCancelled: false });
  const now = Date.now();
  return {
    belowMinimum: slots.filter((s) => s.stateKey === "below").length,
    withWaitlist: slots.filter((s) => s.waitlistCount > 0 && s.stateKey !== "cancelled" && s.stateKey !== "past").length,
    nextSlot: slots.find((s) => s.status === "scheduled" && new Date(s.startsAt).getTime() > now) ?? null,
  };
}

/** The Decisions screen: slots below their minimum, and full slots with a waitlist. */
export async function listDecisions(opts: { guideUserId?: string } = {}): Promise<{
  below: BoardSlot[];
  waits: BoardSlot[];
  rule: BelowMinimumRule;
}> {
  const [slots, rule] = await Promise.all([
    listBoardSlots({ from: new Date(Date.now() - 7 * 86400000), guideUserId: opts.guideUserId, includeCancelled: false }),
    getBookingRule(),
  ]);
  return {
    below: slots.filter((s) => s.stateKey === "below"),
    waits: slots.filter((s) => s.waitlistCount > 0 && s.stateKey !== "cancelled" && s.stateKey !== "past"),
    rule: rule.kind,
  };
}

// ── helpers for the board actions ─────────────────────────────────────────

/** Scheduled slots of the site in a window with their real end, for the guide-overlap check. */
export async function listExistingSlots(from: Date, to: Date): Promise<Array<ExistingSlot & { tourId: string; tourTitle: string }>> {
  const tours = await loadTours();
  const hm = new Intl.DateTimeFormat("en-GB", { timeZone: siteConfig.timeZone, hour: "2-digit", minute: "2-digit", hour12: false });
  const out: Array<ExistingSlot & { tourId: string; tourTitle: string }> = [];
  if (bookingTablesOn()) {
    for (const s of await listOrgSlots(ORG, { from, to, includeCancelled: false })) {
      out.push({
        id: s.slotId,
        tourId: s.threadId,
        tourTitle: s.threadTitle,
        guideUserId: s.guideUserId ?? s.hostUserId,
        status: s.status,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        label: `${s.threadTitle} at ${hm.format(new Date(s.startsAt))}`,
      });
    }
    return out;
  }
  for (const d of await listOrgDepartures(ORG, { from, to, includeCancelled: false })) {
    const t = tours.get(d.threadId);
    if (!t) continue;
    out.push({
      id: d.id,
      tourId: d.threadId,
      tourTitle: t.title,
      guideUserId: d.guideUserId ?? t.authorId,
      status: d.status,
      startsAt: d.startsAt,
      endsAt: endsAtOf(d.startsAt, t),
      label: `${t.title} at ${hm.format(new Date(d.startsAt))}`,
    });
  }
  return out;
}

/**
 * Housekeeping tick for slots on the booking tables: expire lapsed holds and, under
 * the auto_cancel rule, cancel slots that closed below their minimum (refunds are
 * recorded as due, never issued). Returns null when BOOKING_TABLES is off or
 * fixtures are on. Not scheduled anywhere yet: call it from a tick (CUTOVER.md).
 */
export async function sweepTourSlots(): Promise<{ holdsExpired: number; autoCancelled: string[] } | null> {
  if (!bookingTablesOn() || fixturesOn()) return null;
  const settings = await getSiteSettings();
  return sweepSlots(ORG, { rule: settings.belowMinimumRule });
}

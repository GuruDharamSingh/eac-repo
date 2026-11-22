"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import {
  cancelDeparture,
  createDeparture,
  getDeparture,
  listDepartureBookings,
  updateDeparture,
} from "@elkdonis/commerce/server";
import {
  cancelSlot as cancelBookingSlot,
  closeSlotNow as closeBookingSlot,
  createSlots as createBookingSlots,
  getOfferByThread,
  listSlotBookings,
  reopenSlot as reopenBookingSlot,
  runSlot as runBookingSlot,
  setOfferDefaults,
  updateSlot as updateBookingSlot,
  type NewSlot,
} from "@elkdonis/checkout/booking-server";
import { checkNewSlot, type BookingStatus } from "@elkdonis/checkout/booking-core";
import { requireOrgEditor, type Viewer } from "@/lib/auth";
import { listGuides } from "@/lib/tours";
import type { ActionResult } from "@/lib/tour-actions";
import { MAX_SCHEDULE_BATCH, isDay, isTime, parisInstant } from "@/lib/schedule-plan";
import { getSiteSettings } from "@/lib/site-settings";
import { siteConfig } from "@/config/site";
import { PREVIEW_REFUSAL, fixtureManifest, fixtureWaitlist, fixturesOn } from "@/lib/tour-slot-fixtures";
import {
  bookingTablesOn,
  getBoardSlot,
  listExistingSlots,
  loadTours,
  readTourBookingDefaults,
  type BoardSlot,
  type TourInfo,
  type TourBookingDefaults,
} from "@/lib/tour-slots";

/**
 * Board actions for the mobile Schedule, New slots and Slot screens
 * (backend-map-booking.md, section 6). The signatures are the same on both
 * sources:
 *   BOOKING_TABLES off (default)  departures of @elkdonis/commerce; what a
 *     `tour_departures` row cannot hold (a per-slot minimum, cutoff, waitlist
 *     size, price, a run/reopen decision) is refused with UNAVAILABLE, or, for
 *     a new slot, reported in `notStored`.
 *   BOOKING_TABLES=1  booking_slots of @elkdonis/booking, where all of those
 *     are stored per slot. Needs the draft migrations applied first.
 */

const ORG = siteConfig.orgId;

const UNAVAILABLE = "Available after the booking cutover.";

/** A minimum of none or 1 means "no minimum" (a slot says None by storing 1). */
const minOf = (n: number | null | undefined): number | null => (n != null && n > 1 ? n : null);

/** Guides act only on slots they lead or whose tour they wrote; owners on all. Null = allowed. */
async function denyUnlessMine(viewer: Viewer, slotId: string): Promise<{ ok: false; error: string } | null> {
  if (viewer.role === "owner") return null;
  const slot = await getBoardSlot(slotId);
  if (!slot) return { ok: false, error: "That slot is not on this site." };
  if (slot.guide?.id === viewer.userId) return null;
  const tour = (await loadTours()).get(slot.tourId);
  return tour?.authorId === viewer.userId ? null : { ok: false, error: "That slot is not yours." };
}

function revalidate(slug?: string) {
  revalidatePath("/");
  revalidatePath("/tours");
  revalidatePath("/manage/tours");
  revalidatePath("/manage/schedule");
  revalidatePath("/manage/bookings");
  if (slug) revalidatePath(`/tours/${slug}`);
}

// ── new slots ─────────────────────────────────────────────────────────────

export interface NewSlotsInput {
  tourId: string;
  /** Paris dates, YYYY-MM-DD. */
  dates: string[];
  /** Start times, HH:MM Paris wall clock. */
  times: string[];
  /** The slot's length; not stored on the old source (see notStored). */
  durationMinutes?: number;
  minToRun?: number | null;
  /** Places on each slot. */
  maxPlaces: number;
  closeBeforeMinutes?: number;
  waitlist?: boolean;
  waitlistCap?: number | null;
  /** Per-person price override, minor units. Not stored on the old source. */
  priceMinor?: number | null;
  /** Null or omitted = the tour's author. */
  guideUserId?: string | null;
}

export type SlotProblem = "clash" | "closed" | "exists" | "past" | "over_cap";

export interface SlotPreviewItem {
  day: string;
  time: string;
  startsAt: string;
  endsAt: string;
  ok: boolean;
  reason: SlotProblem | null;
  /** "Clashes with Latin Quarter at 10:00", "Booking would already be closed. Shorten the cutoff.", ... */
  message: string | null;
  clashWith?: { tourTitle: string; startsAt: string };
}

export interface SlotPreview {
  items: SlotPreviewItem[];
  ready: number;
  /** Settings that differ from the tour's own and cannot be stored per slot (old source only; always empty on the booking tables). */
  notStored: Array<"duration" | "minToRun" | "closeBeforeMinutes" | "waitlist" | "price">;
}

async function plan(input: NewSlotsInput, viewer: Viewer): Promise<{ error: string } | { preview: SlotPreview; guideUserId: string | null; tourSlug: string; tour: TourInfo }> {
  const tours = await loadTours();
  const tour = tours.get(input.tourId);
  if (!tour) return { error: "That tour is not on this site." };
  // A guide schedules their own tours and leads them themselves; only the office assigns another guide.
  if (viewer.role !== "owner") {
    if (tour.authorId !== viewer.userId) return { error: "That is not your tour." };
    input = { ...input, guideUserId: viewer.userId };
  }
  const dates = [...new Set((input.dates ?? []).filter(isDay))];
  const times = [...new Set((input.times ?? []).filter(isTime))].sort();
  if (dates.length === 0) return { error: "Pick at least one date." };
  if (times.length === 0) return { error: "Add at least one start time." };
  if (times.length > 4) return { error: "At most four start times." };
  const places = Math.floor(Number(input.maxPlaces));
  if (!(places >= 1 && places <= 500)) return { error: "Places must be between 1 and 500." };
  if (input.minToRun != null && input.minToRun > places) {
    return { error: `The minimum to run (${input.minToRun}) cannot be more than the places (${places}). Raise the places or lower the minimum.` };
  }
  const duration = input.durationMinutes ?? tour.durationMinutes;
  if (!(duration >= 5 && duration <= 1440)) return { error: "Length must be between 5 minutes and 24 hours." };
  const closeBefore = input.closeBeforeMinutes ?? tour.defaults.closeBeforeMinutes;
  if (!(closeBefore >= 0 && closeBefore <= 60 * 24 * 60)) return { error: "Booking must close less than 60 days before the start." };
  let guideId: string | null = null;
  if (input.guideUserId) {
    const guides = await listGuides();
    if (!guides.some((g) => g.id === input.guideUserId)) return { error: "That guide is not on this site." };
    guideId = input.guideUserId;
  }
  const effectiveGuide = guideId ?? tour.authorId;

  const starts = dates
    .flatMap((day) => times.map((time) => ({ day, time, at: parisInstant(day, time) })))
    .filter((c): c is { day: string; time: string; at: Date } => c.at !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  if (starts.length === 0) return { error: "No usable start times." };

  const lo = new Date(starts[0]!.at.getTime() - 36 * 3600_000);
  const hi = new Date(starts[starts.length - 1]!.at.getTime() + 36 * 3600_000);
  const existing = await listExistingSlots(lo, hi);
  const hm = new Intl.DateTimeFormat("en-GB", { timeZone: siteConfig.timeZone, hour: "2-digit", minute: "2-digit", hour12: false });

  const now = new Date();
  const items: SlotPreviewItem[] = [];
  let ready = 0;
  for (const c of starts) {
    const startsAt = c.at.toISOString();
    const endsAt = new Date(c.at.getTime() + duration * 60000).toISOString();
    const base = { day: c.day, time: c.time, startsAt, endsAt };
    if (c.at.getTime() <= now.getTime()) {
      items.push({ ...base, ok: false, reason: "past", message: "That time has already passed." });
      continue;
    }
    if (existing.some((e) => e.tourId === tour.id && new Date(e.startsAt).getTime() === c.at.getTime())) {
      items.push({ ...base, ok: false, reason: "exists", message: "This tour already has a slot at that time." });
      continue;
    }
    const check = checkNewSlot({ candidate: { startsAt, endsAt, guideUserId: effectiveGuide }, closeBeforeMinutes: closeBefore, existing, now });
    if (check.ok === false) {
      items.push({
        ...base,
        ok: false,
        reason: check.reason,
        message: check.message,
        ...(check.clashWith ? { clashWith: { tourTitle: check.clashWith.tourTitle, startsAt: String(check.clashWith.startsAt) } } : {}),
      });
      continue;
    }
    if (ready >= MAX_SCHEDULE_BATCH) {
      items.push({ ...base, ok: false, reason: "over_cap", message: `At most ${MAX_SCHEDULE_BATCH} slots at a time.` });
      continue;
    }
    ready += 1;
    items.push({ ...base, ok: true, reason: null, message: null });
    // A later candidate in this batch must not overlap this one.
    existing.push({
      tourId: tour.id,
      tourTitle: tour.title,
      guideUserId: effectiveGuide,
      status: "scheduled",
      startsAt,
      endsAt,
      label: `${tour.title} at ${hm.format(c.at)}`,
    });
  }

  const d = tour.defaults;
  const notStored: SlotPreview["notStored"] = [];
  if (!bookingTablesOn()) {
    if (input.durationMinutes !== undefined && input.durationMinutes !== tour.durationMinutes) notStored.push("duration");
    if (input.minToRun !== undefined && (input.minToRun ?? null) !== d.minToRun) notStored.push("minToRun");
    if (input.closeBeforeMinutes !== undefined && input.closeBeforeMinutes !== d.closeBeforeMinutes) notStored.push("closeBeforeMinutes");
    if ((input.waitlist !== undefined && input.waitlist !== (d.waitlistCap != null)) || (input.waitlistCap !== undefined && (input.waitlistCap ?? null) !== d.waitlistCap)) {
      notStored.push("waitlist");
    }
  }
  if (input.priceMinor !== undefined && (input.priceMinor ?? null) !== tour.priceMinor) notStored.push("price");

  return { preview: { items, ready, notStored }, guideUserId: guideId, tourSlug: tour.slug, tour };
}

/** The slots a request would create, each ready or blocked with the reason. Writes nothing. */
export async function previewSlots(input: NewSlotsInput): Promise<ActionResult<{ preview: SlotPreview }>> {
  const viewer = await requireOrgEditor();
  try {
    const p = await plan(input, viewer);
    if ("error" in p) return { ok: false, error: p.error };
    return { ok: true, preview: p.preview };
  } catch (err) {
    console.error("[elktours] previewSlots:", err);
    return { ok: false, error: "Could not work out the slots." };
  }
}

/** Create the ready slots (re-planned on the server, so a clash made since the preview is skipped). */
export async function createSlots(input: NewSlotsInput): Promise<ActionResult<{ created: number; skipped: number; notStored: SlotPreview["notStored"]; firstDay: string | null }>> {
  const viewer = await requireOrgEditor();
  if (fixturesOn()) return { ok: false, error: PREVIEW_REFUSAL };
  let created = 0;
  try {
    const p = await plan(input, viewer);
    if ("error" in p) return { ok: false, error: p.error };
    const todo = p.preview.items.filter((i) => i.ok);
    if (todo.length === 0) return { ok: false, error: "Nothing to create: every slot is blocked." };
    if (bookingTablesOn()) {
      const offer = await getOfferByThread(ORG, input.tourId);
      if (!offer) return { ok: false, error: "This tour has no booking set-up yet." };
      const dft = p.tour.defaults;
      // The order is priced from the thread, so a different price for one slot would show but not be charged.
      if (input.priceMinor !== undefined && (input.priceMinor ?? null) !== p.tour.priceMinor) {
        return { ok: false, error: "A different price for one slot is not available yet." };
      }
      // Store a setting on the slot only when it differs from the tour's: the rest is inherited.
      const overrides = {
        ...(input.minToRun !== undefined && minOf(input.minToRun) !== minOf(dft.minToRun) ? { minToRun: minOf(input.minToRun) ?? 1 } : {}),
        ...(input.closeBeforeMinutes !== undefined && input.closeBeforeMinutes !== dft.closeBeforeMinutes ? { closeBeforeMinutes: input.closeBeforeMinutes } : {}),
        ...(input.waitlist === false && dft.waitlistCap != null ? { waitlistCap: 0 } : {}),
        ...(input.waitlist !== false && input.waitlistCap !== undefined && (input.waitlistCap ?? null) !== dft.waitlistCap ? { waitlistCap: input.waitlistCap ?? null } : {}),
      };
      const slots: NewSlot[] = todo.map((item) => ({
        startsAt: item.startsAt,
        capacity: Math.floor(Number(input.maxPlaces)),
        ...(input.durationMinutes !== undefined && input.durationMinutes !== offer.durationMinutes ? { durationMinutes: input.durationMinutes } : {}),
        ...(p.guideUserId ? { guideUserId: p.guideUserId } : {}),
        ...overrides,
      }));
      const r = await createBookingSlots({ orgId: ORG, offerId: offer.id, slots });
      if (r.ok === false) return r;
      revalidate(p.tourSlug);
      if (r.created.length === 0) return { ok: false, error: r.skipped[0]?.message ?? "Nothing was created." };
      const firstDay = todo.find((i) => i.startsAt === r.created[0]!.startsAt)?.day ?? todo[0]!.day;
      return { ok: true, created: r.created.length, skipped: p.preview.items.length - r.created.length, notStored: [], firstDay };
    }
    for (const item of todo) {
      await createDeparture(ORG, input.tourId, {
        startsAt: new Date(item.startsAt),
        capacity: Math.floor(Number(input.maxPlaces)),
        guideUserId: p.guideUserId,
      });
      created += 1;
    }
    revalidate(p.tourSlug);
    return { ok: true, created, skipped: p.preview.items.length - todo.length, notStored: p.preview.notStored, firstDay: todo[0]!.day };
  } catch (err) {
    console.error("[elktours] createSlots:", err);
    revalidate();
    const msg = err instanceof Error ? err.message : "Could not create the slots.";
    return { ok: false, error: created ? `${created} created, then: ${msg}` : msg };
  }
}

// ── one slot ──────────────────────────────────────────────────────────────

export interface ManifestRow {
  bookingId: string;
  name: string | null;
  email: string;
  party: number;
  note: string | null;
  status: BookingStatus;
  orderNumber: string | null;
  createdAt: string;
}

export interface WaitRow {
  position: number;
  name: string;
  party: number;
}

/** A slot with its guest list. The waitlist is empty until the booking cutover. */
export async function getSlot(slotId: string): Promise<ActionResult<{ slot: BoardSlot; manifest: ManifestRow[]; waitlist: WaitRow[]; ruleText: string }>> {
  const viewer = await requireOrgEditor();
  const slot = await getBoardSlot(slotId);
  if (!slot) return { ok: false, error: "That slot is not on this site." };
  const denied = await denyUnlessMine(viewer, slotId);
  if (denied) return denied;
  if (fixturesOn()) {
    return { ok: true, slot, manifest: fixtureManifest(slotId, slot.seatsTaken), waitlist: fixtureWaitlist(slot.waitlistCount), ruleText: slot.ruleText };
  }
  if (bookingTablesOn()) {
    const rows = await listSlotBookings(ORG, slotId).catch(() => []);
    return {
      ok: true,
      slot,
      manifest: rows.map((b) => ({ bookingId: b.bookingId, name: b.name, email: b.email, party: b.party, note: b.note, status: b.status, orderNumber: b.orderNumber, createdAt: b.createdAt })),
      waitlist: [],
      ruleText: slot.ruleText,
    };
  }
  const rows = await listDepartureBookings(ORG, slotId).catch(() => []);
  return {
    ok: true,
    slot,
    manifest: rows.map((b) => ({
      bookingId: b.id,
      name: b.buyerName,
      email: b.buyerEmail,
      party: b.partySize,
      note: b.note,
      status: b.status,
      orderNumber: b.orderNumber,
      createdAt: b.createdAt,
    })),
    waitlist: [],
    ruleText: slot.ruleText,
  };
}

export interface RefundDue {
  bookingId: string;
  orderNumber: string | null;
  name: string | null;
  email: string;
  totalMinor: number;
  currency: string;
}

/**
 * Cancel a slot: its confirmed bookings are cancelled and the guests emailed.
 * Refunds are NOT issued (booking decision 4): `refundsDue` lists what the
 * owner must refund from each order.
 */
export async function cancelSlot(slotId: string, reason?: string): Promise<ActionResult<{ notified: number; refundsDue: RefundDue[] }>> {
  const viewer = await requireOrgEditor();
  if (fixturesOn()) return { ok: false, error: PREVIEW_REFUSAL };
  const denied = await denyUnlessMine(viewer, slotId);
  if (denied) return denied;
  try {
    if (bookingTablesOn()) {
      const r = await cancelBookingSlot(ORG, slotId, { reason: reason ?? null, by: "seller" });
      if (r.ok === false) return r;
      revalidate();
      return {
        ok: true,
        notified: r.cancelled,
        refundsDue: r.refundsDue.map((x) => ({ bookingId: x.bookingId, orderNumber: x.orderNumber, name: x.name, email: x.email, totalMinor: x.amountMinor, currency: x.currency })),
      };
    }
    const confirmed = (await listDepartureBookings(ORG, slotId)).filter((b) => b.status === "confirmed");
    const r = await cancelDeparture(ORG, slotId, reason ?? null);
    revalidate();
    return {
      ok: true,
      notified: r.notified,
      refundsDue: confirmed.map((b) => ({
        bookingId: b.id,
        orderNumber: b.orderNumber,
        name: b.buyerName,
        email: b.buyerEmail,
        totalMinor: b.totalMinor,
        currency: b.currency,
      })),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not cancel." };
  }
}

export interface SlotPatch {
  startsAt?: string;
  capacity?: number;
  /** Null = the tour's author. */
  guideUserId?: string | null;
  note?: string | null;
  // Stored per slot on the booking tables; refused with UNAVAILABLE on the old source.
  minToRun?: number | null;
  closeBeforeMinutes?: number;
  priceMinor?: number | null;
  waitlist?: boolean;
  waitlistCap?: number | null;
}

/** Change a slot's time, places, guide, note, and (booking tables) its own minimum, cutoff, price and waitlist size. */
export async function updateSlot(slotId: string, patch: SlotPatch): Promise<ActionResult<{ slot: BoardSlot | null }>> {
  const viewer = await requireOrgEditor();
  if (fixturesOn()) return { ok: false, error: PREVIEW_REFUSAL };
  const denied = await denyUnlessMine(viewer, slotId);
  if (denied) return denied;
  if (viewer.role !== "owner" && patch.guideUserId !== undefined && patch.guideUserId !== viewer.userId) {
    return { ok: false, error: "Only the office can change the guide." };
  }
  const tables = bookingTablesOn();
  if (patch.priceMinor !== undefined) return { ok: false, error: tables ? "A different price for one slot is not available yet." : UNAVAILABLE };
  if (!tables && (patch.minToRun !== undefined || patch.closeBeforeMinutes !== undefined || patch.waitlist !== undefined || patch.waitlistCap !== undefined)) {
    return { ok: false, error: UNAVAILABLE };
  }
  try {
    const current = await getBoardSlot(slotId);
    if (!current) return { ok: false, error: "That slot is not on this site." };
    if (current.status !== "scheduled") return { ok: false, error: "That slot is cancelled." };
    const startsAt = patch.startsAt ? new Date(patch.startsAt) : new Date(current.startsAt);
    if (Number.isNaN(startsAt.getTime())) return { ok: false, error: "The start time could not be read." };
    const capacity = patch.capacity !== undefined ? Math.floor(Number(patch.capacity)) : current.capacity;
    if (!(capacity >= 1 && capacity <= 500)) return { ok: false, error: "Places must be between 1 and 500." };
    if (capacity < current.seatsTaken) return { ok: false, error: `${current.seatsTaken} places are already taken.` };
    if (patch.guideUserId) {
      const guides = await listGuides();
      if (!guides.some((g) => g.id === patch.guideUserId)) return { ok: false, error: "That guide is not on this site." };
    }
    const guideUserId = patch.guideUserId !== undefined ? patch.guideUserId || null : null;
    const tours = await loadTours();
    const tour = tours.get(current.tourId);
    if (!tour) return { ok: false, error: "That tour is not on this site." };

    const timeChanged = startsAt.getTime() !== new Date(current.startsAt).getTime();
    const guideChanged = patch.guideUserId !== undefined;
    if (timeChanged || guideChanged) {
      const lo = new Date(startsAt.getTime() - 36 * 3600_000);
      const hi = new Date(startsAt.getTime() + 36 * 3600_000);
      const others = (await listExistingSlots(lo, hi)).filter((o) => o.id !== slotId);
      const guide = patch.guideUserId !== undefined ? guideUserId ?? tour.authorId : current.guide?.id ?? tour.authorId;
      const durationMs = new Date(current.endsAt).getTime() - new Date(current.startsAt).getTime();
      const clash = checkNewSlot({
        candidate: { startsAt, endsAt: new Date(startsAt.getTime() + durationMs), guideUserId: guide },
        closeBeforeMinutes: 0,
        existing: others,
      });
      if (clash.ok === false && (clash.reason === "clash" || clash.reason === "past")) return { ok: false, error: clash.message };
    }

    if (tables) {
      const r = await updateBookingSlot(ORG, slotId, {
        ...(patch.startsAt !== undefined ? { startsAt } : {}),
        ...(patch.capacity !== undefined ? { capacity } : {}),
        ...(patch.guideUserId !== undefined ? { guideUserId } : {}),
        ...(patch.note !== undefined ? { note: patch.note } : {}),
        // null (the UI's None) is stored as 1, which behaves as no minimum; null in the booking package would mean "inherit".
        ...(patch.minToRun !== undefined ? { minToRun: minOf(patch.minToRun) ?? 1 } : {}),
        ...(patch.closeBeforeMinutes !== undefined ? { closeBeforeMinutes: patch.closeBeforeMinutes } : {}),
        ...(patch.waitlist === false ? { waitlistCap: 0 } : patch.waitlistCap !== undefined ? { waitlistCap: patch.waitlistCap } : {}),
      });
      if (r.ok === false) return r;
    } else {
      const d = await getDeparture(slotId);
      if (!d || d.orgId !== ORG) return { ok: false, error: "That slot is not on this site." };
      await updateDeparture(ORG, slotId, {
        startsAt,
        capacity,
        guideUserId: patch.guideUserId !== undefined ? guideUserId : d.guideUserId,
        note: patch.note !== undefined ? patch.note : d.note,
      });
    }
    revalidate();
    return { ok: true, slot: await getBoardSlot(slotId) };
  } catch (err) {
    console.error("[elktours] updateSlot:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Could not save the slot." };
  }
}

// ── per-tour defaults ─────────────────────────────────────────────────────

/**
 * Save a tour's booking defaults (minimum to run, cutoff in minutes, waitlist
 * size) at the top-level `metadata.tourBooking` of the tour thread, and, on
 * the booking tables, on the tour's offer as well (slots without their own
 * setting inherit it).
 */
export async function saveTourBookingDefaults(tourId: string, patch: Partial<TourBookingDefaults>): Promise<ActionResult<{ defaults: TourBookingDefaults }>> {
  const viewer = await requireOrgEditor();
  if (fixturesOn()) return { ok: false, error: PREVIEW_REFUSAL };
  const tours = await loadTours();
  const tour = tours.get(tourId);
  if (!tour) return { ok: false, error: "That tour is not on this site." };
  if (viewer.role !== "owner" && tour.authorId !== viewer.userId) return { ok: false, error: "That is not your tour." };
  const next = readTourBookingDefaults({ ...tour.defaults, ...patch });
  if (patch.minToRun != null && next.minToRun == null) return { ok: false, error: "The minimum to run must be between 1 and 500." };
  if (patch.closeBeforeMinutes !== undefined && next.closeBeforeMinutes !== patch.closeBeforeMinutes) {
    return { ok: false, error: "Booking must close less than 60 days before the start." };
  }
  if (patch.waitlistCap != null && next.waitlistCap == null) return { ok: false, error: "The waitlist holds between 1 and 100." };
  try {
    await db`
      UPDATE threads SET metadata = COALESCE(metadata, '{}'::jsonb) || ${db.json({ tourBooking: next } as never)}, updated_at = NOW()
      WHERE id = ${tourId} AND org_id = ${ORG} AND kind = 'tour'
    `;
    if (bookingTablesOn()) {
      await setOfferDefaults(ORG, tourId, { minToRun: next.minToRun, closeBeforeMinutes: next.closeBeforeMinutes, waitlist: next.waitlistCap != null });
    }
    revalidate(tour.slug);
    return { ok: true, defaults: next };
  } catch (err) {
    console.error("[elktours] saveTourBookingDefaults:", err);
    return { ok: false, error: "Could not save." };
  }
}

// ── the guide's decisions (booking tables) ────────────────────────────────

/** "Run it with N guests": a slot below its minimum goes ahead; the guests are told. */
export async function runSlot(slotId: string): Promise<ActionResult> {
  const viewer = await requireOrgEditor();
  if (fixturesOn()) return { ok: false, error: PREVIEW_REFUSAL };
  const denied = await denyUnlessMine(viewer, slotId);
  if (denied) return denied;
  if (!bookingTablesOn()) return { ok: false, error: UNAVAILABLE };
  const settings = await getSiteSettings();
  const r = await runBookingSlot(ORG, slotId, { rule: settings.belowMinimumRule });
  if (r.ok) revalidate();
  return r;
}

/** Reopen booking so it closes `hours` from now. */
export async function reopenSlot(slotId: string, opts: { hours: number }): Promise<ActionResult<{ closesAt: string; closesInHours: number }>> {
  const viewer = await requireOrgEditor();
  if (fixturesOn()) return { ok: false, error: PREVIEW_REFUSAL };
  const denied = await denyUnlessMine(viewer, slotId);
  if (denied) return denied;
  if (!bookingTablesOn()) return { ok: false, error: UNAVAILABLE };
  const r = await reopenBookingSlot(ORG, slotId, { hours: opts.hours });
  if (r.ok) revalidate();
  return r;
}

/** Close booking now: the guest list is fixed. */
export async function closeSlotNow(slotId: string): Promise<ActionResult> {
  const viewer = await requireOrgEditor();
  if (fixturesOn()) return { ok: false, error: PREVIEW_REFUSAL };
  const denied = await denyUnlessMine(viewer, slotId);
  if (denied) return denied;
  if (!bookingTablesOn()) return { ok: false, error: UNAVAILABLE };
  const r = await closeBookingSlot(ORG, slotId);
  if (r.ok) revalidate();
  return r;
}

/** Offer a freed place to the first on the waitlist. The waitlist is not built yet. */
export async function offerWaitlistPlace(_slotId: string): Promise<ActionResult> {
  await requireOrgEditor();
  return { ok: false, error: UNAVAILABLE };
}

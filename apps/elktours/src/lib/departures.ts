import { db } from "@elkdonis/db";
import {
  cancelDeparture as legacyCancelDeparture,
  cancelTourBooking as legacyCancelTourBooking,
  createDeparture as legacyCreateDeparture,
  getDeparture as legacyGetDeparture,
  listBuyerTourBookings as legacyListBuyerTourBookings,
  listDepartureBookings as legacyListDepartureBookings,
  listOrgDepartures as legacyListOrgDepartures,
  listOrgTourBookings as legacyListOrgTourBookings,
  listTourDepartures as legacyListTourDepartures,
  updateDeparture as legacyUpdateDeparture,
  type BuyerTourBooking,
  type DepartureInput,
  type TourBooking,
  type TourDeparture,
} from "@elkdonis/commerce/server";
import {
  cancelSlot,
  createSlots,
  getOfferByThread,
  getOrgSlot,
  listOrgSlots,
  orgCancelBooking,
  updateSlot,
} from "@elkdonis/checkout/booking-server";
import { siteConfig } from "@/config/site";
import { bookingTablesOn, fromOrgSlot } from "@/lib/tour-slots";

/**
 * Departures and their bookings, from whichever store is live.
 *
 * Same names, arguments and result shapes as the departure functions of
 * @elkdonis/commerce/server (the old `tour_departures` / `tour_bookings`).
 * Off (default) every function IS the commerce one. With BOOKING_TABLES=1
 * they read and write `booking_slots` / `bookings` (set_dates offers), so the
 * desktop /manage pages, the tour page and the account page follow the same
 * flag as the mobile adapter (tour-slots.ts, slot-actions.ts).
 *
 * Raw SQL elsewhere in elktours that names `tour_departures` / `tour_bookings`
 * uses `departuresSql()` / `tourBookingsSql()` below: the same columns, from
 * either store. Server only.
 */

const ORG = siteConfig.orgId;

// ── SQL sources for raw queries ───────────────────────────────────────────

/** `tour_departures`, or booking_slots shaped like it (id, thread_id, org_id, starts_at, ends_at, capacity, guide_user_id, status, note). Use as `FROM ${departuresSql()} d`. */
export function departuresSql() {
  return bookingTablesOn()
    ? db`(SELECT s.id, o.thread_id, s.org_id, s.starts_at, s.ends_at, s.capacity, s.guide_user_id, s.status, s.note
          FROM booking_slots s JOIN booking_offers o ON o.id = s.offer_id AND o.mode = 'set_dates')`
    : db`tour_departures`;
}

/** `tour_bookings`, or bookings shaped like it for what raw queries read (departure_id, status, party_size). Use as `FROM ${tourBookingsSql()} b`. */
export function tourBookingsSql() {
  return bookingTablesOn()
    ? db`(SELECT b.slot_id AS departure_id, b.status, b.party_size FROM bookings b WHERE b.slot_id IS NOT NULL)`
    : db`tour_bookings`;
}

// ── departures ────────────────────────────────────────────────────────────

const iso = (v: unknown): string => new Date(v as string).toISOString();

export async function listTourDepartures(
  threadId: string,
  opts: { upcomingOnly?: boolean; includeCancelled?: boolean } = {}
): Promise<TourDeparture[]> {
  if (!bookingTablesOn()) return legacyListTourDepartures(threadId, opts);
  const slots = await listOrgSlots(ORG, {
    threadId,
    ...(opts.upcomingOnly ? { from: new Date() } : {}),
    includeCancelled: opts.includeCancelled ?? false,
  });
  return slots.slice(0, 200).map((s) => fromOrgSlot(s).d);
}

export async function listOrgDepartures(
  orgId: string,
  opts: { from?: Date; to?: Date; includeCancelled?: boolean } = {}
): Promise<(TourDeparture & { tourTitle: string; tourSlug: string })[]> {
  if (!bookingTablesOn()) return legacyListOrgDepartures(orgId, opts);
  const from = opts.from ?? new Date(Date.now() - 24 * 3600_000);
  const slots = await listOrgSlots(orgId, { from, ...(opts.to ? { to: opts.to } : {}), includeCancelled: opts.includeCancelled ?? false });
  return slots.slice(0, 500).map((s) => ({ ...fromOrgSlot(s).d, tourTitle: s.threadTitle, tourSlug: s.threadSlug ?? "" }));
}

export async function getDeparture(id: string): Promise<TourDeparture | null> {
  if (!bookingTablesOn()) return legacyGetDeparture(id);
  const s = await getOrgSlot(ORG, id);
  return s ? fromOrgSlot(s).d : null;
}

export async function createDeparture(orgId: string, threadId: string, input: DepartureInput): Promise<TourDeparture> {
  if (!bookingTablesOn()) return legacyCreateDeparture(orgId, threadId, input);
  const offer = await getOfferByThread(orgId, threadId);
  if (!offer || offer.mode !== "set_dates") throw new Error("That tour is not set up for dated bookings.");
  const r = await createSlots({
    orgId,
    offerId: offer.id,
    slots: [{ startsAt: input.startsAt, capacity: input.capacity, guideUserId: input.guideUserId ?? undefined, note: input.note ?? null }],
  });
  if (r.ok === false) throw new Error(r.error);
  if (r.created.length === 0) throw new Error(r.skipped[0]?.message ?? "Could not add the departure.");
  const made = await getOrgSlot(orgId, r.created[0]!.slotId);
  if (!made) throw new Error("Could not add the departure.");
  return fromOrgSlot(made).d;
}

export async function updateDeparture(orgId: string, id: string, input: DepartureInput): Promise<TourDeparture> {
  if (!bookingTablesOn()) return legacyUpdateDeparture(orgId, id, input);
  const r = await updateSlot(orgId, id, {
    startsAt: input.startsAt,
    capacity: input.capacity,
    guideUserId: input.guideUserId ?? null,
    note: input.note ?? null,
  });
  if (r.ok === false) throw new Error(r.error);
  const s = await getOrgSlot(orgId, id);
  if (!s) throw new Error("That departure is not on this site.");
  return fromOrgSlot(s).d;
}

export async function cancelDeparture(orgId: string, id: string, message?: string | null): Promise<{ notified: number }> {
  if (!bookingTablesOn()) return legacyCancelDeparture(orgId, id, message);
  const r = await cancelSlot(orgId, id, { reason: message ?? null, by: "seller" });
  if (r.ok === false) throw new Error(r.error);
  return { notified: r.cancelled };
}

/**
 * Delete a cancelled departure for good, so it stops showing crossed out on the
 * schedule (developer, 2026-11-19; owners only, checked by the caller).
 * Refuses a scheduled departure (cancel it first) and one that any booking row
 * points at, in any status: those rows keep the order, refund and email record,
 * and `bookings.slot_id` is ON DELETE RESTRICT. With BOOKING_TABLES on, the
 * legacy `tour_departures` copy of the same id (migration 274 kept the ids) is
 * removed too, under the same conditions, so a flag rollback does not bring it back.
 * Stop notes and stop commissions tied to the run keep their rows (their
 * departure_id is ON DELETE SET NULL).
 */
export async function removeCancelledDeparture(orgId: string, id: string): Promise<void> {
  const slots = bookingTablesOn();
  await db.begin(async (tx) => {
    const rows = (slots
      ? await tx`
          SELECT s.status, (SELECT COUNT(*)::int FROM bookings b WHERE b.slot_id = s.id) AS booked
          FROM booking_slots s WHERE s.id = ${id} AND s.org_id = ${orgId} FOR UPDATE`
      : await tx`
          SELECT d.status, (SELECT COUNT(*)::int FROM tour_bookings b WHERE b.departure_id = d.id) AS booked
          FROM tour_departures d WHERE d.id = ${id} AND d.org_id = ${orgId} FOR UPDATE`) as unknown as { status: string; booked: number }[];
    const row = rows[0];
    if (!row) throw new Error("That departure is not on this site.");
    if (row.status !== "cancelled") throw new Error("Cancel the departure before removing it.");
    if (row.booked > 0) throw new Error("This departure has booking records (payments, refunds or emails), so it is kept.");

    if (slots) {
      await tx`DELETE FROM booking_slots WHERE id = ${id} AND org_id = ${orgId} AND status = 'cancelled'`;
    }
    await tx`
      DELETE FROM tour_departures d
      WHERE d.id = ${id} AND d.org_id = ${orgId} AND d.status = 'cancelled'
        AND NOT EXISTS (SELECT 1 FROM tour_bookings b WHERE b.departure_id = d.id)`;
  });
}

// ── bookings ──────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function mapBooking(r: Row): TourBooking {
  const status = r.status === "cancelled" ? "cancelled" : "confirmed";
  return {
    id: r.id as string,
    orderId: (r.order_id as string | null) ?? "",
    orderNumber: (r.order_number as string | null) ?? null,
    orderStatus: (r.order_status as string | null) ?? null,
    departureId: (r.slot_id as string | null) ?? "",
    threadId: r.thread_id as string,
    orgId: r.org_id as string,
    tourTitle: r.title as string,
    tourSlug: r.slug as string,
    startsAt: iso(r.scheduled_at),
    durationMinutes: r.duration_minutes != null ? Number(r.duration_minutes) : r.thread_duration != null ? Number(r.thread_duration) : null,
    meetingPoint: (r.location as string | null) ?? null,
    guideName: (r.guide_name as string | null) ?? null,
    guideEmail: null,
    buyerUserId: (r.booker_user_id as string | null) ?? null,
    buyerEmail: r.booker_email as string,
    buyerName: (r.booker_name as string | null) ?? null,
    partySize: Number(r.party_size),
    totalMinor: Number(r.total_minor ?? 0),
    currency: (r.currency as string | null) ?? siteConfig.currency,
    status,
    note: (r.notes as string | null) ?? null,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

const BOOKING_SELECT = db`
  SELECT b.id, b.order_id, b.slot_id, b.thread_id, b.org_id, b.booker_user_id, b.booker_email, b.booker_name, b.party_size,
         b.status, b.notes, b.scheduled_at, b.duration_minutes, b.created_at, b.updated_at,
         t.title, t.slug, t.location, t.duration_minutes AS thread_duration,
         COALESCE(g.display_name, h.display_name, au.display_name) AS guide_name,
         co.number AS order_number, co.status AS order_status, co.total_minor, co.currency
  FROM bookings b
  JOIN booking_offers o ON o.id = b.offer_id AND o.mode = 'set_dates'
  JOIN threads t ON t.id = b.thread_id
  LEFT JOIN booking_slots s ON s.id = b.slot_id
  LEFT JOIN users g ON g.id = s.guide_user_id
  LEFT JOIN users h ON h.id = o.host_user_id
  LEFT JOIN users au ON au.id = t.author_id
  LEFT JOIN commerce_order co ON co.id = b.order_id
`;

/** Paid (or cancelled) bookings only: unpaid holds, expired and waitlisted rows are not part of the old shape. */
const SHOWN = db`b.status IN ('confirmed', 'completed', 'no_show', 'cancelled') AND b.scheduled_at IS NOT NULL`;

export async function listDepartureBookings(orgId: string, departureId: string): Promise<TourBooking[]> {
  if (!bookingTablesOn()) return legacyListDepartureBookings(orgId, departureId);
  if (!/^[0-9a-f-]{36}$/i.test(departureId)) return [];
  const rows = (await db`
    ${BOOKING_SELECT}
    WHERE b.slot_id = ${departureId} AND b.org_id = ${orgId} AND ${SHOWN}
    ORDER BY (b.status = 'confirmed') DESC, b.created_at
  `) as unknown as Row[];
  return rows.map(mapBooking);
}

export async function listOrgTourBookings(orgId: string, limit = 100): Promise<TourBooking[]> {
  if (!bookingTablesOn()) return legacyListOrgTourBookings(orgId, limit);
  const rows = (await db`
    ${BOOKING_SELECT}
    WHERE b.org_id = ${orgId} AND ${SHOWN}
    ORDER BY b.created_at DESC LIMIT ${limit}
  `) as unknown as Row[];
  return rows.map(mapBooking);
}

/** A signed-in person's own bookings, next first (the account page). */
export async function listBuyerTourBookings(userId: string): Promise<BuyerTourBooking[]> {
  if (!bookingTablesOn()) return legacyListBuyerTourBookings(userId);
  const rows = (await db`
    ${BOOKING_SELECT}
    WHERE b.booker_user_id = ${userId} AND b.org_id = ${ORG} AND ${SHOWN}
    ORDER BY b.scheduled_at DESC LIMIT 100
  `) as unknown as Row[];
  return rows.map((r) => {
    const { guideEmail: _g, buyerUserId: _u, ...rest } = mapBooking(r);
    return rest;
  });
}

/** Cancel one booking (org editor). The buyer is told; any refund is recorded as due. */
export async function cancelTourBooking(orgId: string, bookingId: string, message?: string | null): Promise<void> {
  if (!bookingTablesOn()) return legacyCancelTourBooking(orgId, bookingId, message);
  const r = await orgCancelBooking(orgId, bookingId, message ?? null);
  if (r.ok === false) throw new Error(r.error);
}

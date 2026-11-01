/**
 * Tours: stops, dated departures and bookings with a party size (migration
 * 208, 2026-10-18). Sold by apps/elktours; written here so any org site can
 * run tours on the same model.
 *
 * A tour is a thread (`kind = 'tour'`) priced per person. Booking one:
 *
 *   1. The visitor picks a departure and a party size. `startTourCheckout`
 *      (@elkdonis/checkout/booking) checks seats BEFORE the order exists, then
 *      creates the card order with `quantity = partySize` and, right after,
 *      the `tour_bookings` row (`awaiting_payment`) through
 *      `createTourBooking`, which re-checks seats under a row lock on the
 *      departure so two buyers cannot both take the last places.
 *   2. `confirmOrderPaid` calls `markTourBookingPaid` after its transaction
 *      commits: the row moves to `confirmed` and both sides get an email.
 *   3. An unpaid booking holds its seats only while Stripe's checkout can
 *      still complete (HOLD_MINUTES); after that it stops counting and the
 *      order's own expiry cancels it.
 *
 * The payee is the tour's author, through the same settlement as every other
 * thread order. A departure's `guide_user_id` says who leads that run; it does
 * not move the money (an org agreement does that, when the collective or the
 * company takes a share).
 *
 * Access: org-scoped writes take the org id from the caller's site config;
 * the caller has already checked the editor's role there.
 */

import { randomBytes } from "node:crypto";
import { db } from "@elkdonis/db";
import { STRIPE_GRACE_MINUTES } from "./orders";

type Row = Record<string, unknown>;

/** How long an unpaid booking keeps its seats: Stripe's session hour plus the grace the order itself gets. */
export const HOLD_MINUTES = 60 + STRIPE_GRACE_MINUTES;
export const MAX_PARTY_SIZE = 20;

const iso = (v: unknown): string | null => (v == null ? null : new Date(v as string).toISOString());
const num = (v: unknown): number | null => (v == null ? null : Number(v));

// ── types ─────────────────────────────────────────────────────────────────

export interface TourStop {
  id: string;
  threadId: string;
  position: number;
  title: string;
  /** Sanitised HTML, public. */
  body: string | null;
  /** Sanitised HTML, the guide's own notes (migration 210). Strip before sending to a public page. */
  guideNotes: string | null;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  pitch: number | null;
  fov: number | null;
  imageUrl: string | null;
  /** Cached Street View still at the pose (migration 211); made on save, served from the org's media. */
  stillUrl: string | null;
  durationMinutes: number | null;
}

export interface TourStopInput {
  id?: string | null;
  title: string;
  body?: string | null;
  guideNotes?: string | null;
  lat?: number | null;
  lng?: number | null;
  heading?: number | null;
  pitch?: number | null;
  fov?: number | null;
  imageUrl?: string | null;
  durationMinutes?: number | null;
}

export type DepartureStatus = "scheduled" | "cancelled";

export interface TourDeparture {
  id: string;
  threadId: string;
  orgId: string;
  startsAt: string;
  capacity: number;
  guideUserId: string | null;
  guideName: string | null;
  status: DepartureStatus;
  note: string | null;
  /** Confirmed seats plus unpaid ones still inside the hold window. */
  seatsTaken: number;
  seatsLeft: number;
  confirmedBookings: number;
}

export type TourBookingStatus = "awaiting_payment" | "confirmed" | "cancelled";

export interface TourBooking {
  id: string;
  orderId: string;
  orderNumber: string | null;
  orderStatus: string | null;
  departureId: string;
  threadId: string;
  orgId: string;
  tourTitle: string;
  tourSlug: string;
  startsAt: string;
  durationMinutes: number | null;
  meetingPoint: string | null;
  guideName: string | null;
  guideEmail: string | null;
  buyerUserId: string | null;
  buyerEmail: string;
  buyerName: string | null;
  partySize: number;
  totalMinor: number;
  currency: string;
  status: TourBookingStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What the buyer's private page shows: no guide email, no buyer user id. */
export type BuyerTourBooking = Omit<TourBooking, "guideEmail" | "buyerUserId">;

// ── stops ─────────────────────────────────────────────────────────────────

function mapStop(r: Row): TourStop {
  return {
    id: r.id as string,
    threadId: r.thread_id as string,
    position: Number(r.position),
    title: r.title as string,
    body: (r.body as string | null) ?? null,
    guideNotes: (r.guide_notes as string | null) ?? null,
    lat: num(r.lat),
    lng: num(r.lng),
    heading: num(r.heading),
    pitch: num(r.pitch),
    fov: num(r.fov),
    imageUrl: (r.image_url as string | null) ?? null,
    stillUrl: (r.still_url as string | null) ?? null,
    durationMinutes: num(r.duration_minutes),
  };
}

/** Record the cached still for a stop (or clear it). Org-scoped. */
export async function setTourStopStill(orgId: string, stopId: string, stillUrl: string | null): Promise<void> {
  await db`UPDATE tour_stops SET still_url = ${stillUrl}, updated_at = NOW() WHERE id = ${stopId} AND org_id = ${orgId}`;
}

/** Stops whose pose changed since their still was made, or that have none: what a save should refresh. */
export async function listStopsNeedingStill(orgId: string, threadId: string): Promise<TourStop[]> {
  const rows = (await db`
    SELECT * FROM tour_stops
    WHERE thread_id = ${threadId} AND org_id = ${orgId} AND lat IS NOT NULL AND still_url IS NULL
    ORDER BY position
  `) as unknown as Row[];
  return rows.map(mapStop);
}

export async function listTourStops(threadId: string): Promise<TourStop[]> {
  const rows = (await db`
    SELECT * FROM tour_stops WHERE thread_id = ${threadId} ORDER BY position, created_at
  `) as unknown as Row[];
  return rows.map(mapStop);
}

function clampNum(v: unknown, lo: number, hi: number): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Replace a tour's stops with this list, in this order. Rows whose `id` is
 * passed keep it (so a stop's id is stable across edits); the rest are new;
 * stops missing from the list are deleted. Bodies arrive already sanitised
 * by the caller (sanitizeRichText).
 */
export async function saveTourStops(
  orgId: string,
  threadId: string,
  stops: TourStopInput[]
): Promise<TourStop[]> {
  const [owner] = (await db`
    SELECT id FROM threads WHERE id = ${threadId} AND org_id = ${orgId} AND kind = 'tour' LIMIT 1
  `) as unknown as Row[];
  if (!owner) throw new Error("That tour is not on this site.");

  await db.begin(async (tx) => {
    const keep: string[] = [];
    let position = 0;
    for (const s of stops) {
      const title = (s.title ?? "").trim().slice(0, 200);
      if (!title) continue;
      const lat = clampNum(s.lat, -90, 90);
      const lng = clampNum(s.lng, -180, 180);
      const both = lat != null && lng != null;
      const values = {
        title,
        body: s.body?.trim() || null,
        guideNotes: s.guideNotes?.trim() || null,
        lat: both ? lat : null,
        lng: both ? lng : null,
        heading: clampNum(s.heading, 0, 360),
        pitch: clampNum(s.pitch, -90, 90),
        fov: clampNum(s.fov, 10, 100),
        imageUrl: s.imageUrl?.trim() || null,
        durationMinutes: clampNum(s.durationMinutes, 0, 24 * 60),
      };
      const existing = s.id && /^[0-9a-f-]{36}$/i.test(s.id) ? s.id : null;
      const [row] = (existing
        ? await tx`
            UPDATE tour_stops SET
              position = ${position}, title = ${values.title}, body = ${values.body},
              guide_notes = ${values.guideNotes},
              still_url = CASE WHEN lat IS NOT DISTINCT FROM ${values.lat} AND lng IS NOT DISTINCT FROM ${values.lng}
                                AND heading IS NOT DISTINCT FROM ${values.heading}::numeric AND pitch IS NOT DISTINCT FROM ${values.pitch}::numeric
                                AND fov IS NOT DISTINCT FROM ${values.fov}::numeric THEN still_url ELSE NULL END,
              lat = ${values.lat}, lng = ${values.lng}, heading = ${values.heading},
              pitch = ${values.pitch}, fov = ${values.fov}, image_url = ${values.imageUrl},
              duration_minutes = ${values.durationMinutes}, updated_at = NOW()
            WHERE id = ${existing} AND thread_id = ${threadId} AND org_id = ${orgId}
            RETURNING id
          `
        : []) as unknown as Row[];
      if (row) {
        keep.push(row.id as string);
      } else {
        const [made] = (await tx`
          INSERT INTO tour_stops (
            thread_id, org_id, position, title, body, guide_notes, lat, lng, heading, pitch, fov, image_url, duration_minutes
          ) VALUES (
            ${threadId}, ${orgId}, ${position}, ${values.title}, ${values.body}, ${values.guideNotes},
            ${values.lat}, ${values.lng}, ${values.heading}, ${values.pitch}, ${values.fov},
            ${values.imageUrl}, ${values.durationMinutes}
          ) RETURNING id
        `) as unknown as Row[];
        keep.push(made!.id as string);
      }
      position += 1;
    }
    await tx`
      DELETE FROM tour_stops WHERE thread_id = ${threadId} AND org_id = ${orgId}
        AND id <> ALL(${keep}::uuid[])
    `;
  });
  return listTourStops(threadId);
}

// ── departures ────────────────────────────────────────────────────────────

const DEPARTURE_SELECT = db`
  SELECT d.*, g.display_name AS guide_name,
         COALESCE(s.taken, 0) AS seats_taken,
         COALESCE(s.confirmed_bookings, 0) AS confirmed_bookings
  FROM tour_departures d
  LEFT JOIN users g ON g.id = d.guide_user_id
  LEFT JOIN LATERAL (
    SELECT SUM(b.party_size) AS taken,
           COUNT(*) FILTER (WHERE b.status = 'confirmed') AS confirmed_bookings
    FROM tour_bookings b
    WHERE b.departure_id = d.id
      AND (b.status = 'confirmed'
           OR (b.status = 'awaiting_payment' AND b.created_at > NOW() - (${HOLD_MINUTES} || ' minutes')::interval))
  ) s ON TRUE
`;

function mapDeparture(r: Row): TourDeparture {
  const capacity = Number(r.capacity);
  const taken = Number(r.seats_taken ?? 0);
  return {
    id: r.id as string,
    threadId: r.thread_id as string,
    orgId: r.org_id as string,
    startsAt: iso(r.starts_at)!,
    capacity,
    guideUserId: (r.guide_user_id as string | null) ?? null,
    guideName: (r.guide_name as string | null) ?? null,
    status: r.status as DepartureStatus,
    note: (r.note as string | null) ?? null,
    seatsTaken: taken,
    seatsLeft: Math.max(0, capacity - taken),
    confirmedBookings: Number(r.confirmed_bookings ?? 0),
  };
}

/** A tour's departures. Public pages pass `upcomingOnly` and get scheduled runs from now on. */
export async function listTourDepartures(
  threadId: string,
  opts: { upcomingOnly?: boolean; includeCancelled?: boolean } = {}
): Promise<TourDeparture[]> {
  const rows = (await db`
    ${DEPARTURE_SELECT}
    WHERE d.thread_id = ${threadId}
      ${opts.upcomingOnly ? db`AND d.starts_at >= NOW()` : db``}
      ${opts.includeCancelled ? db`` : db`AND d.status = 'scheduled'`}
    ORDER BY d.starts_at
    LIMIT 200
  `) as unknown as Row[];
  return rows.map(mapDeparture);
}

/** Every departure on a site from `from` on, for the manage calendar. */
export async function listOrgDepartures(
  orgId: string,
  opts: { from?: Date; to?: Date; includeCancelled?: boolean } = {}
): Promise<(TourDeparture & { tourTitle: string; tourSlug: string })[]> {
  const from = opts.from ?? new Date(Date.now() - 24 * 3600_000);
  const rows = (await db`
    SELECT x.*, t.title AS tour_title, t.slug AS tour_slug FROM (${DEPARTURE_SELECT}) x
    JOIN threads t ON t.id = x.thread_id
    WHERE x.org_id = ${orgId} AND x.starts_at >= ${from.toISOString()}::timestamptz
      ${opts.to ? db`AND x.starts_at < ${opts.to.toISOString()}::timestamptz` : db``}
      ${opts.includeCancelled ? db`` : db`AND x.status = 'scheduled'`}
    ORDER BY x.starts_at
    LIMIT 500
  `) as unknown as Row[];
  return rows.map((r) => ({
    ...mapDeparture(r),
    tourTitle: r.tour_title as string,
    tourSlug: r.tour_slug as string,
  }));
}

export async function getDeparture(id: string): Promise<TourDeparture | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = (await db`${DEPARTURE_SELECT} WHERE d.id = ${id} LIMIT 1`) as unknown as Row[];
  return row ? mapDeparture(row) : null;
}

export interface DepartureInput {
  startsAt: Date;
  capacity: number;
  guideUserId?: string | null;
  note?: string | null;
}

function checkDeparture(input: DepartureInput): DepartureInput {
  if (Number.isNaN(input.startsAt.getTime())) throw new Error("The start time could not be read.");
  const capacity = Math.floor(Number(input.capacity));
  if (!(capacity > 0) || capacity > 500) throw new Error("Capacity must be between 1 and 500.");
  return {
    startsAt: input.startsAt,
    capacity,
    guideUserId: input.guideUserId && /^[0-9a-f-]{36}$/i.test(input.guideUserId) ? input.guideUserId : null,
    note: input.note?.trim().slice(0, 500) || null,
  };
}

export async function createDeparture(orgId: string, threadId: string, input: DepartureInput): Promise<TourDeparture> {
  const v = checkDeparture(input);
  const [owner] = (await db`
    SELECT id FROM threads WHERE id = ${threadId} AND org_id = ${orgId} AND kind = 'tour' LIMIT 1
  `) as unknown as Row[];
  if (!owner) throw new Error("That tour is not on this site.");
  const [row] = (await db`
    INSERT INTO tour_departures (thread_id, org_id, starts_at, capacity, guide_user_id, note)
    VALUES (${threadId}, ${orgId}, ${v.startsAt.toISOString()}::timestamptz, ${v.capacity}, ${v.guideUserId ?? null}, ${v.note ?? null})
    RETURNING id
  `) as unknown as Row[];
  return (await getDeparture(row!.id as string))!;
}

export async function updateDeparture(orgId: string, id: string, input: DepartureInput): Promise<TourDeparture> {
  const v = checkDeparture(input);
  const [row] = (await db`
    UPDATE tour_departures SET
      starts_at = ${v.startsAt.toISOString()}::timestamptz, capacity = ${v.capacity},
      guide_user_id = ${v.guideUserId ?? null}, note = ${v.note ?? null}, updated_at = NOW()
    WHERE id = ${id} AND org_id = ${orgId}
    RETURNING id
  `) as unknown as Row[];
  if (!row) throw new Error("That departure is not on this site.");
  return (await getDeparture(id))!;
}

/**
 * Cancel a run. Confirmed bookings on it are marked cancelled and the buyers
 * are told; refunds are issued by hand from the order (nothing automatic, as
 * with service bookings).
 */
export async function cancelDeparture(orgId: string, id: string, message?: string | null): Promise<{ notified: number }> {
  const note = message?.trim().slice(0, 1000) || null;
  const [row] = (await db`
    UPDATE tour_departures SET status = 'cancelled', updated_at = NOW()
    WHERE id = ${id} AND org_id = ${orgId} AND status = 'scheduled'
    RETURNING id
  `) as unknown as Row[];
  if (!row) throw new Error("That departure is not open.");
  const affected = (await db`
    UPDATE tour_bookings SET status = 'cancelled', updated_at = NOW()
    WHERE departure_id = ${id} AND org_id = ${orgId} AND status = 'confirmed'
    RETURNING id
  `) as unknown as Row[];
  let notified = 0;
  for (const b of affected) {
    const booking = await loadBooking(b.id as string);
    if (!booking) continue;
    await notify(booking.buyerEmail, `Cancelled: ${booking.tourTitle}`, [
      `We are sorry: the <strong>${esc(booking.tourTitle)}</strong> departure on ${esc(formatParis(booking.startsAt))} has been cancelled.`,
      note ? `A note from the guide: “${esc(note)}”` : "",
      `Reply to this email about a refund${booking.orderNumber ? ` (order ${esc(booking.orderNumber)})` : ""}.`,
    ], booking.orgId, booking.guideEmail);
    notified += 1;
  }
  return { notified };
}

// ── bookings ──────────────────────────────────────────────────────────────

const BOOKING_SELECT = db`
  SELECT b.*, o.number AS order_number, o.status AS order_status, o.total_minor, o.currency AS order_currency,
         t.title AS tour_title, t.slug AS tour_slug, t.duration_minutes, t.location AS meeting_point,
         d.starts_at,
         g.display_name AS guide_name, g.email AS guide_email
  FROM tour_bookings b
  JOIN commerce_order o ON o.id = b.order_id
  JOIN threads t ON t.id = b.thread_id
  JOIN tour_departures d ON d.id = b.departure_id
  LEFT JOIN users g ON g.id = COALESCE(d.guide_user_id, t.author_id)
`;

function mapBooking(r: Row): TourBooking & { token: string } {
  return {
    id: r.id as string,
    orderId: r.order_id as string,
    orderNumber: (r.order_number as string | null) ?? null,
    orderStatus: (r.order_status as string | null) ?? null,
    departureId: r.departure_id as string,
    threadId: r.thread_id as string,
    orgId: r.org_id as string,
    tourTitle: r.tour_title as string,
    tourSlug: r.tour_slug as string,
    startsAt: iso(r.starts_at)!,
    durationMinutes: num(r.duration_minutes),
    meetingPoint: (r.meeting_point as string | null) ?? null,
    guideName: (r.guide_name as string | null) ?? null,
    guideEmail: (r.guide_email as string | null) ?? null,
    buyerUserId: (r.buyer_user_id as string | null) ?? null,
    buyerEmail: r.buyer_email as string,
    buyerName: (r.buyer_name as string | null) ?? null,
    partySize: Number(r.party_size),
    totalMinor: Number(r.total_minor ?? 0),
    currency: (r.order_currency as string) ?? "EUR",
    status: r.status as TourBookingStatus,
    note: (r.note as string | null) ?? null,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
    token: r.buyer_token as string,
  };
}

function stripToken(b: TourBooking & { token: string }): TourBooking {
  const { token: _t, ...rest } = b;
  return rest;
}

async function loadBooking(id: string): Promise<(TourBooking & { token: string }) | null> {
  const [row] = (await db`${BOOKING_SELECT} WHERE b.id = ${id} LIMIT 1`) as unknown as Row[];
  return row ? mapBooking(row) : null;
}

export function parsePartySize(value: unknown): number | null {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1 || n > MAX_PARTY_SIZE) return null;
  return n;
}

/**
 * Can `partySize` people still book this departure? Checked once before the
 * order is created (so a full run never leaves an unpaid order behind) and
 * again, under a lock, when the booking row is written.
 */
export async function checkDepartureAvailability(
  departureId: string,
  partySize: number
): Promise<{ ok: true; departure: TourDeparture } | { ok: false; error: string }> {
  const d = await getDeparture(departureId);
  if (!d || d.status !== "scheduled") return { ok: false, error: "That departure is not open for booking." };
  if (new Date(d.startsAt).getTime() < Date.now()) return { ok: false, error: "That departure has already left." };
  if (d.seatsLeft < partySize) {
    return {
      ok: false,
      error: d.seatsLeft === 0 ? "That departure is full." : `Only ${d.seatsLeft} place${d.seatsLeft === 1 ? "" : "s"} left on that departure.`,
    };
  }
  return { ok: true, departure: d };
}

export interface CreateTourBookingInput {
  orderId: string;
  departureId: string;
  partySize: number;
  note?: string | null;
}

/**
 * Attach the departure and party size to a card order just created for a
 * tour (before the buyer pays). The departure must belong to the order's
 * tour; seats are re-checked with the departure row locked.
 */
export async function createTourBooking(input: CreateTourBookingInput): Promise<{ id: string }> {
  const partySize = parsePartySize(input.partySize);
  if (!partySize) throw new Error("Party size must be between 1 and " + MAX_PARTY_SIZE + ".");
  return db.begin(async (tx) => {
    const [line] = (await tx`
      SELECT o.id AS order_id, o.customer_id, o.customer_email, o.customer_name, l.quantity,
             l.thread_id, t.org_id
      FROM commerce_order o
      JOIN commerce_order_line l ON l.order_id = o.id AND l.thread_id IS NOT NULL
      JOIN threads t ON t.id = l.thread_id AND t.kind = 'tour'
      WHERE o.id = ${input.orderId}
      LIMIT 1
    `) as unknown as Row[];
    if (!line) throw new Error("That order is not a tour booking.");
    if (Number(line.quantity) !== partySize) throw new Error("The order and the party size disagree.");

    // Lock the departure so two buyers cannot both read "2 left" and both take them.
    const [dep] = (await tx`
      SELECT id, capacity, status, starts_at FROM tour_departures
      WHERE id = ${input.departureId} AND thread_id = ${line.thread_id as string}
      FOR UPDATE
    `) as unknown as Row[];
    if (!dep || dep.status !== "scheduled") throw new Error("That departure is not open for booking.");
    if (new Date(dep.starts_at as string).getTime() < Date.now()) throw new Error("That departure has already left.");
    const [taken] = (await tx`
      SELECT COALESCE(SUM(party_size), 0) AS taken FROM tour_bookings
      WHERE departure_id = ${input.departureId}
        AND (status = 'confirmed'
             OR (status = 'awaiting_payment' AND created_at > NOW() - (${HOLD_MINUTES} || ' minutes')::interval))
    `) as unknown as Row[];
    const left = Number(dep.capacity) - Number(taken?.taken ?? 0);
    if (left < partySize) throw new Error(left <= 0 ? "That departure is full." : `Only ${left} place${left === 1 ? "" : "s"} left on that departure.`);

    const token = randomBytes(24).toString("base64url");
    const [row] = (await tx`
      INSERT INTO tour_bookings (
        order_id, departure_id, thread_id, org_id, buyer_user_id, buyer_email, buyer_name,
        party_size, status, note, buyer_token
      ) VALUES (
        ${input.orderId}, ${input.departureId}, ${line.thread_id as string}, ${line.org_id as string},
        ${(line.customer_id as string | null) ?? null}, ${line.customer_email as string},
        ${(line.customer_name as string | null) ?? null},
        ${partySize}, 'awaiting_payment', ${input.note?.trim().slice(0, 1000) || null}, ${token}
      )
      ON CONFLICT (order_id) DO NOTHING
      RETURNING id
    `) as unknown as Row[];
    if (!row) throw new Error("This order already has a booking.");
    return { id: row.id as string };
  });
}

/**
 * The order behind a booking was paid: confirm the seats and tell both
 * sides. Idempotent (only the first call finds `awaiting_payment`). Called by
 * confirmOrderPaid after its transaction commits.
 */
export async function markTourBookingPaid(orderId: string): Promise<void> {
  const [row] = (await db`
    UPDATE tour_bookings SET status = 'confirmed', updated_at = NOW()
    WHERE order_id = ${orderId} AND status = 'awaiting_payment'
    RETURNING id
  `) as unknown as Row[];
  if (!row) return;
  const b = await loadBooking(row.id as string);
  if (!b) return;
  const when = formatParis(b.startsAt);
  const people = `${b.partySize} ${b.partySize === 1 ? "person" : "people"}`;
  await Promise.all([
    notify(b.buyerEmail, `Booked: ${b.tourTitle}`, [
      `Thank you — your place${b.partySize === 1 ? " is" : "s are"} confirmed on <strong>${esc(b.tourTitle)}</strong>.`,
      `<strong>${esc(when)}</strong> · ${people}`,
      b.meetingPoint ? `Meeting point: ${esc(b.meetingPoint)}` : "",
      b.guideName ? `Your guide: ${esc(b.guideName)}` : "",
      button(`${buyerBookingUrl(b.token)}`, "See your booking"),
      `Add it to your calendar: <a href="${esc(buyerBookingUrl(b.token))}/calendar.ics">calendar file</a>.`,
    ], b.orgId, b.guideEmail),
    notify(b.guideEmail, `New booking: ${b.tourTitle} · ${when}`, [
      `${esc(b.buyerName ?? b.buyerEmail)} booked and paid for <strong>${people}</strong> on <strong>${esc(b.tourTitle)}</strong>, ${esc(when)}.`,
      b.note ? `Their note: “${esc(b.note)}”` : "",
      `Reply to this email to reach them.`,
    ], b.orgId, b.buyerEmail),
  ]);
}

/** One booking by its buyer link. Unpaid bookings are not shown. */
export async function getTourBookingByToken(token: string): Promise<BuyerTourBooking | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const [row] = (await db`
    ${BOOKING_SELECT} WHERE b.buyer_token = ${token} AND b.status <> 'awaiting_payment' LIMIT 1
  `) as unknown as Row[];
  if (!row) return null;
  const { guideEmail: _g, buyerUserId: _u, token: _t, ...rest } = mapBooking(row);
  return rest;
}

/** The buyer's token for an order they just paid — for the return hop to hand them their page. */
export async function getTourBookingTokenForOrder(orderId: string): Promise<string | null> {
  const [row] = (await db`
    SELECT buyer_token FROM tour_bookings WHERE order_id = ${orderId} AND status <> 'awaiting_payment' LIMIT 1
  `) as unknown as Row[];
  return (row?.buyer_token as string | undefined) ?? null;
}

/** A signed-in person's own bookings, paid ones, next first. */
export async function listBuyerTourBookings(userId: string): Promise<BuyerTourBooking[]> {
  const rows = (await db`
    ${BOOKING_SELECT} WHERE b.buyer_user_id = ${userId} AND b.status <> 'awaiting_payment'
    ORDER BY d.starts_at DESC LIMIT 100
  `) as unknown as Row[];
  return rows.map((r) => {
    const { guideEmail: _g, buyerUserId: _u, token: _t, ...rest } = mapBooking(r);
    return rest;
  });
}

/** The manifest for one departure: who is coming. Org-scoped. */
export async function listDepartureBookings(orgId: string, departureId: string): Promise<TourBooking[]> {
  const rows = (await db`
    ${BOOKING_SELECT}
    WHERE b.departure_id = ${departureId} AND b.org_id = ${orgId} AND b.status <> 'awaiting_payment'
    ORDER BY b.status = 'confirmed' DESC, b.created_at
  `) as unknown as Row[];
  return rows.map((r) => stripToken(mapBooking(r)));
}

/** Recent bookings across the site, for the manage overview. */
export async function listOrgTourBookings(orgId: string, limit = 100): Promise<TourBooking[]> {
  const rows = (await db`
    ${BOOKING_SELECT}
    WHERE b.org_id = ${orgId} AND b.status <> 'awaiting_payment'
    ORDER BY b.created_at DESC LIMIT ${limit}
  `) as unknown as Row[];
  return rows.map((r) => stripToken(mapBooking(r)));
}

/** Cancel one booking (org editor). The buyer is told; any refund is issued from the order. */
export async function cancelTourBooking(orgId: string, bookingId: string, message?: string | null): Promise<void> {
  const note = message?.trim().slice(0, 1000) || null;
  const [row] = (await db`
    UPDATE tour_bookings SET status = 'cancelled', updated_at = NOW()
    WHERE id = ${bookingId} AND org_id = ${orgId} AND status = 'confirmed'
    RETURNING id
  `) as unknown as Row[];
  if (!row) throw new Error("That booking is not confirmed.");
  const b = await loadBooking(bookingId);
  if (!b) return;
  await notify(b.buyerEmail, `Cancelled: ${b.tourTitle}`, [
    `Your booking of <strong>${esc(b.tourTitle)}</strong> on ${esc(formatParis(b.startsAt))} has been cancelled.`,
    note ? `A note from the guide: “${esc(note)}”` : "",
    `Reply to this email about a refund${b.orderNumber ? ` (order ${esc(b.orderNumber)})` : ""}.`,
  ], b.orgId, b.guideEmail);
}

// ── calendar file ─────────────────────────────────────────────────────────

export function tourBookingIcs(b: Pick<BuyerTourBooking, "id" | "tourTitle" | "startsAt" | "durationMinutes" | "meetingPoint" | "partySize">): string {
  const start = new Date(b.startsAt);
  const end = new Date(start.getTime() + (b.durationMinutes ?? 120) * 60_000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const text = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => `\\${m}`).replace(/\r?\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Elkdonis Arts Collective//Tours//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:tour-booking-${b.id}@arts-collective.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${text(b.tourTitle)}`,
    ...(b.meetingPoint ? [`LOCATION:${text(b.meetingPoint)}`] : []),
    `DESCRIPTION:${text(`${b.partySize} ${b.partySize === 1 ? "person" : "people"}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

// ── urls and email ────────────────────────────────────────────────────────

/**
 * The buyer's page lives on the selling site, not the network hub (unlike
 * service bookings): a tour company's customers never meet the collective.
 */
function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
}

export function buyerBookingUrl(token: string): string {
  return `${siteUrl()}/bookings/${token}`;
}

export function formatParis(isoString: string, timeZone = "Europe/Paris"): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(isoString));
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function button(href: string, label: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;padding:10px 18px;background:#1f1f1f;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600">${esc(label)}</a>`;
}

async function notify(
  to: string | null,
  subject: string,
  paragraphs: string[],
  orgId: string,
  replyTo: string | null
): Promise<void> {
  if (!to) return;
  try {
    const { sendEmail } = await import("@elkdonis/email");
    const html = `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#1f1f1f">${paragraphs
      .filter(Boolean)
      .map((p) => `<p>${p}</p>`)
      .join("")}</div>`;
    await sendEmail({ to, subject, html, orgId, kind: "order", ...(replyTo ? { replyTo } : {}) });
  } catch (err) {
    console.error(`[commerce] tour email "${subject}" failed:`, err);
  }
}

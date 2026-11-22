import { db } from "@elkdonis/db";
import { getTourBookingByToken, getTourBookingTokenForOrder, tourBookingIcs } from "@elkdonis/commerce/server";
import { siteConfig } from "@/config/site";

/**
 * One lookup for the buyer's booking page, its calendar file and the Stripe
 * return hop, across the two stores during the cutover
 * (docs/open/ELKTOURS_MOBILE_2026-11-15/CUTOVER.md):
 *
 *   1. `bookings` (the booking tables, set_dates offers), by `buyer_token`
 *   2. `tour_bookings` (the old table), by its token
 *
 * The backfill keeps every token, so a link in an old email resolves in
 * either store. Both return the same shape, the one the page already reads
 * (`BuyerTourBooking` of @elkdonis/commerce, minus what the page never uses),
 * so switching the page is a rename. Server only.
 *
 * Reads only the columns that exist today (migration 265), so it works before
 * the per-slot migration; it finds nothing in `bookings` until set_dates
 * bookings exist, and then falls back.
 */

const ORG = siteConfig.orgId;
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

export interface BuyerBookingView {
  /** Where it was read: the booking tables or the old tour_bookings. */
  source: "bookings" | "tour_bookings";
  id: string;
  orderId: string | null;
  orderNumber: string | null;
  tourTitle: string;
  tourSlug: string;
  startsAt: string;
  durationMinutes: number | null;
  meetingPoint: string | null;
  guideName: string | null;
  buyerName: string | null;
  buyerEmail: string;
  partySize: number;
  totalMinor: number;
  currency: string;
  /** Unpaid holds are never shown; anything finished or cancelled reads as cancelled except confirmed/completed. */
  status: "confirmed" | "cancelled";
  note: string | null;
}

const iso = (v: unknown): string => new Date(v as string).toISOString();

async function fromBookings(token: string): Promise<BuyerBookingView | null> {
  const rows = (await db`
    SELECT b.id, b.status, b.party_size, b.scheduled_at, b.duration_minutes, b.notes, b.booker_name, b.booker_email, b.order_id,
           t.title, t.slug, t.location, t.duration_minutes AS thread_duration,
           COALESCE(g.display_name, h.display_name, au.display_name) AS guide_name,
           co.number AS order_number, co.total_minor, co.currency
    FROM bookings b
    JOIN booking_offers o ON o.id = b.offer_id AND o.mode = 'set_dates'
    JOIN threads t ON t.id = b.thread_id
    LEFT JOIN booking_slots s ON s.id = b.slot_id
    LEFT JOIN users g ON g.id = s.guide_user_id
    LEFT JOIN users h ON h.id = o.host_user_id
    LEFT JOIN users au ON au.id = t.author_id
    LEFT JOIN commerce_order co ON co.id = b.order_id
    WHERE b.buyer_token = ${token} AND b.org_id = ${ORG}
      AND b.status IN ('confirmed', 'completed', 'no_show', 'cancelled')
      AND b.scheduled_at IS NOT NULL
    LIMIT 1
  `) as unknown as Record<string, unknown>[];
  const r = rows[0];
  if (!r) return null;
  const confirmed = r.status === "confirmed" || r.status === "completed" || r.status === "no_show";
  return {
    source: "bookings",
    id: r.id as string,
    orderId: (r.order_id as string | null) ?? null,
    orderNumber: (r.order_number as string | null) ?? null,
    tourTitle: r.title as string,
    tourSlug: r.slug as string,
    startsAt: iso(r.scheduled_at),
    durationMinutes: r.duration_minutes != null ? Number(r.duration_minutes) : r.thread_duration != null ? Number(r.thread_duration) : null,
    meetingPoint: (r.location as string | null) ?? null,
    guideName: (r.guide_name as string | null) ?? null,
    buyerName: (r.booker_name as string | null) ?? null,
    buyerEmail: r.booker_email as string,
    partySize: Number(r.party_size),
    totalMinor: Number(r.total_minor ?? 0),
    currency: (r.currency as string | null) ?? siteConfig.currency,
    status: confirmed ? "confirmed" : "cancelled",
    note: (r.notes as string | null) ?? null,
  };
}

/** The buyer's booking by its private link, from either store. Null when unknown or unpaid. */
export async function getBookingByAnyToken(token: string): Promise<BuyerBookingView | null> {
  if (!TOKEN.test(token)) return null;
  try {
    const fresh = await fromBookings(token);
    if (fresh) return fresh;
  } catch (err) {
    console.error("[elktours] getBookingByAnyToken (bookings):", err);
  }
  const old = await getTourBookingByToken(token).catch(() => null);
  if (!old) return null;
  return {
    source: "tour_bookings",
    id: old.id,
    orderId: old.orderId,
    orderNumber: old.orderNumber,
    tourTitle: old.tourTitle,
    tourSlug: old.tourSlug,
    startsAt: old.startsAt,
    durationMinutes: old.durationMinutes,
    meetingPoint: old.meetingPoint,
    guideName: old.guideName,
    buyerName: old.buyerName,
    buyerEmail: old.buyerEmail,
    partySize: old.partySize,
    totalMinor: old.totalMinor,
    currency: old.currency,
    status: old.status === "confirmed" ? "confirmed" : "cancelled",
    note: old.note,
  };
}

/**
 * A booking whose card session is open or whose payment has not settled yet
 * (`held` / `awaiting_payment`, also `expired` with an order, since a late
 * payment revives it in markBookingPaid). The buyer page shows "payment being
 * confirmed" for it instead of a 404: Stripe sends the buyer back before an
 * asynchronous method (Bancontact, EPS, …) has settled. Booking tables only.
 */
export interface PendingBookingView {
  orderId: string | null;
  tourTitle: string;
  tourSlug: string;
  startsAt: string;
  partySize: number;
}

export async function getPendingBookingByToken(token: string): Promise<PendingBookingView | null> {
  if (!TOKEN.test(token)) return null;
  try {
    const rows = (await db`
      SELECT b.order_id, b.party_size, COALESCE(b.scheduled_at, s.starts_at) AS starts_at, t.title, t.slug
      FROM bookings b
      JOIN threads t ON t.id = b.thread_id
      LEFT JOIN booking_slots s ON s.id = b.slot_id
      WHERE b.buyer_token = ${token} AND b.org_id = ${ORG}
        AND (b.status IN ('held', 'awaiting_payment') OR (b.status = 'expired' AND b.order_id IS NOT NULL))
      LIMIT 1
    `) as unknown as Record<string, unknown>[];
    const r = rows[0];
    if (!r || r.starts_at == null) return null;
    return {
      orderId: (r.order_id as string | null) ?? null,
      tourTitle: r.title as string,
      tourSlug: r.slug as string,
      startsAt: iso(r.starts_at),
      partySize: Number(r.party_size),
    };
  } catch (err) {
    console.error("[elktours] getPendingBookingByToken:", err);
    return null;
  }
}

/** The buyer's token for an order they just paid, from either store (the Stripe return hop). */
export async function getBookingTokenForAnyOrder(orderId: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  try {
    const rows = (await db`
      SELECT buyer_token FROM bookings
      WHERE order_id = ${orderId} AND org_id = ${ORG} AND status NOT IN ('held', 'awaiting_payment', 'expired')
      LIMIT 1
    `) as unknown as Array<{ buyer_token: string }>;
    if (rows[0]) return rows[0].buyer_token;
  } catch (err) {
    console.error("[elktours] getBookingTokenForAnyOrder (bookings):", err);
  }
  return getTourBookingTokenForOrder(orderId).catch(() => null);
}

/** The calendar file for a booking view (the same file `tourBookingIcs` makes). */
export function buyerBookingIcs(b: BuyerBookingView): string {
  return tourBookingIcs({
    id: b.id,
    tourTitle: b.tourTitle,
    startsAt: b.startsAt,
    durationMinutes: b.durationMinutes,
    meetingPoint: b.meetingPoint,
    partySize: b.partySize,
  });
}

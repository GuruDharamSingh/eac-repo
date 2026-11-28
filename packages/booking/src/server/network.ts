/**
 * Network-sold services: a service sold through the content library's
 * checkout (seller of record `oad`, any thread org) gets a booking in this
 * module's own tables, so it shows in ArtDirect's bookings (buyer by token,
 * host on /bookings) like every other booking. 2026-11-27.
 *
 * The thread has no open `booking_offers` row (the checkout refuses a
 * service that is booked at a time), so the booking hangs on a stub offer:
 * mode `request_time`, status `closed` (hidden from visitors and from
 * `getPublicBookingOffer`), owned by the thread's org with the thread's
 * author as host. A later `saveOffer` by the author upgrades the same row.
 *
 * Lifecycle (no new payment hook):
 *   recordNetworkBooking   awaiting_payment, hold for the offer's hold_minutes,
 *                          linked to the order (called right after the order)
 *   markBookingPaid        existing hook in commerce confirmOrderPaid:
 *                          awaiting_payment -> awaiting_seller (request_time)
 *   host/booker scheduler  the module's own propose / confirm exchange
 *   expireBookingForOrder  existing hook in cancelOrder; releaseBooking if the
 *                          card session could not be opened
 * The booking row is the record of the time to agree; prices, splits and
 * refunds stay with the order.
 */

import { randomBytes } from "node:crypto";
import { db } from "@elkdonis/db";
import type { ActResult, BookingStatus } from "../core/types";
import { getOfferById } from "./offers";
import { parseProposedTimes } from "./bookings";

type Row = Record<string, unknown>;
type Tx = typeof db;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RecordNetworkBookingInput {
  threadId: string;
  /** The card order just made for this sale (one booking per order). */
  orderId: string;
  buyer: { name?: string | null; email: string; userId?: string | null; timeZone?: string | null };
  /** Optional: up to three proposed starts (ISO), as request_time takes them. */
  requestedTimes?: unknown;
  notes?: string | null;
  /** Public base of the site that serves /bookings (ArtDirect), used in mail links. */
  siteUrl?: string | null;
  now?: Date;
  /** Run inside the caller's transaction (tests roll it back); otherwise one is opened. */
  tx?: Tx;
}

export type RecordNetworkBookingResult = ActResult<{
  bookingId: string;
  token: string;
  status: BookingStatus;
  holdExpiresAt: string | null;
  /** True when a booking for this order already existed (retry). */
  existing: boolean;
}>;

function cleanText(v: unknown, max: number): string | null {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s || null;
}

function validZone(tz: unknown, fallback: string): string {
  if (typeof tz !== "string" || !tz) return fallback;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return tz;
  } catch {
    return fallback;
  }
}

export async function recordNetworkBooking(input: RecordNetworkBookingInput): Promise<RecordNetworkBookingResult> {
  const email = (input.buyer.email ?? "").trim();
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email address." };
  const now = input.now ?? new Date();

  const run = async (tx: Tx): Promise<RecordNetworkBookingResult> => {
    const threads = (await tx`
      SELECT id, org_id, kind, status, author_id FROM threads WHERE id = ${input.threadId} LIMIT 1
    `) as unknown as Row[];
    const t = threads[0];
    if (!t || t.kind !== "service" || t.status !== "published") return { ok: false, error: "This is not open for booking." };
    const orgId = t.org_id as string;

    const prior = (await tx`
      SELECT id, buyer_token, status, hold_expires_at FROM bookings WHERE order_id = ${input.orderId} LIMIT 1
    `) as unknown as Row[];
    if (prior[0]) {
      return {
        ok: true,
        bookingId: prior[0].id as string,
        token: prior[0].buyer_token as string,
        status: prior[0].status as BookingStatus,
        holdExpiresAt: prior[0].hold_expires_at ? new Date(prior[0].hold_expires_at as string).toISOString() : null,
        existing: true,
      };
    }

    // The thread's offer, or a closed request_time stub (the author's later saveOffer replaces its settings).
    await tx`
      INSERT INTO booking_offers (org_id, thread_id, host_user_id, mode, status)
      VALUES (${orgId}, ${input.threadId}, ${(t.author_id as string | null) ?? null}, 'request_time', 'closed')
      ON CONFLICT (thread_id) DO NOTHING
    `;
    const offerRow = (await tx`SELECT id FROM booking_offers WHERE thread_id = ${input.threadId} LIMIT 1`) as unknown as Row[];
    const offer = offerRow[0] ? await getOfferById(orgId, offerRow[0].id as string, tx) : null;
    if (!offer) return { ok: false, error: "This is not open for booking." };

    let proposed: Date[] = [];
    if (input.requestedTimes != null && !(Array.isArray(input.requestedTimes) && input.requestedTimes.length === 0)) {
      const parsed = parseProposedTimes(input.requestedTimes, offer, now);
      if (parsed.ok === false) return parsed;
      proposed = parsed.times;
    }

    const token = randomBytes(24).toString("base64url");
    const holdExpires = new Date(now.getTime() + offer.holdMinutes * 60000);
    const notes = cleanText(input.notes, 2000);
    const rows = (await tx`
      INSERT INTO bookings (
        org_id, offer_id, thread_id, booker_user_id, booker_email, booker_name, booker_time_zone,
        party_size, status, source, order_id, hold_expires_at, proposed_by, proposed_times,
        last_message, last_message_by, duration_minutes, notes, answers, buyer_token, site_url
      ) VALUES (
        ${orgId}, ${offer.id}, ${input.threadId}, ${input.buyer.userId ?? null}, ${email}, ${cleanText(input.buyer.name, 200)},
        ${validZone(input.buyer.timeZone, offer.timeZone)}, 1, 'awaiting_payment', 'web', ${input.orderId}, ${holdExpires},
        ${proposed.length ? "booker" : null}, ${proposed.map((d) => d.toISOString())}::timestamptz[],
        ${notes}, ${notes ? "booker" : null}, ${offer.durationMinutes}, ${notes}, ${tx.json({})}, ${token},
        ${cleanText(input.siteUrl, 300)}
      )
      RETURNING id
    `) as unknown as Row[];
    return { ok: true, bookingId: rows[0]!.id as string, token, status: "awaiting_payment", holdExpiresAt: holdExpires.toISOString(), existing: false };
  };

  try {
    if (input.tx) return await run(input.tx);
    return await db.begin(async (tx) => run(tx as unknown as Tx));
  } catch (err) {
    console.error("[booking] recordNetworkBooking:", err);
    return { ok: false, error: "Could not make the booking. Try again." };
  }
}

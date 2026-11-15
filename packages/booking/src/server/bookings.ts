/**
 * Bookings: taking a time from open hours, or asking for one, and what each
 * side does next (design §2.2-2.3; migration 265).
 *
 *   open_hours, instant         free → confirmed; paid → awaiting_payment
 *                               (seat held until hold_expires_at) → confirmed
 *                               by markBookingPaid
 *   open_hours, seller_confirms as above, but → awaiting_seller; the host
 *                               confirms the time or proposes others
 *   request_time                the booker proposes 1-3 times (paid: after
 *                               payment) → awaiting_seller ⇄ awaiting_booker
 *                               → confirmed, as migration 174 did
 *
 * Seats are taken under a lock: a transaction-scoped advisory lock on the
 * host (so two offerings of one person cannot be booked into the same hour),
 * then the slot row, created on first booking and locked FOR UPDATE. Seats
 * taken are counted, never stored: confirmed and waiting rows plus holds
 * that have not expired.
 *
 * Access: host functions take the host's user id from the session and match
 * `booking_offers.host_user_id`, always with the org; booker functions take
 * the private token. Mail is sent after commit and never undoes a change.
 * Refunds are not issued here (decision 4): a cancellation records
 * `refund_status = 'due'` and the amount.
 */

import { randomBytes } from "node:crypto";
import { db } from "@elkdonis/db";
import type { ActResult, Booking, BookerBooking, BookingOffer, BookingStatus, OpenSlot, Party } from "../core/types";
import { computeOpenSlots, slotKey, type BusyInterval } from "../core/open-hours";
import { zonedParts } from "../core/time";
import { cleanAnswers } from "../core/validate";
import { refundShare, describePolicy } from "../core/policy";
import { getOfferById } from "./offers";
import { bookerUrl, button, esc, hostUrl, notify, timesList, when } from "./notify";

type Row = Record<string, unknown>;
type Tx = typeof db;

export const MAX_PROPOSED_TIMES = 3;
const PAID_ORDER = ["paid", "fulfilled", "completed"];

const iso = (v: unknown): string | null => (v == null ? null : new Date(v as string).toISOString());
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

function cleanText(v: unknown, max = 1000): string | null {
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

// ── seats and busy time ───────────────────────────────────────────────────

/**
 * The host's booked time around a window, plus seats taken on this offer's
 * slot rows. A booking counts while confirmed or waiting for an answer, or
 * while its hold has not expired.
 */
async function loadTaken(
  tx: Tx,
  offer: Pick<BookingOffer, "id" | "hostUserId">,
  fromMs: number,
  toMs: number
): Promise<{ busy: BusyInterval[]; taken: Map<number, number>; cancelled: Set<number> }> {
  const from = new Date(fromMs - 86400000);
  const to = new Date(toMs + 86400000);
  const rows = (await tx`
    SELECT b.offer_id, b.slot_id, b.scheduled_at, b.party_size,
           COALESCE(b.duration_minutes, o.duration_minutes, 60) AS duration,
           o.buffer_minutes
    FROM bookings b
    JOIN booking_offers o ON o.id = b.offer_id
    WHERE (o.host_user_id = ${offer.hostUserId} OR b.offer_id = ${offer.id})
      AND b.scheduled_at IS NOT NULL
      AND b.scheduled_at >= ${from} AND b.scheduled_at < ${to}
      AND (
        b.status IN ('confirmed', 'requested', 'awaiting_seller', 'awaiting_booker')
        OR (b.status IN ('held', 'awaiting_payment') AND b.hold_expires_at > now())
      )
  `) as unknown as Row[];
  const busy: BusyInterval[] = [];
  const taken = new Map<number, number>();
  for (const r of rows) {
    const startMs = new Date(r.scheduled_at as string).getTime();
    const endMs = startMs + (Number(r.duration) + Number(r.buffer_minutes ?? 0)) * 60000;
    const onThisSlot = r.offer_id === offer.id && r.slot_id != null;
    busy.push({ startMs, endMs, slotKey: onThisSlot ? slotKey(offer.id, startMs) : null });
    if (onThisSlot) taken.set(startMs, (taken.get(startMs) ?? 0) + Number(r.party_size ?? 1));
  }
  const cancelledRows = (await tx`
    SELECT starts_at FROM booking_slots
    WHERE offer_id = ${offer.id} AND status = 'cancelled'
      AND starts_at >= ${from} AND starts_at < ${to}
  `) as unknown as Row[];
  return { busy, taken, cancelled: new Set(cancelledRows.map((r) => new Date(r.starts_at as string).getTime())) };
}

/**
 * Bookable times of an open-hours offer of `orgId`. `fromDate` is a local
 * day in the offer's zone; `days` defaults to the whole booking window.
 */
export async function listOpenSlots(
  orgId: string,
  offerId: string,
  opts: { fromDate?: string; days?: number; partySize?: number; now?: Date } = {}
): Promise<{ offer: BookingOffer; slots: OpenSlot[] } | null> {
  const offer = await getOfferById(orgId, offerId);
  if (!offer) return null;
  if (offer.mode !== "open_hours" || offer.status !== "open") return { offer, slots: [] };
  const now = opts.now ?? new Date();
  const { busy, taken, cancelled } = await loadTaken(db, offer, now.getTime(), now.getTime() + offer.maxAheadDays * 86400000);
  const slots = computeOpenSlots({ offer, busy, taken, cancelled, now, fromDate: opts.fromDate, days: opts.days, partySize: opts.partySize });
  return { offer, slots };
}

async function lockHost(tx: Tx, offer: Pick<BookingOffer, "id" | "hostUserId">): Promise<void> {
  const key = `booking-host:${offer.hostUserId ?? offer.id}`;
  await tx`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

// ── validation of proposed times ──────────────────────────────────────────

/**
 * Proposed start times (ISO strings; the browser converts its wall clock):
 * 1 to MAX_PROPOSED_TIMES distinct times, each at least the offer's notice
 * ahead (at least an hour) and inside its booking window.
 */
export function parseProposedTimes(
  values: unknown,
  offer: Pick<BookingOffer, "leadTimeMinutes" | "maxAheadDays">,
  now: Date = new Date()
): { ok: true; times: Date[] } | { ok: false; error: string } {
  const list = (Array.isArray(values) ? values : [])
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .map((v) => new Date(v));
  if (list.length === 0) return { ok: false, error: "Suggest at least one time." };
  if (list.length > MAX_PROPOSED_TIMES) return { ok: false, error: `Suggest at most ${MAX_PROPOSED_TIMES} times.` };
  if (list.some((d) => Number.isNaN(d.getTime()))) return { ok: false, error: "One of the times could not be read." };
  const leadMinutes = Math.max(60, offer.leadTimeMinutes);
  if (list.some((d) => d.getTime() < now.getTime() + leadMinutes * 60000)) {
    const span = leadMinutes >= 1440 ? `${Math.round(leadMinutes / 1440)} day(s)` : `${Math.round(leadMinutes / 60)} hour(s)`;
    return { ok: false, error: `Each time needs to be at least ${span} from now.` };
  }
  if (list.some((d) => d.getTime() > now.getTime() + offer.maxAheadDays * 86400000)) {
    return { ok: false, error: `Each time needs to be within the next ${offer.maxAheadDays} days.` };
  }
  const unique = [...new Map(list.map((d) => [d.getTime(), d])).values()].sort((a, b) => a.getTime() - b.getTime());
  return { ok: true, times: unique };
}

// ── reads ─────────────────────────────────────────────────────────────────

interface FullBooking extends Booking {
  token: string;
  hostEmail: string | null;
  mode: BookingOffer["mode"];
  approval: BookingOffer["approval"];
  cancelFreeUntilMinutes: number | null;
  cancelRefundPercentAfter: number | null;
  orderTotalMinor: number | null;
}

const SELECT = db`
  SELECT b.*, t.title AS thread_title, t.slug AS thread_slug,
         o.host_user_id, o.time_zone AS offer_time_zone, o.duration_minutes AS offer_duration,
         o.mode, o.approval, o.cancel_policy_text, o.cancel_free_until_minutes, o.cancel_refund_percent_after,
         h.display_name AS host_name, h.email AS host_email,
         co.number AS order_number, co.status AS order_status, co.total_minor AS order_total_minor, co.currency AS order_currency
  FROM bookings b
  JOIN booking_offers o ON o.id = b.offer_id
  JOIN threads t ON t.id = b.thread_id
  LEFT JOIN users h ON h.id = o.host_user_id
  LEFT JOIN commerce_order co ON co.id = b.order_id
`;

function mapBooking(r: Row): FullBooking {
  const timeZone = (r.offer_time_zone as string) || "America/Toronto";
  return {
    id: r.id as string,
    orgId: r.org_id as string,
    offerId: r.offer_id as string,
    slotId: (r.slot_id as string | null) ?? null,
    threadId: r.thread_id as string,
    threadTitle: (r.thread_title as string) ?? "",
    threadSlug: (r.thread_slug as string | null) ?? null,
    hostUserId: (r.host_user_id as string | null) ?? null,
    hostName: (r.host_name as string | null) ?? null,
    hostEmail: (r.host_email as string | null) ?? null,
    bookerUserId: (r.booker_user_id as string | null) ?? null,
    bookerEmail: r.booker_email as string,
    bookerName: (r.booker_name as string | null) ?? null,
    bookerTimeZone: (r.booker_time_zone as string | null) ?? null,
    partySize: Number(r.party_size ?? 1),
    status: r.status as BookingStatus,
    orderId: (r.order_id as string | null) ?? null,
    orderNumber: (r.order_number as string | null) ?? null,
    orderStatus: (r.order_status as string | null) ?? null,
    orderTotalMinor: r.order_total_minor == null ? null : Number(r.order_total_minor),
    currency: (r.order_currency as string | null) ?? null,
    holdExpiresAt: iso(r.hold_expires_at),
    proposedBy: (r.proposed_by as Party | null) ?? null,
    proposedTimes: Array.isArray(r.proposed_times) ? (r.proposed_times as unknown[]).map((t) => iso(t)!).filter(Boolean) : [],
    lastMessage: (r.last_message as string | null) ?? null,
    lastMessageBy: (r.last_message_by as Party | null) ?? null,
    scheduledAt: iso(r.scheduled_at),
    durationMinutes: r.duration_minutes != null ? Number(r.duration_minutes) : r.offer_duration != null ? Number(r.offer_duration) : null,
    notes: (r.notes as string | null) ?? null,
    answers: (r.answers && typeof r.answers === "object" ? r.answers : {}) as Record<string, string>,
    timeZone,
    mode: r.mode as BookingOffer["mode"],
    approval: r.approval as BookingOffer["approval"],
    cancelPolicyText: describePolicy({
      cancelPolicyText: (r.cancel_policy_text as string | null) ?? null,
      cancelFreeUntilMinutes: r.cancel_free_until_minutes == null ? null : Number(r.cancel_free_until_minutes),
      cancelRefundPercentAfter: r.cancel_refund_percent_after == null ? null : Number(r.cancel_refund_percent_after),
    }),
    cancelFreeUntilMinutes: r.cancel_free_until_minutes == null ? null : Number(r.cancel_free_until_minutes),
    cancelRefundPercentAfter: r.cancel_refund_percent_after == null ? null : Number(r.cancel_refund_percent_after),
    confirmedAt: iso(r.confirmed_at),
    cancelledAt: iso(r.cancelled_at),
    cancelledBy: (r.cancelled_by as Booking["cancelledBy"]) ?? null,
    cancelReason: (r.cancel_reason as string | null) ?? null,
    refundStatus: (r.refund_status as Booking["refundStatus"]) ?? "none",
    refundDueMinor: r.refund_due_minor == null ? null : Number(r.refund_due_minor),
    siteUrl: (r.site_url as string | null) ?? null,
    token: r.buyer_token as string,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

function publicView(b: FullBooking): Booking {
  const { token: _t, hostEmail: _h, mode: _m, approval: _a, cancelFreeUntilMinutes: _f, cancelRefundPercentAfter: _p, orderTotalMinor: _o, ...rest } = b;
  return rest;
}

async function loadById(id: string): Promise<FullBooking | null> {
  const rows = (await db`${SELECT} WHERE b.id = ${id} LIMIT 1`) as unknown as Row[];
  return rows[0] ? mapBooking(rows[0]) : null;
}

/** The host's bookings in `orgId`, newest activity first. Lapsed holds are swept first. */
export async function listHostBookings(
  orgId: string,
  hostUserId: string,
  opts: { includePast?: boolean; limit?: number } = {}
): Promise<Booking[]> {
  await expireLapsedHolds().catch((err) => console.error("[booking] expireLapsedHolds:", err));
  const limit = Math.min(opts.limit ?? 100, 500);
  const rows = (await db`
    ${SELECT}
    WHERE b.org_id = ${orgId} AND o.host_user_id = ${hostUserId}
      AND b.status <> 'expired'
      AND (${opts.includePast ?? false} OR b.scheduled_at IS NULL OR b.scheduled_at > now() - interval '1 day')
    ORDER BY COALESCE(b.scheduled_at, b.created_at) ASC
    LIMIT ${limit}
  `) as unknown as Row[];
  return rows.map((r) => publicView(mapBooking(r)));
}

export async function getHostBooking(orgId: string, hostUserId: string, bookingId: string): Promise<Booking | null> {
  const rows = (await db`
    ${SELECT} WHERE b.id = ${bookingId} AND b.org_id = ${orgId} AND o.host_user_id = ${hostUserId} LIMIT 1
  `) as unknown as Row[];
  return rows[0] ? publicView(mapBooking(rows[0])) : null;
}

/** The booker's view by private token. */
export async function getBookingByToken(token: string): Promise<BookerBooking | null> {
  if (!token || token.length < 16) return null;
  const rows = (await db`${SELECT} WHERE b.buyer_token = ${token} LIMIT 1`) as unknown as Row[];
  if (!rows[0]) return null;
  const { bookerUserId: _u, ...rest } = publicView(mapBooking(rows[0]));
  return rest;
}

/** The booking created for an order, for a return page (token included, the buyer just paid). */
export async function getBookingForOrder(orderId: string): Promise<{ id: string; token: string; status: BookingStatus } | null> {
  const rows = (await db`SELECT id, buyer_token, status FROM bookings WHERE order_id = ${orderId} LIMIT 1`) as unknown as Row[];
  return rows[0] ? { id: rows[0].id as string, token: rows[0].buyer_token as string, status: rows[0].status as BookingStatus } : null;
}

// ── create ────────────────────────────────────────────────────────────────

export interface CreateBookingInput {
  orgId: string;
  offerId: string;
  /** open_hours: the chosen start (ISO). */
  startsAt?: string | null;
  /** request_time: up to three proposed starts (ISO). */
  proposedTimes?: unknown;
  partySize?: number;
  booker: { userId?: string | null; email: string; name?: string | null; timeZone?: string | null };
  notes?: unknown;
  answers?: unknown;
  /**
   * True when the thread has a price: the booking is created
   * `awaiting_payment` with a hold, and the caller creates the order and
   * attaches it (`attachOrder`). False books for free.
   */
  paid: boolean;
  /** Public base of the site the booking is made on, for links in mail. */
  siteUrl?: string | null;
  now?: Date;
}

export type CreateBookingResult = ActResult<{
  bookingId: string;
  token: string;
  status: BookingStatus;
  holdExpiresAt: string | null;
}>;

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const email = (input.booker.email ?? "").trim();
  const name = cleanText(input.booker.name, 200);
  if (!name) return { ok: false, error: "Enter your name." };
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email address." };
  const now = input.now ?? new Date();

  let result: CreateBookingResult;
  try {
    result = await db.begin(async (txRaw) => {
      const tx = txRaw as unknown as Tx;
      const offer = await getOfferById(input.orgId, input.offerId, tx);
      if (!offer || offer.status !== "open") return { ok: false as const, error: "This is not open for booking." };
      const threads = (await tx`
        SELECT status FROM threads WHERE id = ${offer.threadId} AND org_id = ${input.orgId} LIMIT 1
      `) as unknown as Row[];
      if (threads[0]?.status !== "published") return { ok: false as const, error: "This is not open for booking." };

      const answers = cleanAnswers(offer.questions, input.answers);
      if (answers.ok === false) return answers;
      const partySize = Math.max(1, Math.floor(input.partySize ?? 1));
      if (partySize < offer.minParty || partySize > offer.maxParty) {
        return { ok: false as const, error: `Book between ${offer.minParty} and ${offer.maxParty} places.` };
      }
      const bookerZone = validZone(input.booker.timeZone, offer.timeZone);
      const notes = cleanText(input.notes, 2000);
      const holdExpires = new Date(now.getTime() + offer.holdMinutes * 60000);

      await lockHost(tx, offer);

      let slotId: string | null = null;
      let scheduledAt: Date | null = null;
      let proposed: Date[] = [];
      let status: BookingStatus;

      if (offer.mode === "open_hours") {
        const start = input.startsAt ? new Date(input.startsAt) : null;
        if (!start || Number.isNaN(start.getTime())) return { ok: false as const, error: "Choose a time." };
        // The same computation visitors see, repeated under the lock for the
        // chosen local day only.
        const day = zonedParts(start, offer.timeZone).date;
        const { busy, taken, cancelled } = await loadTaken(tx, offer, start.getTime(), start.getTime());
        const free = computeOpenSlots({ offer, busy, taken, cancelled, now, fromDate: day, days: 1, partySize });
        const slot = free.find((s) => new Date(s.startsAt).getTime() === start.getTime());
        if (!slot) return { ok: false as const, error: "That time is no longer free. Choose another." };
        scheduledAt = start;
        await tx`
          INSERT INTO booking_slots (offer_id, org_id, starts_at, ends_at, capacity, source)
          VALUES (${offer.id}, ${input.orgId}, ${start}, ${new Date(slot.endsAt)}, ${slot.capacity}, 'rule')
          ON CONFLICT (offer_id, starts_at) DO NOTHING
        `;
        const slotRows = (await tx`
          SELECT id, status FROM booking_slots
          WHERE offer_id = ${offer.id} AND starts_at = ${start} AND org_id = ${input.orgId}
          FOR UPDATE
        `) as unknown as Row[];
        if (!slotRows[0] || slotRows[0].status !== "scheduled") {
          return { ok: false as const, error: "That time is no longer free. Choose another." };
        }
        slotId = slotRows[0].id as string;
        status = input.paid ? "awaiting_payment" : offer.approval === "instant" ? "confirmed" : "awaiting_seller";
        if (offer.approval === "seller_confirms") proposed = [start];
      } else if (offer.mode === "request_time") {
        const parsed = parseProposedTimes(input.proposedTimes, offer, now);
        if (parsed.ok === false) return parsed;
        proposed = parsed.times;
        status = input.paid ? "awaiting_payment" : "awaiting_seller";
      } else {
        return { ok: false as const, error: "This kind of booking is not open yet." };
      }

      const token = newToken();
      const holds = status === "awaiting_payment";
      const rows = (await tx`
        INSERT INTO bookings (
          org_id, offer_id, slot_id, thread_id, booker_user_id, booker_email, booker_name, booker_time_zone,
          party_size, status, source, hold_expires_at, proposed_by, proposed_times, last_message, last_message_by,
          scheduled_at, duration_minutes, notes, answers, buyer_token, confirmed_at, site_url
        ) VALUES (
          ${input.orgId}, ${offer.id}, ${slotId}, ${offer.threadId}, ${input.booker.userId ?? null}, ${email}, ${name},
          ${bookerZone}, ${partySize}, ${status}, 'web', ${holds ? holdExpires : null},
          ${proposed.length ? "booker" : null}, ${proposed.map((d) => d.toISOString())}::timestamptz[],
          ${notes}, ${notes ? "booker" : null},
          ${scheduledAt}, ${offer.durationMinutes}, ${notes}, ${tx.json(answers.answers)}, ${token},
          ${status === "confirmed" ? now : null}, ${cleanText(input.siteUrl, 300)}
        )
        RETURNING id
      `) as unknown as Row[];
      return {
        ok: true as const,
        bookingId: rows[0].id as string,
        token,
        status,
        holdExpiresAt: holds ? holdExpires.toISOString() : null,
      };
    });
  } catch (err) {
    console.error("[booking] createBooking:", err);
    return { ok: false, error: "Could not make the booking. Try again." };
  }

  if (result.ok && result.status !== "awaiting_payment") void announceNew(result.bookingId);
  return result;
}

/** Link the card order made for a booking (once). */
export async function attachOrder(bookingId: string, orderId: string): Promise<boolean> {
  const rows = await db`
    UPDATE bookings SET order_id = ${orderId}, updated_at = now()
    WHERE id = ${bookingId} AND order_id IS NULL AND status = 'awaiting_payment'
    RETURNING id
  `;
  return rows.length > 0;
}

/** Give back a hold whose order could not be made or opened. */
export async function releaseBooking(bookingId: string, reason: string): Promise<void> {
  await db`
    UPDATE bookings
    SET status = 'expired', cancelled_at = now(), cancelled_by = 'system', cancel_reason = ${reason}, updated_at = now()
    WHERE id = ${bookingId} AND status IN ('awaiting_payment', 'held')
  `;
}

// ── payment hooks (called by @elkdonis/commerce) ──────────────────────────

/**
 * The order of a booking is paid: confirm it (instant) or hand it to the
 * host (seller_confirms, request_time). Idempotent; a no-op for an order
 * with no booking. A payment that lands after its hold expired still
 * confirms (the money is in), and is logged so the host can check for an
 * overlap.
 */
export async function markBookingPaid(orderId: string): Promise<void> {
  const rows = (await db`
    UPDATE bookings b
    SET status = CASE
          WHEN o.mode = 'open_hours' AND o.approval = 'instant' THEN 'confirmed'
          ELSE 'awaiting_seller'
        END,
        confirmed_at = CASE WHEN o.mode = 'open_hours' AND o.approval = 'instant' THEN now() ELSE NULL END,
        hold_expires_at = NULL,
        cancelled_at = NULL, cancelled_by = NULL, cancel_reason = NULL,
        updated_at = now()
    FROM booking_offers o
    WHERE o.id = b.offer_id AND b.order_id = ${orderId}
      AND b.status IN ('awaiting_payment', 'held', 'expired')
    RETURNING b.id, (SELECT status FROM bookings WHERE id = b.id) AS before
  `) as unknown as Row[];
  for (const r of rows) {
    if (r.before === "expired") console.warn(`[booking] ${r.id}: paid after its hold expired; check for an overlap`);
    void announceNew(r.id as string);
  }
}

/** The order of a booking was cancelled or lapsed: give the seat back. */
export async function expireBookingForOrder(orderId: string): Promise<void> {
  await db`
    UPDATE bookings
    SET status = 'expired', cancelled_at = now(), cancelled_by = 'system',
        cancel_reason = 'payment not completed', updated_at = now()
    WHERE order_id = ${orderId} AND status IN ('awaiting_payment', 'held')
  `;
}

/** Mark holds past their time as expired. Seat counts ignore them already; this tidies lists. */
export async function expireLapsedHolds(): Promise<number> {
  const rows = await db`
    UPDATE bookings
    SET status = 'expired', cancelled_at = now(), cancelled_by = 'system',
        cancel_reason = 'hold expired', updated_at = now()
    WHERE status IN ('awaiting_payment', 'held') AND hold_expires_at < now()
    RETURNING id
  `;
  return rows.length;
}

// ── answering (host and booker) ───────────────────────────────────────────

type Where = { kind: "host"; orgId: string; hostUserId: string; bookingId: string } | { kind: "token"; token: string };

async function lockBooking(tx: Tx, where: Where): Promise<Row | null> {
  const rows = (where.kind === "host"
    ? await tx`
        SELECT b.*, o.host_user_id, o.mode, o.duration_minutes AS offer_duration, o.buffer_minutes
        FROM bookings b JOIN booking_offers o ON o.id = b.offer_id
        WHERE b.id = ${where.bookingId} AND b.org_id = ${where.orgId} AND o.host_user_id = ${where.hostUserId}
        FOR UPDATE OF b
      `
    : await tx`
        SELECT b.*, o.host_user_id, o.mode, o.duration_minutes AS offer_duration, o.buffer_minutes
        FROM bookings b JOIN booking_offers o ON o.id = b.offer_id
        WHERE b.buyer_token = ${where.token}
        FOR UPDATE OF b
      `) as unknown as Row[];
  return rows[0] ?? null;
}

/** Whether the host has another booking overlapping [start, start + duration). */
async function hostOverlap(tx: Tx, hostUserId: string | null, bookingId: string, start: Date, minutes: number): Promise<boolean> {
  if (!hostUserId) return false;
  const end = new Date(start.getTime() + minutes * 60000);
  const rows = (await tx`
    SELECT 1 FROM bookings b JOIN booking_offers o ON o.id = b.offer_id
    WHERE o.host_user_id = ${hostUserId} AND b.id <> ${bookingId}
      AND b.scheduled_at IS NOT NULL
      AND b.scheduled_at < ${end}
      AND b.scheduled_at + make_interval(mins => COALESCE(b.duration_minutes, o.duration_minutes, 60) + o.buffer_minutes) > ${start}
      AND (
        b.status IN ('confirmed', 'requested', 'awaiting_seller', 'awaiting_booker')
        OR (b.status IN ('held', 'awaiting_payment') AND b.hold_expires_at > now())
      )
    LIMIT 1
  `) as unknown as Row[];
  return rows.length > 0;
}

async function confirmAs(party: Party, where: Where, at: string): Promise<ActResult<{ id: string }>> {
  const target = new Date(at);
  if (Number.isNaN(target.getTime())) return { ok: false, error: "That time could not be read." };
  return db.begin(async (txRaw) => {
    const tx = txRaw as unknown as Tx;
    const b = await lockBooking(tx, where);
    if (!b) return { ok: false as const, error: "Booking not found." };
    const asked = party === "booker" ? "awaiting_booker" : "awaiting_seller";
    const other = party === "booker" ? "seller" : "booker";
    if (b.status !== asked || b.proposed_by !== other) return { ok: false as const, error: "There is nothing for you to confirm on this booking." };
    const open = (Array.isArray(b.proposed_times) ? b.proposed_times : []).map((t) => new Date(t as string).getTime());
    if (!open.includes(target.getTime())) return { ok: false as const, error: "Choose one of the suggested times." };
    if (target.getTime() < Date.now()) return { ok: false as const, error: "That time has passed. Suggest another." };
    await lockHost(tx, { id: b.offer_id as string, hostUserId: (b.host_user_id as string | null) ?? null });
    const minutes = Number(b.duration_minutes ?? b.offer_duration ?? 60);
    if (await hostOverlap(tx, (b.host_user_id as string | null) ?? null, b.id as string, target, minutes)) {
      return { ok: false as const, error: "That time now overlaps another booking. Suggest another." };
    }
    await tx`
      UPDATE bookings
      SET status = 'confirmed', scheduled_at = ${target}, confirmed_at = now(),
          proposed_times = '{}', proposed_by = NULL, updated_at = now()
      WHERE id = ${b.id as string}
    `;
    return { ok: true as const, id: b.id as string };
  });
}

async function proposeAs(party: Party, where: Where, times: unknown, message: unknown): Promise<ActResult<{ id: string }>> {
  return db.begin(async (txRaw) => {
    const tx = txRaw as unknown as Tx;
    const b = await lockBooking(tx, where);
    if (!b) return { ok: false as const, error: "Booking not found." };
    const status = b.status as BookingStatus;
    const reopenable = status === "awaiting_seller" || status === "awaiting_booker" || (status === "confirmed" && b.mode === "request_time");
    if (!reopenable) return { ok: false as const, error: "This booking cannot take new times." };
    const offer = await getOfferById(b.org_id as string, b.offer_id as string, tx);
    if (!offer) return { ok: false as const, error: "Booking not found." };
    const parsed = parseProposedTimes(times, offer);
    if (parsed.ok === false) return parsed;
    const note = cleanText(message);
    // Proposing other times releases the held slot: the agreed time, once
    // confirmed, is recorded on the booking, not on an open-hours slot.
    await tx`
      UPDATE bookings
      SET status = ${party === "booker" ? "awaiting_seller" : "awaiting_booker"},
          proposed_by = ${party}, proposed_times = ${parsed.times.map((d) => d.toISOString())}::timestamptz[],
          last_message = ${note}, last_message_by = ${note ? party : null},
          scheduled_at = NULL, slot_id = NULL, confirmed_at = NULL, updated_at = now()
      WHERE id = ${b.id as string}
    `;
    return { ok: true as const, id: b.id as string };
  });
}

async function cancelAs(party: Party, where: Where, reason: unknown): Promise<ActResult<{ id: string; refundDueMinor: number | null }>> {
  const now = new Date();
  return db.begin(async (txRaw) => {
    const tx = txRaw as unknown as Tx;
    const b = await lockBooking(tx, where);
    if (!b) return { ok: false as const, error: "Booking not found." };
    const status = b.status as BookingStatus;
    if (status === "cancelled" || status === "expired" || status === "completed" || status === "no_show") {
      return { ok: false as const, error: "This booking is already closed." };
    }
    if (party === "booker" && b.scheduled_at && new Date(b.scheduled_at as string).getTime() < now.getTime()) {
      return { ok: false as const, error: "This booking has started; write to them instead." };
    }
    const offer = await getOfferById(b.org_id as string, b.offer_id as string, tx);
    let paidMinor = 0;
    if (b.order_id) {
      const orders = (await tx`SELECT status, total_minor FROM commerce_order WHERE id = ${b.order_id as string}`) as unknown as Row[];
      if (orders[0] && PAID_ORDER.includes(orders[0].status as string)) paidMinor = Number(orders[0].total_minor ?? 0);
    }
    const share = offer
      ? refundShare({ offer, scheduledAt: iso(b.scheduled_at), cancelledAt: now, paidMinor, by: party === "seller" ? "seller" : "booker" })
      : { percent: paidMinor > 0 ? 100 : 0, amountMinor: paidMinor };
    const due = paidMinor > 0 && (share.amountMinor == null || share.amountMinor > 0);
    await tx`
      UPDATE bookings
      SET status = 'cancelled', cancelled_at = now(), cancelled_by = ${party},
          cancel_reason = ${cleanText(reason)}, hold_expires_at = NULL,
          refund_status = ${due ? "due" : "none"}, refund_due_minor = ${due ? share.amountMinor : null},
          updated_at = now()
      WHERE id = ${b.id as string}
    `;
    return { ok: true as const, id: b.id as string, refundDueMinor: due ? share.amountMinor : null };
  });
}

function hostWhere(orgId: string, hostUserId: string, bookingId: string): Where {
  return { kind: "host", orgId, hostUserId, bookingId };
}

export async function hostConfirmTime(orgId: string, hostUserId: string, bookingId: string, at: string): Promise<ActResult> {
  const r = await confirmAs("seller", hostWhere(orgId, hostUserId, bookingId), at);
  if (r.ok) void announceConfirmed(r.id);
  return r;
}

export async function hostProposeTimes(orgId: string, hostUserId: string, bookingId: string, times: unknown, message?: unknown): Promise<ActResult> {
  const r = await proposeAs("seller", hostWhere(orgId, hostUserId, bookingId), times, message);
  if (r.ok) void announceProposal(r.id, "seller");
  return r;
}

export async function hostCancelBooking(orgId: string, hostUserId: string, bookingId: string, reason?: unknown): Promise<ActResult> {
  const r = await cancelAs("seller", hostWhere(orgId, hostUserId, bookingId), reason);
  if (r.ok) void announceCancelled(r.id, "seller");
  return r;
}

export async function bookerConfirmTime(token: string, at: string): Promise<ActResult> {
  const r = await confirmAs("booker", { kind: "token", token }, at);
  if (r.ok) void announceConfirmed(r.id);
  return r;
}

export async function bookerProposeTimes(token: string, times: unknown, message?: unknown): Promise<ActResult> {
  const r = await proposeAs("booker", { kind: "token", token }, times, message);
  if (r.ok) void announceProposal(r.id, "booker");
  return r;
}

export async function bookerCancelBooking(token: string, reason?: unknown): Promise<ActResult> {
  const r = await cancelAs("booker", { kind: "token", token }, reason);
  if (r.ok) void announceCancelled(r.id, "booker");
  return r;
}

// ── mail ──────────────────────────────────────────────────────────────────

async function announceNew(bookingId: string): Promise<void> {
  const b = await loadById(bookingId).catch(() => null);
  if (!b) return;
  if (b.status === "confirmed") return announceConfirmed(bookingId);
  if (b.status !== "awaiting_seller") return;
  const bookerZone = b.bookerTimeZone ?? b.timeZone;
  const paid = b.orderId ? ` (paid, order ${esc(b.orderNumber)})` : "";
  await notify(b.hostEmail, `Booking request: ${b.threadTitle}`, [
    `${esc(b.bookerName ?? b.bookerEmail)} would like to book <strong>${esc(b.threadTitle)}</strong>${paid}. Their times (${esc(b.timeZone)}):`,
    timesList(b.proposedTimes, b.timeZone),
    b.notes ? `Their note: “${esc(b.notes)}”` : "",
    button(hostUrl(b.siteUrl), "Confirm a time"),
  ], b.orgId, b.bookerEmail);
  await notify(b.bookerEmail, `Your booking request: ${b.threadTitle}`, [
    `Thank you. ${esc(b.hostName ?? "They")} will confirm one of your times for <strong>${esc(b.threadTitle)}</strong> or suggest others:`,
    timesList(b.proposedTimes, bookerZone),
    button(bookerUrl(b.siteUrl, b.token), "See your booking"),
  ], b.orgId, b.hostEmail);
}

async function announceConfirmed(bookingId: string): Promise<void> {
  const b = await loadById(bookingId).catch(() => null);
  if (!b || b.status !== "confirmed" || !b.scheduledAt) return;
  const bookerZone = b.bookerTimeZone ?? b.timeZone;
  await notify(b.bookerEmail, `Booked: ${b.threadTitle}, ${when(b.scheduledAt, bookerZone)}`, [
    `Your booking of <strong>${esc(b.threadTitle)}</strong> with ${esc(b.hostName ?? "your host")} is confirmed for <strong>${esc(when(b.scheduledAt, bookerZone))}</strong>.`,
    b.cancelPolicyText ? `Cancellation: ${esc(b.cancelPolicyText)}` : "",
    button(bookerUrl(b.siteUrl, b.token), "See or cancel your booking"),
    "The page also has a calendar file for this booking.",
  ], b.orgId, b.hostEmail);
  await notify(b.hostEmail, `New booking: ${b.threadTitle}, ${when(b.scheduledAt, b.timeZone)}`, [
    `${esc(b.bookerName ?? b.bookerEmail)} (${esc(b.bookerEmail)}) booked <strong>${esc(b.threadTitle)}</strong> for <strong>${esc(when(b.scheduledAt, b.timeZone))}</strong>.`,
    b.notes ? `Their note: “${esc(b.notes)}”` : "",
    Object.keys(b.answers).length ? `<ul>${Object.entries(b.answers).map(([k, v]) => `<li>${esc(k)}: ${esc(String(v))}</li>`).join("")}</ul>` : "",
    button(hostUrl(b.siteUrl), "Your bookings"),
  ], b.orgId, b.bookerEmail);
}

async function announceProposal(bookingId: string, by: Party): Promise<void> {
  const b = await loadById(bookingId).catch(() => null);
  if (!b) return;
  if (by === "seller") {
    const zone = b.bookerTimeZone ?? b.timeZone;
    await notify(b.bookerEmail, `New times suggested: ${b.threadTitle}`, [
      `${esc(b.hostName ?? "They")} suggested these times for <strong>${esc(b.threadTitle)}</strong> (${esc(zone)}):`,
      timesList(b.proposedTimes, zone),
      b.lastMessage ? `Their note: “${esc(b.lastMessage)}”` : "",
      button(bookerUrl(b.siteUrl, b.token), "Choose a time"),
    ], b.orgId, b.hostEmail);
  } else {
    await notify(b.hostEmail, `New times suggested: ${b.threadTitle}`, [
      `${esc(b.bookerName ?? b.bookerEmail)} suggested these times for <strong>${esc(b.threadTitle)}</strong> (${esc(b.timeZone)}):`,
      timesList(b.proposedTimes, b.timeZone),
      b.lastMessage ? `Their note: “${esc(b.lastMessage)}”` : "",
      button(hostUrl(b.siteUrl), "Choose a time"),
    ], b.orgId, b.bookerEmail);
  }
}

async function announceCancelled(bookingId: string, by: Party): Promise<void> {
  const b = await loadById(bookingId).catch(() => null);
  if (!b) return;
  const at = b.scheduledAt ? ` on ${esc(when(b.scheduledAt, b.bookerTimeZone ?? b.timeZone))}` : "";
  const refund = b.refundStatus === "due"
    ? b.refundDueMinor != null
      ? `A refund of ${(b.refundDueMinor / 100).toFixed(2)} ${esc(b.currency ?? "")} is due under the cancellation policy; ${esc(b.hostName ?? "the host")} issues it from the order.`
      : `${esc(b.hostName ?? "The host")} will decide about a refund; reply to this email about it.`
    : "";
  if (by === "seller") {
    await notify(b.bookerEmail, `Cancelled: ${b.threadTitle}`, [
      `${esc(b.hostName ?? "Your host")} cancelled your booking of <strong>${esc(b.threadTitle)}</strong>${at}.`,
      b.cancelReason ? `Their note: “${esc(b.cancelReason)}”` : "",
      refund,
    ], b.orgId, b.hostEmail);
  } else {
    await notify(b.hostEmail, `Cancelled by ${b.bookerName ?? b.bookerEmail}: ${b.threadTitle}`, [
      `${esc(b.bookerName ?? b.bookerEmail)} cancelled their booking of <strong>${esc(b.threadTitle)}</strong>${at}.`,
      b.cancelReason ? `Their note: “${esc(b.cancelReason)}”` : "",
      refund ? `${refund} Order ${esc(b.orderNumber)}.` : "",
      button(hostUrl(b.siteUrl), "Your bookings"),
    ], b.orgId, b.bookerEmail);
    await notify(b.bookerEmail, `You cancelled: ${b.threadTitle}`, [
      `Your booking of <strong>${esc(b.threadTitle)}</strong>${at} is cancelled.`,
      refund,
    ], b.orgId, b.hostEmail);
  }
}

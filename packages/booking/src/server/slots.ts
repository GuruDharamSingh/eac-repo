/**
 * Dated slots of set_dates offers (tour departures) on the booking tables:
 * org-wide reads, creating slots, the guest list, cancelling a slot, the
 * guide's decisions (run, reopen, close now) and the sweeper.
 *
 * Phase 2 / cutover code (docs/open/ELKTOURS_MOBILE_2026-11-15/CUTOVER.md).
 * Everything here reads or writes the per-slot override columns of the
 * migration draft `booking_slots_per_slot_columns.sql` (run_decision,
 * min_to_run, close_before_minutes, waitlist_cap, price_minor), EXCEPT where
 * noted: it must not run before that migration is applied. Nothing in
 * phase 1 (artdirect) calls into this file; elktours reaches it only with
 * BOOKING_TABLES=1.
 *
 * Every function takes `orgId` and refuses another org's rows; who may call
 * is decided by the app. No Stripe call is made anywhere: cancelling records
 * `refund_status = 'due'` and the amount (decision 4).
 */

import { db } from "@elkdonis/db";
import type { ActResult, BookingStatus } from "../core/types";
import { refundShare } from "../core/policy";
import {
  checkNewSlot,
  closedAlready,
  closeNowCloseBeforeMinutes,
  reopenCloseBeforeMinutes,
  resolveSlotSettings,
  slotState,
  type BelowMinimumRule,
  type ExistingSlot,
  type NewSlotProblem,
  type SlotOverrides,
  type SlotState,
} from "../core/slots";
import { getOfferById } from "./offers";
import { SEATS_SQL, expireLapsedHolds } from "./bookings";
import { bookerUrl, esc, notify, when } from "./notify";

type Row = Record<string, unknown>;
type Tx = typeof db;

const iso = (v: unknown): string | null => (v == null ? null : new Date(v as string).toISOString());
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));
const PAID_ORDER = ["paid", "fulfilled", "completed"];

// ── reads ─────────────────────────────────────────────────────────────────

export interface OrgSlot {
  slotId: string;
  offerId: string;
  orgId: string;
  threadId: string;
  threadTitle: string;
  threadSlug: string | null;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  capacity: number;
  /** Places taken: confirmed, waiting for an answer, or on a live hold. */
  seatsTaken: number;
  seatsLeft: number;
  /** Confirmed bookings (parties). */
  confirmedBookings: number;
  waitlistCount: number;
  /** The slot's own guide, if set. */
  guideUserId: string | null;
  guideName: string | null;
  /** The offer's host (the tour's author): the guide when the slot has none. */
  hostUserId: string | null;
  hostName: string | null;
  status: "scheduled" | "cancelled";
  note: string | null;
  runDecision: "run" | null;
  /** The slot's own overrides (null = inherit), and the effective values. */
  overrides: Required<SlotOverrides>;
  minToRun: number | null;
  closeBeforeMinutes: number;
  waitlistCap: number | null;
  priceMinor: number | null;
}

function mapSlot(r: Row): OrgSlot {
  const starts = iso(r.starts_at)!;
  const ends = iso(r.ends_at)!;
  const capacity = Number(r.capacity);
  const taken = Number(r.taken ?? 0);
  const overrides: Required<SlotOverrides> = {
    minToRun: numOrNull(r.slot_min),
    closeBeforeMinutes: numOrNull(r.slot_close),
    waitlistCap: numOrNull(r.waitlist_cap),
    priceMinor: numOrNull(r.price_minor),
  };
  const eff = resolveSlotSettings({ minToRun: numOrNull(r.offer_min), closeBeforeMinutes: Number(r.offer_close ?? 0) }, overrides);
  return {
    slotId: r.id as string,
    offerId: r.offer_id as string,
    orgId: r.org_id as string,
    threadId: r.thread_id as string,
    threadTitle: (r.title as string) ?? "",
    threadSlug: (r.slug as string | null) ?? null,
    startsAt: starts,
    endsAt: ends,
    durationMinutes: Math.max(1, Math.round((new Date(ends).getTime() - new Date(starts).getTime()) / 60000)),
    capacity,
    seatsTaken: taken,
    seatsLeft: Math.max(0, capacity - taken),
    confirmedBookings: Number(r.confirmed ?? 0),
    waitlistCount: Number(r.waiting ?? 0),
    guideUserId: (r.guide_user_id as string | null) ?? null,
    guideName: (r.guide_name as string | null) ?? null,
    hostUserId: (r.host_user_id as string | null) ?? null,
    hostName: (r.host_name as string | null) ?? null,
    status: r.status as "scheduled" | "cancelled",
    note: (r.note as string | null) ?? null,
    runDecision: r.run_decision === "run" ? "run" : null,
    overrides,
    ...eff,
  };
}

const SLOT_SELECT = db`
  SELECT s.id, s.offer_id, s.org_id, s.starts_at, s.ends_at, s.capacity, s.guide_user_id, s.status, s.note,
         s.run_decision, s.min_to_run AS slot_min, s.close_before_minutes AS slot_close,
         s.waitlist_cap, s.price_minor,
         o.thread_id, o.host_user_id, o.min_to_run AS offer_min, o.close_before_minutes AS offer_close,
         t.title, t.slug, g.display_name AS guide_name, h.display_name AS host_name,
         COALESCE((SELECT SUM(b.party_size) FROM bookings b WHERE b.slot_id = s.id AND ${SEATS_SQL}), 0) AS taken,
         (SELECT COUNT(*) FROM bookings b WHERE b.slot_id = s.id AND b.status = 'confirmed') AS confirmed,
         (SELECT COUNT(*) FROM bookings b WHERE b.slot_id = s.id AND b.status = 'waitlisted') AS waiting
  FROM booking_slots s
  JOIN booking_offers o ON o.id = s.offer_id AND o.mode = 'set_dates'
  JOIN threads t ON t.id = o.thread_id
  LEFT JOIN users g ON g.id = s.guide_user_id
  LEFT JOIN users h ON h.id = o.host_user_id
`;

/** Slots of `orgId` (set_dates offers), by start. Past slots before `from` are left out. */
export async function listOrgSlots(
  orgId: string,
  opts: { from?: Date; to?: Date; threadId?: string; includeCancelled?: boolean } = {}
): Promise<OrgSlot[]> {
  const rows = (await db`
    ${SLOT_SELECT}
    WHERE s.org_id = ${orgId}
      ${opts.from ? db`AND s.starts_at >= ${opts.from}` : db``}
      ${opts.to ? db`AND s.starts_at < ${opts.to}` : db``}
      ${opts.threadId ? db`AND o.thread_id = ${opts.threadId}` : db``}
      ${opts.includeCancelled === false ? db`AND s.status = 'scheduled'` : db``}
    ORDER BY s.starts_at
    LIMIT 1000
  `) as unknown as Row[];
  return rows.map(mapSlot);
}

export async function getOrgSlot(orgId: string, slotId: string): Promise<OrgSlot | null> {
  if (!/^[0-9a-f-]{36}$/i.test(slotId)) return null;
  const rows = (await db`${SLOT_SELECT} WHERE s.org_id = ${orgId} AND s.id = ${slotId} LIMIT 1`) as unknown as Row[];
  return rows[0] ? mapSlot(rows[0]) : null;
}

/** The state of a slot under the site rule (the pure function every screen shares). */
export function stateOfSlot(slot: OrgSlot, rule: BelowMinimumRule, now: Date = new Date()): SlotState {
  return slotState({
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    status: slot.status,
    runDecision: slot.runDecision,
    booked: slot.seatsTaken,
    capacity: slot.capacity,
    minToRun: slot.minToRun,
    closeBeforeMinutes: slot.closeBeforeMinutes,
    rule,
    now,
  });
}

// ── the guest list ────────────────────────────────────────────────────────

export interface SlotBooking {
  bookingId: string;
  name: string | null;
  email: string;
  party: number;
  note: string | null;
  status: BookingStatus;
  orderNumber: string | null;
  createdAt: string;
  refundStatus: "none" | "due" | "issued" | "declined";
  refundDueMinor: number | null;
  currency: string | null;
  totalMinor: number | null;
}

/** The manifest of a slot, confirmed first. Unpaid holds are not shown. Org-scoped. */
export async function listSlotBookings(orgId: string, slotId: string): Promise<SlotBooking[]> {
  if (!/^[0-9a-f-]{36}$/i.test(slotId)) return [];
  const rows = (await db`
    SELECT b.id, b.booker_name, b.booker_email, b.party_size, b.notes, b.status, b.created_at,
           b.refund_status, b.refund_due_minor, co.number AS order_number, co.currency, co.total_minor
    FROM bookings b
    LEFT JOIN commerce_order co ON co.id = b.order_id
    WHERE b.slot_id = ${slotId} AND b.org_id = ${orgId}
      AND b.status NOT IN ('held', 'awaiting_payment', 'expired')
    ORDER BY (b.status = 'confirmed') DESC, b.created_at
  `) as unknown as Row[];
  return rows.map((r) => ({
    bookingId: r.id as string,
    name: (r.booker_name as string | null) ?? null,
    email: r.booker_email as string,
    party: Number(r.party_size),
    note: (r.notes as string | null) ?? null,
    status: r.status as BookingStatus,
    orderNumber: (r.order_number as string | null) ?? null,
    createdAt: iso(r.created_at)!,
    refundStatus: (r.refund_status as SlotBooking["refundStatus"]) ?? "none",
    refundDueMinor: numOrNull(r.refund_due_minor),
    currency: (r.currency as string | null) ?? null,
    totalMinor: numOrNull(r.total_minor),
  }));
}

// ── writing slot rows ─────────────────────────────────────────────────────

/** Write the override columns that `p` names (undefined = leave; null = back to the offer's). */
async function setOverrides(tx: Tx, orgId: string, slotId: string, p: SlotOverrides): Promise<void> {
  const hasMin = p.minToRun !== undefined;
  const hasClose = p.closeBeforeMinutes !== undefined;
  const hasWait = p.waitlistCap !== undefined;
  const hasPrice = p.priceMinor !== undefined;
  if (!hasMin && !hasClose && !hasWait && !hasPrice) return;
  await tx`
    UPDATE booking_slots SET
      min_to_run = CASE WHEN ${hasMin} THEN ${p.minToRun ?? null}::integer ELSE min_to_run END,
      close_before_minutes = CASE WHEN ${hasClose} THEN ${p.closeBeforeMinutes ?? null}::integer ELSE close_before_minutes END,
      waitlist_cap = CASE WHEN ${hasWait} THEN ${p.waitlistCap ?? null}::integer ELSE waitlist_cap END,
      price_minor = CASE WHEN ${hasPrice} THEN ${p.priceMinor ?? null}::integer ELSE price_minor END,
      updated_at = now()
    WHERE id = ${slotId} AND org_id = ${orgId}
  `;
}

function checkOverrides(p: SlotOverrides, capacity: number): string | null {
  if (p.minToRun != null && !(Number.isInteger(p.minToRun) && p.minToRun >= 1 && p.minToRun <= capacity)) {
    return "The minimum to run must be between 1 and the number of places.";
  }
  if (p.closeBeforeMinutes != null && !(Number.isInteger(p.closeBeforeMinutes) && p.closeBeforeMinutes >= 0 && p.closeBeforeMinutes <= 60 * 24 * 60)) {
    return "Booking must close less than 60 days before the start.";
  }
  if (p.waitlistCap != null && !(Number.isInteger(p.waitlistCap) && p.waitlistCap >= 0 && p.waitlistCap <= 100)) {
    return "The waitlist holds between 0 and 100.";
  }
  if (p.priceMinor != null && !(Number.isInteger(p.priceMinor) && p.priceMinor >= 0)) return "The price must be zero or more.";
  return null;
}

export interface NewSlot extends SlotOverrides {
  startsAt: string | Date;
  /** Default: the offer's duration. */
  durationMinutes?: number;
  capacity: number;
  /** Default: the offer's host. */
  guideUserId?: string | null;
  note?: string | null;
  /** 'rule' for a slot a standing rule made (default 'manual'). */
  source?: "manual" | "rule";
  /** The standing rule that made the slot (migration 291). Written only when set, so a plain create does not need the column. */
  standingRuleId?: string | null;
}

export type SlotSkipReason = NewSlotProblem | "exists" | "invalid";

export interface CreateSlotsResult {
  created: Array<{ slotId: string; startsAt: string }>;
  skipped: Array<{ startsAt: string; reason: SlotSkipReason; message: string }>;
}

/**
 * Create slots on a set_dates offer. One transaction under an org-wide lock:
 * each candidate is checked against the org's scheduled slots (a guide cannot
 * lead two overlapping slots, candidates earlier in this call count), against
 * "booking would already be closed", and against an existing slot at the same
 * start of the same offer. The override columns are written only for slots
 * that carry overrides, so a plain create does not touch them.
 *
 * `allowClash` creates a slot that overlaps another slot of the same guide
 * instead of skipping it: the caller has shown the overlap as a warning and
 * the office chose to publish (elktours, 2026-11-24). Past and already-closed
 * slots and duplicates at the same start are still skipped.
 */
export async function createSlots(input: { orgId: string; offerId: string; slots: NewSlot[]; now?: Date; allowClash?: boolean }): Promise<ActResult<CreateSlotsResult>> {
  const now = input.now ?? new Date();
  if (input.slots.length === 0) return { ok: false, error: "No slots to create." };
  if (input.slots.length > 200) return { ok: false, error: "At most 200 slots at a time." };
  try {
    return await db.begin(async (txRaw) => {
      const tx = txRaw as unknown as Tx;
      const offer = await getOfferById(input.orgId, input.offerId, tx);
      if (!offer || offer.mode !== "set_dates") return { ok: false as const, error: "That tour is not set up for dated bookings." };
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${"booking-slots:" + input.orgId}, 0))`;

      const parsed = input.slots.map((s) => {
        const start = new Date(s.startsAt);
        const minutes = s.durationMinutes ?? offer.durationMinutes ?? 0;
        return { s, start, minutes, end: new Date(start.getTime() + minutes * 60000) };
      });
      const valid = parsed.filter((p) => !Number.isNaN(p.start.getTime()) && p.minutes > 0);
      const result: CreateSlotsResult = { created: [], skipped: [] };
      for (const p of parsed) {
        if (!valid.includes(p)) result.skipped.push({ startsAt: String(p.s.startsAt), reason: "invalid", message: "That time could not be read." });
      }
      if (valid.length === 0) return { ok: true as const, ...result };

      const lo = new Date(Math.min(...valid.map((p) => p.start.getTime())) - 36 * 3600_000);
      const hi = new Date(Math.max(...valid.map((p) => p.end.getTime())) + 36 * 3600_000);
      const rows = (await tx`
        SELECT s.id, s.offer_id, s.starts_at, s.ends_at, s.status, COALESCE(s.guide_user_id, o.host_user_id) AS guide, t.title
        FROM booking_slots s JOIN booking_offers o ON o.id = s.offer_id JOIN threads t ON t.id = o.thread_id
        WHERE s.org_id = ${input.orgId} AND s.status = 'scheduled' AND s.starts_at >= ${lo} AND s.starts_at < ${hi}
      `) as unknown as Row[];
      const existing: Array<ExistingSlot & { offerId: string }> = rows.map((r) => ({
        id: r.id as string,
        offerId: r.offer_id as string,
        guideUserId: (r.guide as string | null) ?? null,
        status: "scheduled" as const,
        startsAt: iso(r.starts_at)!,
        endsAt: iso(r.ends_at)!,
        label: `${r.title as string} at ${new Date(r.starts_at as string).toISOString().slice(11, 16)} UTC`,
      }));

      for (const p of valid.sort((a, b) => a.start.getTime() - b.start.getTime())) {
        const startsAt = p.start.toISOString();
        const bad = checkOverrides(p.s, p.s.capacity);
        if (!(p.s.capacity >= 1 && p.s.capacity <= 500)) {
          result.skipped.push({ startsAt, reason: "invalid", message: "Places must be between 1 and 500." });
          continue;
        }
        if (bad) {
          result.skipped.push({ startsAt, reason: "invalid", message: bad });
          continue;
        }
        if (existing.some((e) => e.offerId === offer.id && new Date(e.startsAt).getTime() === p.start.getTime())) {
          result.skipped.push({ startsAt, reason: "exists", message: "This tour already has a slot at that time." });
          continue;
        }
        const guide = p.s.guideUserId === undefined ? offer.hostUserId : p.s.guideUserId;
        const closeBefore = p.s.closeBeforeMinutes ?? offer.closeBeforeMinutes;
        const check = checkNewSlot({ candidate: { startsAt, endsAt: p.end, guideUserId: guide }, closeBeforeMinutes: closeBefore, existing, now });
        if (check.ok === false && !(input.allowClash && check.reason === "clash")) {
          result.skipped.push({ startsAt, reason: check.reason, message: check.message });
          continue;
        }
        // checkNewSlot returns at the clash, so a clashing candidate has not been tested for "already closed" yet.
        if (check.ok === false && closedAlready(p.start, closeBefore, now)) {
          result.skipped.push({ startsAt, reason: "closed", message: "Booking would already be closed. Shorten the cutoff." });
          continue;
        }
        const inserted = (await tx`
          INSERT INTO booking_slots (offer_id, org_id, starts_at, ends_at, capacity, guide_user_id, note, source)
          VALUES (${offer.id}, ${input.orgId}, ${p.start}, ${p.end}, ${p.s.capacity}, ${p.s.guideUserId ?? null}, ${p.s.note ?? null}, ${p.s.source ?? "manual"})
          ON CONFLICT (offer_id, starts_at) DO NOTHING
          RETURNING id
        `) as unknown as Row[];
        if (!inserted[0]) {
          result.skipped.push({ startsAt, reason: "exists", message: "This tour already has a slot at that time." });
          continue;
        }
        const slotId = inserted[0].id as string;
        await setOverrides(tx, input.orgId, slotId, p.s);
        if (p.s.standingRuleId) {
          await tx`UPDATE booking_slots SET standing_rule_id = ${p.s.standingRuleId} WHERE id = ${slotId} AND org_id = ${input.orgId}`;
        }
        result.created.push({ slotId, startsAt });
        existing.push({ id: slotId, offerId: offer.id, guideUserId: guide, status: "scheduled", startsAt, endsAt: p.end.toISOString(), label: `${offer.threadId} at ${startsAt.slice(11, 16)} UTC` });
      }
      return { ok: true as const, ...result };
    });
  } catch (err) {
    console.error("[booking] createSlots:", err);
    return { ok: false, error: "Could not create the slots. Try again." };
  }
}

export interface SlotPatchInput extends SlotOverrides {
  startsAt?: string | Date;
  capacity?: number;
  /** null = the offer's host. */
  guideUserId?: string | null;
  note?: string | null;
}

/**
 * Change a slot: start (its bookings move with it), places (not below those
 * taken), guide, note, and per-slot overrides. The caller has checked the
 * guide's overlap (the same rule createSlots applies).
 */
export async function updateSlot(orgId: string, slotId: string, patch: SlotPatchInput): Promise<ActResult> {
  try {
    return await db.begin(async (txRaw) => {
      const tx = txRaw as unknown as Tx;
      const rows = (await tx`
        SELECT id, starts_at, ends_at, capacity, status FROM booking_slots
        WHERE id = ${slotId} AND org_id = ${orgId} FOR UPDATE
      `) as unknown as Row[];
      const s = rows[0];
      if (!s) return { ok: false as const, error: "That slot is not on this site." };
      if (s.status !== "scheduled") return { ok: false as const, error: "That slot is cancelled." };
      const capacity = patch.capacity !== undefined ? Math.floor(Number(patch.capacity)) : Number(s.capacity);
      if (!(capacity >= 1 && capacity <= 500)) return { ok: false as const, error: "Places must be between 1 and 500." };
      const taken = (await tx`
        SELECT COALESCE(SUM(b.party_size), 0) AS taken FROM bookings b WHERE b.slot_id = ${slotId} AND ${SEATS_SQL}
      `) as unknown as Row[];
      if (capacity < Number(taken[0]?.taken ?? 0)) return { ok: false as const, error: `${Number(taken[0]?.taken ?? 0)} places are already taken.` };
      const bad = checkOverrides(patch, capacity);
      if (bad) return { ok: false as const, error: bad };

      const oldStart = new Date(s.starts_at as string);
      const start = patch.startsAt !== undefined ? new Date(patch.startsAt) : oldStart;
      if (Number.isNaN(start.getTime())) return { ok: false as const, error: "The start time could not be read." };
      const end = new Date(start.getTime() + (new Date(s.ends_at as string).getTime() - oldStart.getTime()));
      await tx`
        UPDATE booking_slots SET
          starts_at = ${start}, ends_at = ${end}, capacity = ${capacity},
          guide_user_id = CASE WHEN ${patch.guideUserId !== undefined} THEN ${patch.guideUserId ?? null}::uuid ELSE guide_user_id END,
          note = CASE WHEN ${patch.note !== undefined} THEN ${patch.note ?? null} ELSE note END,
          updated_at = now()
        WHERE id = ${slotId} AND org_id = ${orgId}
      `;
      if (start.getTime() !== oldStart.getTime()) {
        await tx`
          UPDATE bookings SET scheduled_at = ${start}, reminder_sent_at = NULL, updated_at = now()
          WHERE slot_id = ${slotId} AND scheduled_at IS NOT NULL
            AND status IN ('confirmed', 'requested', 'awaiting_seller', 'awaiting_booker', 'held', 'awaiting_payment')
        `;
      }
      await setOverrides(tx, orgId, slotId, patch);
      return { ok: true as const };
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "23505") return { ok: false, error: "This tour already has a slot at that time." };
    console.error("[booking] updateSlot:", err);
    return { ok: false, error: "Could not save the slot." };
  }
}

// ── cancelling a slot ─────────────────────────────────────────────────────

export interface RefundDueRow {
  bookingId: string;
  name: string | null;
  email: string;
  orderNumber: string | null;
  amountMinor: number;
  currency: string;
}

interface Affected {
  id: string;
  email: string;
  name: string | null;
  token: string;
  siteUrl: string | null;
  scheduledAt: string | null;
  refundMinor: number;
  currency: string;
  orderNumber: string | null;
  confirmed: boolean;
}

/**
 * Cancel a slot: the slot, and every booking on it (answered or waiting; unpaid
 * holds are simply given back). Paid bookings get `refund_status = 'due'` with
 * the whole amount, as a host cancel does. Guests are emailed after commit.
 * No Stripe call. `by` is 'system' for the sweeper.
 */
export async function cancelSlot(
  orgId: string,
  slotId: string,
  opts: { reason?: string | null; by?: "seller" | "system" } = {}
): Promise<ActResult<{ cancelled: number; refundsDue: RefundDueRow[] }>> {
  const by = opts.by ?? "seller";
  const reason = (opts.reason ?? "").trim().slice(0, 1000) || null;
  let title = "";
  let affected: Affected[] = [];
  try {
    const out = await db.begin(async (txRaw) => {
      const tx = txRaw as unknown as Tx;
      const slots = (await tx`
        SELECT s.id, s.offer_id, s.status, t.title FROM booking_slots s
        JOIN booking_offers o ON o.id = s.offer_id JOIN threads t ON t.id = o.thread_id
        WHERE s.id = ${slotId} AND s.org_id = ${orgId} FOR UPDATE OF s
      `) as unknown as Row[];
      const slot = slots[0];
      if (!slot) return { ok: false as const, error: "That slot is not on this site." };
      if (slot.status !== "scheduled") return { ok: false as const, error: "That slot is already cancelled." };
      title = slot.title as string;
      const offer = await getOfferById(orgId, slot.offer_id as string, tx);
      await tx`UPDATE booking_slots SET status = 'cancelled', updated_at = now() WHERE id = ${slotId}`;
      const rows = (await tx`
        SELECT b.id, b.status, b.booker_email, b.booker_name, b.buyer_token, b.site_url, b.scheduled_at,
               co.number AS order_number, co.status AS order_status, co.total_minor, co.currency
        FROM bookings b LEFT JOIN commerce_order co ON co.id = b.order_id
        WHERE b.slot_id = ${slotId}
          AND b.status IN ('confirmed', 'requested', 'awaiting_seller', 'awaiting_booker', 'held', 'awaiting_payment')
        FOR UPDATE OF b
      `) as unknown as Row[];
      const now = new Date();
      const list: Affected[] = [];
      for (const r of rows) {
        const unpaidHold = r.status === "held" || r.status === "awaiting_payment";
        const paid = !unpaidHold && r.order_status != null && PAID_ORDER.includes(r.order_status as string);
        const paidMinor = paid ? Number(r.total_minor ?? 0) : 0;
        const share = offer
          ? refundShare({ offer, scheduledAt: iso(r.scheduled_at), cancelledAt: now, paidMinor, by: "seller" })
          : { percent: paidMinor > 0 ? 100 : 0, amountMinor: paidMinor };
        const due = paidMinor > 0 && (share.amountMinor == null || share.amountMinor > 0);
        const amount = due ? (share.amountMinor ?? paidMinor) : 0;
        await tx`
          UPDATE bookings
          SET status = 'cancelled', cancelled_at = now(), cancelled_by = ${by}, cancel_reason = ${reason},
              hold_expires_at = NULL, refund_status = ${due ? "due" : "none"}, refund_due_minor = ${due ? amount : null},
              updated_at = now()
          WHERE id = ${r.id as string}
        `;
        list.push({
          id: r.id as string,
          email: r.booker_email as string,
          name: (r.booker_name as string | null) ?? null,
          token: r.buyer_token as string,
          siteUrl: (r.site_url as string | null) ?? null,
          scheduledAt: iso(r.scheduled_at),
          refundMinor: amount,
          currency: (r.currency as string | null) ?? "EUR",
          orderNumber: (r.order_number as string | null) ?? null,
          confirmed: !unpaidHold,
        });
      }
      return { ok: true as const, list };
    });
    if (out.ok === false) return out;
    affected = out.list;
  } catch (err) {
    console.error("[booking] cancelSlot:", err);
    return { ok: false, error: "Could not cancel the slot." };
  }

  // Mail after commit; a failed email never undoes the cancellation.
  for (const a of affected.filter((x) => x.confirmed)) {
    const at = a.scheduledAt ? ` on ${esc(when(a.scheduledAt, "Europe/Paris"))}` : "";
    const refund = a.refundMinor > 0
      ? `A refund of ${(a.refundMinor / 100).toFixed(2)} ${esc(a.currency)} is due to you${a.orderNumber ? ` (order ${esc(a.orderNumber)})` : ""}; we will issue it from the order.`
      : "";
    void notify(a.email, `Cancelled: ${title}`, [
      `We are sorry: <strong>${esc(title)}</strong>${at} has been cancelled${by === "system" ? " because too few people had booked" : ""}.`,
      reason ? `A note: “${esc(reason)}”` : "",
      refund,
      `Your booking: <a href="${esc(bookerUrl(a.siteUrl, a.token))}">see it here</a>.`,
    ], orgId);
  }
  return {
    ok: true,
    cancelled: affected.length,
    refundsDue: affected
      .filter((a) => a.refundMinor > 0)
      .map((a) => ({ bookingId: a.id, name: a.name, email: a.email, orderNumber: a.orderNumber, amountMinor: a.refundMinor, currency: a.currency })),
  };
}

// ── the guide's decisions ─────────────────────────────────────────────────

async function liveSlot(orgId: string, slotId: string): Promise<{ ok: true; slot: OrgSlot } | { ok: false; error: string }> {
  const slot = await getOrgSlot(orgId, slotId);
  if (!slot) return { ok: false, error: "That slot is not on this site." };
  if (slot.status !== "scheduled") return { ok: false, error: "That slot is cancelled." };
  return { ok: true, slot };
}

/** "Run it with N guests": only for a slot that closed below its minimum and waits for the guide. */
export async function runSlot(orgId: string, slotId: string, opts: { rule?: BelowMinimumRule; now?: Date } = {}): Promise<ActResult> {
  const live = await liveSlot(orgId, slotId);
  if (live.ok === false) return live;
  const state = stateOfSlot(live.slot, opts.rule ?? "guide_decides", opts.now);
  if (state.key !== "below") return { ok: false, error: "This slot is not waiting for your decision." };
  await db`UPDATE booking_slots SET run_decision = 'run', updated_at = now() WHERE id = ${slotId} AND org_id = ${orgId}`;
  const guests = (await db`
    SELECT b.booker_email, b.buyer_token, b.site_url FROM bookings b WHERE b.slot_id = ${slotId} AND b.status = 'confirmed'
  `) as unknown as Row[];
  for (const g of guests) {
    void notify(g.booker_email as string, `It is on: ${live.slot.threadTitle}`, [
      `Good news: <strong>${esc(live.slot.threadTitle)}</strong> on ${esc(when(live.slot.startsAt, "Europe/Paris"))} is going ahead.`,
      `<a href="${esc(bookerUrl(g.site_url as string | null, g.buyer_token as string))}">Your booking</a>`,
    ], orgId);
  }
  return { ok: true };
}

/** Reopen booking so it closes `hours` from now (and clears a run decision). */
export async function reopenSlot(orgId: string, slotId: string, opts: { hours: number; now?: Date }): Promise<ActResult<{ closesInHours: number; closesAt: string }>> {
  const live = await liveSlot(orgId, slotId);
  if (live.ok === false) return live;
  const now = opts.now ?? new Date();
  if (new Date(live.slot.startsAt).getTime() <= now.getTime()) return { ok: false, error: "That slot has started." };
  const hours = Math.min(24 * 14, Math.max(1, Math.floor(opts.hours)));
  const before = reopenCloseBeforeMinutes(live.slot.startsAt, hours, now);
  await db`
    UPDATE booking_slots SET close_before_minutes = ${before}, run_decision = NULL, updated_at = now()
    WHERE id = ${slotId} AND org_id = ${orgId}
  `;
  // Booking now closes `before` minutes ahead of the start (the start itself when it is closer than `hours`).
  return { ok: true, closesInHours: hours, closesAt: new Date(new Date(live.slot.startsAt).getTime() - before * 60000).toISOString() };
}

/** Close booking now: the guest list is fixed. */
export async function closeSlotNow(orgId: string, slotId: string, opts: { now?: Date } = {}): Promise<ActResult> {
  const live = await liveSlot(orgId, slotId);
  if (live.ok === false) return live;
  const before = closeNowCloseBeforeMinutes(live.slot.startsAt, opts.now);
  await db`UPDATE booking_slots SET close_before_minutes = ${before}, updated_at = now() WHERE id = ${slotId} AND org_id = ${orgId}`;
  return { ok: true };
}

// ── offer defaults ────────────────────────────────────────────────────────

/** Keep a tour's offer in step with the tour's saved defaults (minimum, cutoff, waitlist on/off). */
export async function setOfferDefaults(
  orgId: string,
  threadId: string,
  d: { minToRun: number | null; closeBeforeMinutes: number; waitlist: boolean }
): Promise<boolean> {
  const rows = await db`
    UPDATE booking_offers SET min_to_run = ${d.minToRun}, close_before_minutes = ${d.closeBeforeMinutes},
      waitlist = ${d.waitlist}, cancel_free_until_minutes = ${d.closeBeforeMinutes}, updated_at = now()
    WHERE org_id = ${orgId} AND thread_id = ${threadId} AND mode = 'set_dates'
    RETURNING id
  `;
  return rows.length > 0;
}

// ── the sweeper ───────────────────────────────────────────────────────────

/**
 * Housekeeping tick: lapsed holds are marked expired (every org, as the
 * existing tick does) and, when the site rule is `auto_cancel`, slots of
 * `orgId` that closed below their minimum with no run decision are cancelled
 * and their bookings flagged refund-due. Under `guide_decides` nothing is
 * cancelled here: those slots wait on the Decisions screen. No Stripe call.
 * Safe to run often; a second run finds nothing to do.
 */
export async function sweepSlots(
  orgId: string,
  opts: { rule: BelowMinimumRule; now?: Date }
): Promise<{ holdsExpired: number; autoCancelled: string[] }> {
  const now = opts.now ?? new Date();
  const holdsExpired = await expireLapsedHolds();
  const autoCancelled: string[] = [];
  if (opts.rule !== "auto_cancel") return { holdsExpired, autoCancelled };
  const candidates = (await db`
    ${SLOT_SELECT}
    WHERE s.org_id = ${orgId} AND s.status = 'scheduled' AND s.run_decision IS NULL
      AND s.starts_at > ${now}
      AND s.starts_at - make_interval(mins => COALESCE(s.close_before_minutes, o.close_before_minutes)) <= ${now}
    ORDER BY s.starts_at
    LIMIT 200
  `) as unknown as Row[];
  for (const r of candidates) {
    const slot = mapSlot(r);
    const state = stateOfSlot(slot, opts.rule, now);
    if (!(state.key === "cancelled" && state.auto)) continue;
    const res = await cancelSlot(orgId, slot.slotId, { reason: `Fewer than ${slot.minToRun} guests had booked when booking closed.`, by: "system" });
    if (res.ok) autoCancelled.push(slot.slotId);
  }
  return { holdsExpired, autoCancelled };
}

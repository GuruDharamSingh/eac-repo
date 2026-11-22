/**
 * Offers: one per thread (`booking_offers`), with weekly open hours in
 * `booking_rules`. Every function takes `orgId` and refuses rows of another
 * org; who may edit is decided in @elkdonis/services (booking-offers.ts).
 */

import { db } from "@elkdonis/db";
import type { BookingOffer, BookingOfferInput, HoursRange, IntakeQuestion } from "../core/types";
import { formatClock, parseClock } from "../core/time";
import { validateOfferInput } from "../core/validate";

type Row = Record<string, unknown>;
type Tx = typeof db;

const num = (v: unknown): number | null => (v == null ? null : Number(v));

function dateOnly(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function clock(v: unknown): string {
  // "24:00" is stored as 23:59:59 (a time column has no 24:00 in practice).
  if (String(v).startsWith("23:59:59")) return "24:00";
  const m = parseClock(String(v));
  return m == null ? "00:00" : formatClock(m);
}

export function mapOffer(row: Row, rules: Row[]): BookingOffer {
  const hours: HoursRange[] = rules
    .map((r) => ({ weekday: Number(r.weekday), from: clock(r.from_time), to: clock(r.to_time) }))
    .sort((a, b) => a.weekday - b.weekday || a.from.localeCompare(b.from));
  const validFrom = rules.map((r) => dateOnly(r.valid_from)).find(Boolean) ?? null;
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    threadId: row.thread_id as string,
    hostUserId: (row.host_user_id as string | null) ?? null,
    mode: row.mode as BookingOffer["mode"],
    durationMinutes: num(row.duration_minutes),
    slotStepMinutes: num(row.slot_step_minutes),
    bufferMinutes: Number(row.buffer_minutes ?? 0),
    timeZone: (row.time_zone as string) || "America/Toronto",
    capacityPerSlot: num(row.capacity_per_slot),
    minParty: Number(row.min_party ?? 1),
    maxParty: Number(row.max_party ?? 1),
    minToRun: num(row.min_to_run),
    leadTimeMinutes: Number(row.lead_time_minutes ?? 0),
    closeBeforeMinutes: Number(row.close_before_minutes ?? 0),
    maxAheadDays: Number(row.max_ahead_days ?? 60),
    priceUnit: (row.price_unit as BookingOffer["priceUnit"]) ?? "per_booking",
    holdMinutes: Number(row.hold_minutes ?? 75),
    approval: (row.approval as BookingOffer["approval"]) ?? "instant",
    cancelFreeUntilMinutes: num(row.cancel_free_until_minutes),
    cancelRefundPercentAfter: num(row.cancel_refund_percent_after),
    cancelPolicyText: (row.cancel_policy_text as string | null) ?? null,
    waitlist: Boolean(row.waitlist),
    questions: Array.isArray(row.questions) ? (row.questions as IntakeQuestion[]) : [],
    status: (row.status as BookingOffer["status"]) ?? "open",
    reminderMinutesBefore: row.reminder_minutes_before === undefined ? 1440 : num(row.reminder_minutes_before),
    hours,
    validFrom,
  };
}

async function loadRules(tx: Tx, offerId: string): Promise<Row[]> {
  return (await tx`
    SELECT weekday, from_time::text AS from_time, to_time::text AS to_time, valid_from
    FROM booking_rules WHERE offer_id = ${offerId}
    ORDER BY weekday, from_time
  `) as unknown as Row[];
}

export async function getOfferByThread(orgId: string, threadId: string, tx: Tx = db): Promise<BookingOffer | null> {
  const rows = (await tx`
    SELECT * FROM booking_offers WHERE org_id = ${orgId} AND thread_id = ${threadId} LIMIT 1
  `) as unknown as Row[];
  if (!rows[0]) return null;
  return mapOffer(rows[0], await loadRules(tx, rows[0].id as string));
}

export async function getOfferById(orgId: string, offerId: string, tx: Tx = db): Promise<BookingOffer | null> {
  const rows = (await tx`
    SELECT * FROM booking_offers WHERE org_id = ${orgId} AND id = ${offerId} LIMIT 1
  `) as unknown as Row[];
  if (!rows[0]) return null;
  return mapOffer(rows[0], await loadRules(tx, rows[0].id as string));
}

/** The editable part of an offer, for a form to load. */
export function offerToInput(o: BookingOffer): BookingOfferInput {
  return {
    mode: o.mode === "request_time" ? "request_time" : o.mode === "set_dates" ? "set_dates" : "open_hours",
    durationMinutes: o.durationMinutes ?? 60,
    timeZone: o.timeZone,
    hours: o.hours,
    validFrom: o.validFrom,
    slotStepMinutes: o.slotStepMinutes,
    bufferMinutes: o.bufferMinutes,
    capacityPerSlot: o.capacityPerSlot,
    leadTimeMinutes: o.leadTimeMinutes,
    maxAheadDays: o.maxAheadDays,
    approval: o.approval,
    cancelFreeUntilMinutes: o.cancelFreeUntilMinutes,
    cancelRefundPercentAfter: o.cancelRefundPercentAfter,
    cancelPolicyText: o.cancelPolicyText,
    questions: o.questions,
    status: o.status,
    reminderMinutesBefore: o.reminderMinutesBefore,
    minParty: o.minParty,
    maxParty: o.maxParty,
    priceUnit: o.priceUnit,
    minToRun: o.minToRun,
    closeBeforeMinutes: o.closeBeforeMinutes,
    waitlist: o.waitlist,
  };
}

/**
 * Create or replace the offer on a thread of `orgId`, and its open hours.
 * One transaction: the offer row is upserted on `thread_id` and the rules
 * replaced. The thread must belong to the org. `hostUserId` defaults to the
 * thread's author. Returns the saved offer or a sentence for the editor.
 */
export async function saveOffer(input: {
  orgId: string;
  threadId: string;
  hostUserId?: string | null;
  offer: unknown;
}): Promise<{ ok: true; offer: BookingOffer } | { ok: false; error: string }> {
  const checked = validateOfferInput(input.offer);
  if (checked.ok === false) return checked;
  const v = checked.value;

  return db.begin(async (tx) => {
    const threads = (await tx`
      SELECT id, author_id FROM threads WHERE id = ${input.threadId} AND org_id = ${input.orgId} LIMIT 1
    `) as unknown as Row[];
    if (!threads[0]) return { ok: false as const, error: "That offering was not found." };
    const host = input.hostUserId ?? (threads[0].author_id as string | null) ?? null;
    const capacity = v.capacityPerSlot ?? 1;
    // Phase 2 fields: omitted gives today's values on insert and keeps the stored value on update.
    const minParty = v.minParty ?? (v.maxParty !== undefined ? Math.min(1, v.maxParty) : 1);
    const maxParty = v.maxParty ?? Math.max(1, v.minParty ?? 1);
    const partyGiven = v.minParty !== undefined || v.maxParty !== undefined;
    const minToRunGiven = v.minToRun !== undefined;

    const saved = (await tx`
      INSERT INTO booking_offers (
        org_id, thread_id, host_user_id, mode, duration_minutes, slot_step_minutes, buffer_minutes,
        time_zone, capacity_per_slot, min_party, max_party, lead_time_minutes, max_ahead_days,
        approval, cancel_free_until_minutes, cancel_refund_percent_after, cancel_policy_text,
        questions, status, reminder_minutes_before,
        min_to_run, close_before_minutes, price_unit, waitlist
      ) VALUES (
        ${input.orgId}, ${input.threadId}, ${host}, ${v.mode}, ${v.durationMinutes}, ${v.slotStepMinutes ?? null},
        ${v.bufferMinutes ?? 0}, ${v.timeZone}, ${capacity}, ${minParty}, ${maxParty}, ${v.leadTimeMinutes ?? 720}, ${v.maxAheadDays ?? 60},
        ${v.approval ?? "instant"}, ${v.cancelFreeUntilMinutes ?? null}, ${v.cancelRefundPercentAfter ?? null},
        ${v.cancelPolicyText ?? null}, ${tx.json((v.questions ?? []) as unknown as Parameters<typeof tx.json>[0])}, ${v.status ?? "open"},
        ${v.reminderMinutesBefore === undefined ? 1440 : v.reminderMinutesBefore},
        ${v.minToRun ?? null}, ${v.closeBeforeMinutes ?? 0}, ${v.priceUnit ?? "per_booking"}, ${v.waitlist ?? false}
      )
      ON CONFLICT (thread_id) DO UPDATE SET
        host_user_id = COALESCE(EXCLUDED.host_user_id, booking_offers.host_user_id),
        mode = EXCLUDED.mode,
        duration_minutes = EXCLUDED.duration_minutes,
        slot_step_minutes = EXCLUDED.slot_step_minutes,
        buffer_minutes = EXCLUDED.buffer_minutes,
        time_zone = EXCLUDED.time_zone,
        capacity_per_slot = EXCLUDED.capacity_per_slot,
        lead_time_minutes = EXCLUDED.lead_time_minutes,
        max_ahead_days = EXCLUDED.max_ahead_days,
        approval = EXCLUDED.approval,
        cancel_free_until_minutes = EXCLUDED.cancel_free_until_minutes,
        cancel_refund_percent_after = EXCLUDED.cancel_refund_percent_after,
        cancel_policy_text = EXCLUDED.cancel_policy_text,
        questions = EXCLUDED.questions,
        status = EXCLUDED.status,
        reminder_minutes_before = EXCLUDED.reminder_minutes_before,
        min_party = CASE WHEN ${partyGiven} THEN ${minParty} ELSE booking_offers.min_party END,
        max_party = CASE WHEN ${partyGiven} THEN ${maxParty} ELSE booking_offers.max_party END,
        min_to_run = CASE WHEN ${minToRunGiven} THEN ${v.minToRun ?? null} ELSE booking_offers.min_to_run END,
        close_before_minutes = COALESCE(${v.closeBeforeMinutes ?? null}, booking_offers.close_before_minutes),
        price_unit = COALESCE(${v.priceUnit ?? null}, booking_offers.price_unit),
        waitlist = COALESCE(${v.waitlist ?? null}, booking_offers.waitlist),
        updated_at = now()
      WHERE booking_offers.org_id = ${input.orgId}
      RETURNING *
    `) as unknown as Row[];
    const row = saved[0];
    if (!row) return { ok: false as const, error: "That offering was not found." };

    await tx`DELETE FROM booking_rules WHERE offer_id = ${row.id as string} AND org_id = ${input.orgId}`;
    for (const h of v.hours) {
      await tx`
        INSERT INTO booking_rules (offer_id, org_id, weekday, from_time, to_time, valid_from)
        VALUES (${row.id as string}, ${input.orgId}, ${h.weekday}, ${h.from}::time,
                ${h.to === "24:00" ? "23:59:59" : h.to}::time, ${v.validFrom ?? null})
      `;
    }
    return { ok: true as const, offer: mapOffer(row, await loadRules(tx as unknown as Tx, row.id as string)) };
  });
}

/** Pause, reopen or close an offer without touching its settings. */
export async function setOfferStatus(orgId: string, threadId: string, status: BookingOffer["status"]): Promise<boolean> {
  const rows = await db`
    UPDATE booking_offers SET status = ${status}, updated_at = now()
    WHERE org_id = ${orgId} AND thread_id = ${threadId}
    RETURNING id
  `;
  return rows.length > 0;
}

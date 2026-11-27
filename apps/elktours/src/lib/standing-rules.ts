import { db } from "@elkdonis/db";
import { createSlots as createBookingSlots, getOfferByThread, type NewSlot } from "@elkdonis/checkout/booking-server";
import { siteConfig } from "@/config/site";
import { MAX_STANDING_AHEAD_DAYS, addDays, isDay, isTime, isoWeekday, parisInstant, parisToday } from "@/lib/schedule-plan";

/**
 * Standing rules (migration 291, 2026-11-24): a tour kept open for registration without the office marking each
 * day. A rule names weekdays and start times; this module makes the matching booking slots up to `aheadDays`
 * ahead (at most six months) and tops them up as time passes. The slots are ordinary slots (source 'rule'): the
 * tour's minimum to run, cutoff and the guide's run-or-cancel decision apply to them as to slots made by hand.
 * A cancelled slot is not recreated (unique offer_id + starts_at), and stopping a rule leaves its slots.
 */

const ORG = siteConfig.orgId;

/** @elkdonis/booking createSlots takes at most 200 slots per call. */
const CHUNK = 200;

export interface StandingRule {
  id: string;
  offerId: string;
  tourId: string;
  /** ISO weekdays, Mon = 1 … Sun = 7. */
  weekdays: number[];
  /** HH:MM Paris wall clock. */
  times: string[];
  capacity: number;
  guideUserId: string | null;
  validFrom: string | null;
  validUntil: string | null;
  aheadDays: number;
  active: boolean;
  createdBy: string | null;
}

export type StandingShape = Pick<StandingRule, "weekdays" | "times" | "validFrom" | "validUntil" | "aheadDays">;

/** The start instants a rule covers from `today` to its horizon, in order (past instants of today included). */
export function standingStarts(rule: StandingShape, today: string = parisToday()): Array<{ day: string; time: string; at: Date }> {
  const ahead = Math.max(1, Math.min(MAX_STANDING_AHEAD_DAYS, Math.floor(rule.aheadDays)));
  const from = rule.validFrom && rule.validFrom > today ? rule.validFrom : today;
  let to = addDays(today, ahead);
  if (rule.validUntil && rule.validUntil < to) to = rule.validUntil;
  const weekdays = new Set(rule.weekdays);
  const times = [...new Set(rule.times.filter(isTime))].sort();
  const out: Array<{ day: string; time: string; at: Date }> = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    if (!weekdays.has(isoWeekday(day))) continue;
    for (const time of times) {
      const at = parisInstant(day, time);
      if (at) out.push({ day, time, at });
    }
  }
  return out;
}

/** An error sentence for a rule that cannot be saved, or null. */
export function checkStandingShape(r: StandingShape & { capacity: number }): string | null {
  if (!r.weekdays.length || !r.weekdays.every((n) => Number.isInteger(n) && n >= 1 && n <= 7)) return "Pick at least one weekday.";
  if (r.times.length === 0 || !r.times.every(isTime)) return "Add at least one start time (HH:MM).";
  if (new Set(r.times).size > 4) return "At most four start times.";
  if (!(Number.isInteger(r.capacity) && r.capacity >= 1 && r.capacity <= 500)) return "Places must be between 1 and 500.";
  if (!(Number.isInteger(r.aheadDays) && r.aheadDays >= 1 && r.aheadDays <= MAX_STANDING_AHEAD_DAYS)) return "Keep runs open between 1 day and 6 months ahead.";
  if (r.validUntil != null && !isDay(r.validUntil)) return "The end date could not be read.";
  if (r.validFrom != null && !isDay(r.validFrom)) return "The start date could not be read.";
  if (r.validUntil && r.validFrom && r.validUntil < r.validFrom) return "The end date is before the start date.";
  return null;
}

interface RuleRow {
  id: string;
  offer_id: string;
  thread_id: string;
  weekdays: number[];
  times: string[];
  capacity: number;
  guide_user_id: string | null;
  valid_from: string | Date | null;
  valid_until: string | Date | null;
  ahead_days: number;
  active: boolean;
  created_by: string | null;
}

const dayOf = (v: string | Date | null): string | null => (v == null ? null : typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10));

export function ruleFromRow(r: RuleRow): StandingRule {
  return {
    id: r.id,
    offerId: r.offer_id,
    tourId: r.thread_id,
    weekdays: r.weekdays.map(Number),
    times: r.times,
    capacity: r.capacity,
    guideUserId: r.guide_user_id,
    validFrom: dayOf(r.valid_from),
    validUntil: dayOf(r.valid_until),
    aheadDays: r.ahead_days,
    active: r.active,
    createdBy: r.created_by,
  };
}

export async function getStandingRule(id: string): Promise<StandingRule | null> {
  const rows = await db<RuleRow[]>`
    SELECT r.id, r.offer_id, o.thread_id, r.weekdays, r.times, r.capacity, r.guide_user_id, r.valid_from, r.valid_until,
           r.ahead_days, r.active, r.created_by
    FROM booking_standing_rules r JOIN booking_offers o ON o.id = r.offer_id
    WHERE r.id = ${id} AND r.org_id = ${ORG}
  `;
  return rows[0] ? ruleFromRow(rows[0]) : null;
}

export interface MaterialiseResult {
  /** Slots made. */
  created: number;
  /** Candidates not made: past, booking already closed, or a duplicate raced in. */
  skipped: number;
  /** Last day covered. */
  through: string;
}

/**
 * Make the slots a rule still lacks, from today to its horizon. Starts that already have a slot (cancelled ones
 * too) are not sent. Overlap with the guide's other runs is allowed: the rule was warned about when it was saved.
 */
export async function materialiseRule(rule: StandingRule, now: Date = new Date()): Promise<MaterialiseResult> {
  const today = parisToday(now);
  const starts = standingStarts(rule, today).filter((s) => s.at.getTime() > now.getTime());
  const through = rule.validUntil && rule.validUntil < addDays(today, rule.aheadDays) ? rule.validUntil : addDays(today, rule.aheadDays);
  if (starts.length === 0) return { created: 0, skipped: 0, through };
  const lo = starts[0]!.at;
  const hi = new Date(starts[starts.length - 1]!.at.getTime() + 1000);
  const have = await db<{ starts_at: Date }[]>`
    SELECT starts_at FROM booking_slots
    WHERE org_id = ${ORG} AND offer_id = ${rule.offerId} AND starts_at >= ${lo} AND starts_at < ${hi}
  `;
  const taken = new Set(have.map((h) => new Date(h.starts_at).getTime()));
  const todo = starts.filter((s) => !taken.has(s.at.getTime()));
  let created = 0;
  let skipped = 0;
  for (let i = 0; i < todo.length; i += CHUNK) {
    const slots: NewSlot[] = todo.slice(i, i + CHUNK).map((s) => ({
      startsAt: s.at.toISOString(),
      capacity: rule.capacity,
      ...(rule.guideUserId ? { guideUserId: rule.guideUserId } : {}),
      source: "rule" as const,
      standingRuleId: rule.id,
    }));
    const r = await createBookingSlots({ orgId: ORG, offerId: rule.offerId, slots, allowClash: true });
    if (r.ok === false) throw new Error(r.error);
    created += r.created.length;
    skipped += slots.length - r.created.length;
  }
  await db`UPDATE booking_standing_rules SET generated_through = ${through}::date, updated_at = NOW() WHERE id = ${rule.id} AND org_id = ${ORG}`;
  return { created, skipped, through };
}

let missingTableLogged = false;

/** Top up every active rule of the site. Run hourly from instrumentation.ts; safe on several instances (idempotent). */
export async function topUpStandingRules(): Promise<{ rules: number; created: number } | null> {
  if (process.env.BOOKING_TABLES !== "1") return null;
  let rows: RuleRow[];
  try {
    rows = await db<RuleRow[]>`
      SELECT r.id, r.offer_id, o.thread_id, r.weekdays, r.times, r.capacity, r.guide_user_id, r.valid_from, r.valid_until,
             r.ahead_days, r.active, r.created_by
      FROM booking_standing_rules r JOIN booking_offers o ON o.id = r.offer_id
      WHERE r.org_id = ${ORG} AND r.active AND o.status = 'open'
    `;
  } catch (err) {
    // Migration 291 not applied yet.
    if ((err as { code?: string }).code === "42P01") {
      if (!missingTableLogged) console.warn("[elktours] standing rules: booking_standing_rules is missing (migration 291)");
      missingTableLogged = true;
      return null;
    }
    throw err;
  }
  let created = 0;
  for (const row of rows) {
    try {
      const offer = await getOfferByThread(ORG, row.thread_id);
      if (!offer || offer.mode !== "set_dates") continue;
      created += (await materialiseRule(ruleFromRow(row))).created;
    } catch (err) {
      console.error("[elktours] standing rule", row.id, err);
    }
  }
  return { rules: rows.length, created };
}

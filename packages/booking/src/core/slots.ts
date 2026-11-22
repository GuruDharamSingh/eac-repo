/**
 * Slot state and rules for set-dates offers (tour departures): pure, no
 * database, so the guest Dates screen, the board and the server share one
 * answer. Ported from the elktours mobile prototype (`stateOf`, `ruleText`
 * in pack/Elkdonis App.dc.html, 2026-11-15) so the wording matches.
 *
 * close = start minus the cutoff. Before close the slot is open. After close
 * with enough booked it is confirmed. After close below the minimum it
 * depends on the site rule: the guide decides ("Needs your call": run it,
 * reopen booking, or cancel and refund), or it is cancelled automatically.
 */

export type BelowMinimumRule = "guide_decides" | "auto_cancel";

export type SlotStateKey = "cancelled" | "past" | "open" | "confirmed" | "below";

/** How a UI may colour the state line (the palette itself is the UI's concern). */
export type SlotTone = "muted" | "ok" | "short" | "confirmed" | "attention";

export interface SlotStateInput {
  /** Start and end, ISO string or Date. */
  startsAt: string | Date;
  endsAt: string | Date;
  /** The stored slot status. */
  status: "scheduled" | "cancelled";
  /** The guide chose to run it below the minimum. */
  runDecision?: "run" | null;
  /** Places taken (confirmed plus live holds). */
  booked: number;
  capacity: number;
  /** "Runs with N or more"; null means 1. */
  minToRun: number | null;
  closeBeforeMinutes: number;
  rule: BelowMinimumRule;
  now?: Date;
}

export interface SlotState {
  key: SlotStateKey;
  label: string;
  tone: SlotTone;
  closesAt: Date;
  start: Date;
  end: Date;
  full: boolean;
  /** Places still needed to reach the minimum (0 when reached). */
  shortBy: number;
  minimumReached: boolean;
  /** Open slots only: "N short of the minimum" or "Minimum reached". */
  note: string | null;
  /** True when the slot is cancelled by the below-minimum rule rather than by hand. */
  auto: boolean;
}

const toDate = (v: string | Date): Date => (v instanceof Date ? v : new Date(v));

/** When booking closes: the start minus the cutoff. */
export function closesAt(startsAt: string | Date, closeBeforeMinutes: number): Date {
  return new Date(toDate(startsAt).getTime() - Math.max(0, closeBeforeMinutes) * 60000);
}

/** "12 min", "3h 5m", "2d 4h" (the prototype's `left`). */
export function formatLeft(ms: number): string {
  const t = Math.max(1, Math.round(ms / 60000));
  if (t < 60) return `${t} min`;
  const h = Math.floor(t / 60);
  if (h < 24) return `${h}h ${t % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/** "6h", "1 day", "2 days", "1d 6h" (the prototype's `cutLabel`), from hours. */
export function cutoffLabel(hours: number): string {
  if (hours < 24) return `${hours}h`;
  if (hours % 24 === 0) return hours === 24 ? "1 day" : `${hours / 24} days`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function slotState(input: SlotStateInput): SlotState {
  const now = input.now ?? new Date();
  const start = toDate(input.startsAt);
  const end = toDate(input.endsAt);
  const close = closesAt(start, input.closeBeforeMinutes);
  // No minimum: none set, or 1 (the way a slot says "None": a slot with nobody booked has nothing to run).
  const min = input.minToRun != null && input.minToRun > 1 ? input.minToRun : null;
  const shortBy = min == null ? 0 : Math.max(0, min - input.booked);
  const full = input.booked >= input.capacity;
  const base = { closesAt: close, start, end, full, shortBy, minimumReached: shortBy === 0, note: null as string | null, auto: false };

  if (input.status === "cancelled") return { ...base, key: "cancelled", label: "Cancelled · guests refunded", tone: "muted" };
  if (end.getTime() < now.getTime()) return { ...base, key: "past", label: "Finished", tone: "muted" };
  if (now.getTime() < close.getTime()) {
    return {
      ...base,
      key: "open",
      label: `${full ? "Full · " : ""}Booking closes in ${formatLeft(close.getTime() - now.getTime())}`,
      tone: shortBy ? "short" : "ok",
      note: min == null ? null : shortBy ? `${shortBy} short of the minimum` : "Minimum reached",
    };
  }
  if (min == null || input.booked >= min) {
    return { ...base, key: "confirmed", label: full ? "Full · confirmed" : "Confirmed · booking closed", tone: "confirmed" };
  }
  if (input.runDecision === "run") return { ...base, key: "confirmed", label: "Running below minimum", tone: "confirmed" };
  if (input.rule === "auto_cancel") {
    return { ...base, key: "cancelled", label: "Auto-cancelled · below minimum", tone: "muted", auto: true };
  }
  return { ...base, key: "below", label: `Needs your call · ${input.booked} of ${min} minimum`, tone: "attention" };
}

/**
 * The rule in plain words, shown on Dates, Pay and New slots. `guideShort`
 * is the guide's short name ("Dana").
 */
export function bookingRuleText(input: { rule: BelowMinimumRule; min: number; guideShort: string }): string {
  if (input.min <= 1) return ""; // no minimum, no rule to state
  const lead = `It runs with at least ${input.min} guests. If fewer have booked when booking closes, `;
  return input.rule === "auto_cancel"
    ? `${lead}it is cancelled automatically and you are refunded in full.`
    : `${lead}${input.guideShort} decides whether it goes ahead; if it is cancelled you are refunded in full.`;
}

/** The one-line rule under the minimum and maximum steppers on New slots. */
export function minimumRuleText(input: { rule: BelowMinimumRule; min: number; max: number }): string {
  if (input.min <= 1) return `No minimum: every slot runs, however many book. Holds ${input.max}.`;
  return input.rule === "auto_cancel"
    ? `Runs with ${input.min} or more, holds ${input.max}. Below ${input.min} when booking closes, the slot cancels itself and guests are refunded.`
    : `Runs with ${input.min} or more, holds ${input.max}. Below ${input.min} when booking closes, you decide: run it, reopen booking, or cancel.`;
}

// ── new-slot checks ───────────────────────────────────────────────────────

export interface SlotSpan {
  startsAt: string | Date;
  endsAt: string | Date;
}

export interface ExistingSlot extends SlotSpan {
  id?: string;
  guideUserId: string | null;
  status: "scheduled" | "cancelled";
  /** Anything the caller wants back (a tour title, ...). */
  label?: string;
}

/**
 * The first scheduled slot of the same guide whose time overlaps the
 * candidate (touching ends do not overlap), or null. A candidate with no
 * guide never clashes.
 */
export function findClash<T extends ExistingSlot>(candidate: SlotSpan & { guideUserId: string | null }, existing: readonly T[]): T | null {
  if (!candidate.guideUserId) return null;
  const s = toDate(candidate.startsAt).getTime();
  const e = toDate(candidate.endsAt).getTime();
  for (const x of existing) {
    if (x.status !== "scheduled" || x.guideUserId !== candidate.guideUserId) continue;
    const s2 = toDate(x.startsAt).getTime();
    const e2 = toDate(x.endsAt).getTime();
    if (s2 < e && s < e2) return x;
  }
  return null;
}

/** Whether booking would already be closed if the slot were created now. */
export function closedAlready(startsAt: string | Date, closeBeforeMinutes: number, now: Date = new Date()): boolean {
  return closesAt(startsAt, closeBeforeMinutes).getTime() <= now.getTime();
}

export type NewSlotProblem = "clash" | "closed" | "past";

/** One preview row: why a candidate cannot be created, or ok when it is ready. */
export function checkNewSlot<T extends ExistingSlot>(input: {
  candidate: SlotSpan & { guideUserId: string | null };
  closeBeforeMinutes: number;
  existing: readonly T[];
  now?: Date;
}): { ok: true } | { ok: false; reason: NewSlotProblem; clashWith?: T; message: string } {
  const now = input.now ?? new Date();
  if (toDate(input.candidate.startsAt).getTime() <= now.getTime()) {
    return { ok: false, reason: "past", message: "That time has already passed." };
  }
  const clash = findClash(input.candidate, input.existing);
  if (clash) {
    return { ok: false, reason: "clash", clashWith: clash, message: `Clashes with ${clash.label ?? "another slot"}` };
  }
  if (closedAlready(input.candidate.startsAt, input.closeBeforeMinutes, now)) {
    return { ok: false, reason: "closed", message: "Booking would already be closed. Shorten the cutoff." };
  }
  return { ok: true };
}

// ── per-slot settings (migration draft: booking_slots_per_slot_columns.sql) ──

/** What a slot overrides; undefined or null = use the offer's value. */
export interface SlotOverrides {
  minToRun?: number | null;
  closeBeforeMinutes?: number | null;
  waitlistCap?: number | null;
  priceMinor?: number | null;
}

export interface ResolvedSlotSettings {
  minToRun: number | null;
  closeBeforeMinutes: number;
  waitlistCap: number | null;
  priceMinor: number | null;
}

/** COALESCE(slot, offer) for each setting. The offer has no waitlist size or price of its own. */
export function resolveSlotSettings(
  offer: { minToRun: number | null; closeBeforeMinutes: number },
  slot: SlotOverrides = {}
): ResolvedSlotSettings {
  return {
    minToRun: slot.minToRun ?? offer.minToRun,
    closeBeforeMinutes: slot.closeBeforeMinutes ?? offer.closeBeforeMinutes,
    waitlistCap: slot.waitlistCap ?? null,
    priceMinor: slot.priceMinor ?? null,
  };
}

/**
 * The cutoff (minutes before the start) that makes booking close `hours`
 * from now: "Reopen booking for 24 hours". Never negative: a start closer
 * than that closes at the start.
 */
export function reopenCloseBeforeMinutes(startsAt: string | Date, hours: number, now: Date = new Date()): number {
  const minutesToStart = (toDate(startsAt).getTime() - now.getTime()) / 60000;
  return Math.max(0, Math.floor(minutesToStart - Math.max(0, hours) * 60));
}

/** The cutoff that closes booking right now ("Close booking now"). */
export function closeNowCloseBeforeMinutes(startsAt: string | Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((toDate(startsAt).getTime() - now.getTime()) / 60000));
}

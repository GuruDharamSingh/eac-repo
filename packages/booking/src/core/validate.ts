/**
 * Validation of what a form sends for an offer (`BookingOfferInput`), shared
 * by the Booking section (to show the sentence early) and the server (which
 * decides). Returns a cleaned value or one sentence for the person editing.
 */

import {
  ACCEPTED_MODES,
  type BookingOfferInput,
  type HoursRange,
  type IntakeQuestion,
  type AcceptedMode,
} from "./types";
import { formatClock, isValidTimeZone, parseClock } from "./time";

export const DEFAULT_OFFER_INPUT: BookingOfferInput = {
  mode: "open_hours",
  durationMinutes: 60,
  timeZone: "America/Toronto",
  hours: [],
  leadTimeMinutes: 720,
  maxAheadDays: 60,
  bufferMinutes: 0,
  approval: "instant",
  cancelFreeUntilMinutes: 1440,
  cancelRefundPercentAfter: 0,
  cancelPolicyText: null,
  questions: [],
  status: "open",
  reminderMinutesBefore: 1440,
};

export const MAX_HOURS_RANGES = 28;
export const MAX_QUESTIONS = 6;

function int(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function text(v: unknown, max: number): string | null {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s || null;
}

export type ValidateResult = { ok: true; value: BookingOfferInput } | { ok: false; error: string };

export function validateOfferInput(raw: unknown): ValidateResult {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Booking settings are missing." };
  const r = raw as Record<string, unknown>;

  const mode = r.mode as AcceptedMode;
  if (!(ACCEPTED_MODES as readonly string[]).includes(mode as string)) {
    return { ok: false, error: "Choose open hours, set dates or ask for a time." };
  }

  const duration = int(r.durationMinutes);
  if (duration == null || duration < 5 || duration > 1440) {
    return { ok: false, error: "Length must be between 5 minutes and 24 hours." };
  }

  const timeZone = isValidTimeZone(r.timeZone) ? (r.timeZone as string) : null;
  if (!timeZone) return { ok: false, error: "Choose a time zone." };

  const rawHours = Array.isArray(r.hours) ? r.hours : [];
  if (rawHours.length > MAX_HOURS_RANGES) return { ok: false, error: `At most ${MAX_HOURS_RANGES} hours ranges.` };
  const hours: HoursRange[] = [];
  for (const h of rawHours) {
    const o = (h ?? {}) as Record<string, unknown>;
    const weekday = int(o.weekday);
    const from = parseClock(o.from);
    const to = parseClock(o.to);
    if (weekday == null || weekday < 0 || weekday > 6) return { ok: false, error: "A day in your hours could not be read." };
    if (from == null || to == null) return { ok: false, error: "A time in your hours could not be read." };
    if (to <= from) return { ok: false, error: "Each hours range must end after it starts." };
    if (to - from < duration) return { ok: false, error: "Each hours range must be at least as long as one booking." };
    hours.push({ weekday, from: formatClock(from), to: formatClock(to) });
  }
  hours.sort((a, b) => a.weekday - b.weekday || a.from.localeCompare(b.from));
  for (let i = 1; i < hours.length; i++) {
    const a = hours[i - 1];
    const b = hours[i];
    if (a.weekday === b.weekday && b.from < a.to) return { ok: false, error: "Two hours ranges on the same day overlap." };
  }
  if (mode === "open_hours" && hours.length === 0) return { ok: false, error: "Add at least one hours range." };

  const validFrom = typeof r.validFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.validFrom) ? r.validFrom : null;

  const step = int(r.slotStepMinutes);
  if (step != null && (step < 5 || step > 1440)) return { ok: false, error: "Start times must be 5 minutes to 24 hours apart." };
  const buffer = int(r.bufferMinutes) ?? 0;
  if (buffer < 0 || buffer > 720) return { ok: false, error: "The break between bookings must be under 12 hours." };
  const capacity = int(r.capacityPerSlot);
  if (capacity != null && (capacity < 1 || capacity > 500)) return { ok: false, error: "Places must be between 1 and 500." };
  const lead = int(r.leadTimeMinutes) ?? DEFAULT_OFFER_INPUT.leadTimeMinutes!;
  if (lead < 0 || lead > 60 * 24 * 60) return { ok: false, error: "Notice must be under 60 days." };
  const ahead = int(r.maxAheadDays) ?? DEFAULT_OFFER_INPUT.maxAheadDays!;
  if (ahead < 1 || ahead > 366) return { ok: false, error: "Booking ahead must be between 1 and 366 days." };

  // Phase 2 fields. Omitted stays omitted (undefined) so an update keeps what is stored.
  const minParty = r.minParty === undefined ? undefined : int(r.minParty);
  const maxParty = r.maxParty === undefined ? undefined : int(r.maxParty);
  if (minParty === null || (minParty !== undefined && (minParty < 1 || minParty > 500))) {
    return { ok: false, error: "The smallest party must be between 1 and 500." };
  }
  if (maxParty === null || (maxParty !== undefined && (maxParty < 1 || maxParty > 500))) {
    return { ok: false, error: "The largest party must be between 1 and 500." };
  }
  if (minParty !== undefined && maxParty !== undefined && maxParty < minParty) {
    return { ok: false, error: "The largest party cannot be smaller than the smallest." };
  }
  if (r.priceUnit !== undefined && r.priceUnit !== "per_booking" && r.priceUnit !== "per_person") {
    return { ok: false, error: "Price is per booking or per person." };
  }
  const minToRun = r.minToRun === undefined ? undefined : r.minToRun === null || r.minToRun === "" ? null : int(r.minToRun);
  if (minToRun !== undefined && minToRun !== null && (minToRun < 1 || minToRun > 500)) {
    return { ok: false, error: "The minimum to run must be between 1 and 500." };
  }
  if (minToRun != null && capacity != null && minToRun > capacity) {
    return { ok: false, error: "The minimum to run cannot be more than the places." };
  }
  const closeBefore = r.closeBeforeMinutes === undefined ? undefined : int(r.closeBeforeMinutes);
  if (closeBefore === null || (closeBefore !== undefined && (closeBefore < 0 || closeBefore > 60 * 24 * 60))) {
    return { ok: false, error: "Booking must close less than 60 days before the start." };
  }
  if (r.waitlist !== undefined && typeof r.waitlist !== "boolean") return { ok: false, error: "The waitlist is on or off." };
  if (mode === "set_dates" && capacity == null) return { ok: false, error: "Set the number of places for each date." };

  const approval = r.approval === "seller_confirms" ? "seller_confirms" : "instant";

  const freeUntil = int(r.cancelFreeUntilMinutes);
  if (freeUntil != null && freeUntil < 0) return { ok: false, error: "Free cancellation must be zero or more hours before." };
  const percentAfter = int(r.cancelRefundPercentAfter);
  if (percentAfter != null && (percentAfter < 0 || percentAfter > 100)) {
    return { ok: false, error: "The refund after that must be between 0 and 100 percent." };
  }

  const rawQuestions = Array.isArray(r.questions) ? r.questions : [];
  if (rawQuestions.length > MAX_QUESTIONS) return { ok: false, error: `At most ${MAX_QUESTIONS} questions.` };
  const questions: IntakeQuestion[] = [];
  rawQuestions.forEach((q, i) => {
    const o = (q ?? {}) as Record<string, unknown>;
    const label = text(o.label, 200);
    if (!label) return;
    const key = (typeof o.key === "string" && /^[a-z0-9_]{1,40}$/.test(o.key) ? o.key : `q${i + 1}`);
    questions.push({ key, label, required: Boolean(o.required) });
  });

  const status = r.status === "paused" || r.status === "closed" ? r.status : "open";

  const reminder = r.reminderMinutesBefore === null ? null : int(r.reminderMinutesBefore) ?? 1440;
  if (reminder != null && (reminder < 1 || reminder > 20160)) return { ok: false, error: "The reminder must be under two weeks before." };

  return {
    ok: true,
    value: {
      mode,
      durationMinutes: duration,
      timeZone,
      hours,
      validFrom,
      slotStepMinutes: step,
      bufferMinutes: buffer,
      capacityPerSlot: capacity,
      leadTimeMinutes: lead,
      maxAheadDays: ahead,
      // Ask-for-a-time is always the host's to confirm (design §2.1, approval).
      // Set dates are booked instantly: nothing in this flow asks a host to confirm a departure.
      approval: mode === "request_time" ? "seller_confirms" : mode === "set_dates" ? "instant" : approval,
      cancelFreeUntilMinutes: freeUntil,
      cancelRefundPercentAfter: percentAfter,
      cancelPolicyText: text(r.cancelPolicyText, 2000),
      questions,
      status,
      reminderMinutesBefore: reminder,
      ...(minParty !== undefined ? { minParty } : {}),
      ...(maxParty !== undefined ? { maxParty } : {}),
      ...(r.priceUnit !== undefined ? { priceUnit: r.priceUnit as "per_booking" | "per_person" } : {}),
      ...(minToRun !== undefined ? { minToRun } : {}),
      ...(closeBefore !== undefined ? { closeBeforeMinutes: closeBefore } : {}),
      ...(r.waitlist !== undefined ? { waitlist: r.waitlist as boolean } : {}),
    },
  };
}

/** Answers to the intake questions: required ones present, each trimmed. */
export function cleanAnswers(
  questions: IntakeQuestion[],
  raw: unknown
): { ok: true; answers: Record<string, string> } | { ok: false; error: string } {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const answers: Record<string, string> = {};
  for (const q of questions) {
    const v = typeof r[q.key] === "string" ? (r[q.key] as string).trim().slice(0, 2000) : "";
    if (!v && q.required) return { ok: false, error: `Answer “${q.label}”.` };
    if (v) answers[q.key] = v;
  }
  return { ok: true, answers };
}

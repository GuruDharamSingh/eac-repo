// Checks of @elkdonis/booking/core (pure: no database). Run inside a container:
//   cd packages/booking && <tsx> scripts/check-core.mts
import {
  bookingRuleText,
  checkNewSlot,
  closedAlready,
  closesAt,
  computeOpenSlots,
  cutoffLabel,
  describePolicy,
  findClash,
  formatLeft,
  minimumRuleText,
  slotState,
  closeNowCloseBeforeMinutes,
  refundShare,
  reopenCloseBeforeMinutes,
  resolveSlotSettings,
  slotKey,
  validateOfferInput,
  zonedParts,
  zonedToInstant,
  type BookingOffer,
} from "../src/core/index.ts";

let pass = 0;
let fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) pass++;
  else {
    fail++;
    console.log(`FAIL ${name}\n  got  ${g}\n  want ${w}`);
  }
}

// Time zones
eq("toronto winter", zonedToInstant("2026-11-16", 600, "America/Toronto").toISOString(), "2026-11-16T15:00:00.000Z");
eq("toronto summer", zonedToInstant("2026-07-06", 600, "America/Toronto").toISOString(), "2026-07-06T14:00:00.000Z");
eq("paris winter", zonedToInstant("2026-11-16", 600, "Europe/Paris").toISOString(), "2026-11-16T09:00:00.000Z");
eq("fall back, first 01:30", zonedToInstant("2026-11-01", 90, "America/Toronto").toISOString(), "2026-11-01T05:30:00.000Z");
eq("spring gap 02:30 maps forward to 03:30 EDT", zonedToInstant("2026-03-08", 150, "America/Toronto").toISOString(), "2026-03-08T07:30:00.000Z");
eq("parts", zonedParts(new Date("2026-11-16T15:00:00Z"), "America/Toronto"), { date: "2026-11-16", weekday: 1, minutes: 600 });

// Open hours
const offer: Parameters<typeof computeOpenSlots>[0]["offer"] = {
  id: "o1",
  durationMinutes: 60,
  slotStepMinutes: null,
  bufferMinutes: 0,
  timeZone: "America/Toronto",
  capacityPerSlot: 1,
  leadTimeMinutes: 0,
  closeBeforeMinutes: 0,
  maxAheadDays: 7,
  minParty: 1,
  hours: [{ weekday: 1, from: "10:00", to: "12:00" }],
  validFrom: null,
};
const now = new Date("2026-11-15T17:00:00Z"); // Sunday noon in Toronto
const base = { offer, busy: [], taken: new Map<number, number>(), now };
eq("two monday slots", computeOpenSlots(base).map((s) => s.startsAt), ["2026-11-16T15:00:00.000Z", "2026-11-16T16:00:00.000Z"]);
const t10 = Date.parse("2026-11-16T15:00:00Z");
eq("taken slot drops", computeOpenSlots({ ...base, taken: new Map([[t10, 1]]), busy: [{ startMs: t10, endMs: t10 + 3600000, slotKey: slotKey("o1", t10) }] }).map((s) => s.startsAt), ["2026-11-16T16:00:00.000Z"]);
eq("other offering overlap blocks both", computeOpenSlots({ ...base, busy: [{ startMs: t10 + 1800000, endMs: t10 + 5400000 }] }).length, 0);
eq("buffer blocks the slot before", computeOpenSlots({ ...base, offer: { ...offer, bufferMinutes: 15 }, busy: [{ startMs: t10 + 3600000 + 600000, endMs: t10 + 7200000 }] }).map((s) => s.startsAt), []);
eq("step 30", computeOpenSlots({ ...base, offer: { ...offer, slotStepMinutes: 30 } }).length, 3);
eq("lead time 24h hides monday 10:00 and 11:00", computeOpenSlots({ ...base, offer: { ...offer, leadTimeMinutes: 1440 } }).length, 0);
eq("capacity 3 keeps a partly taken slot", computeOpenSlots({ ...base, offer: { ...offer, capacityPerSlot: 3 }, taken: new Map([[t10, 2]]), busy: [{ startMs: t10, endMs: t10 + 3600000, slotKey: slotKey("o1", t10) }] })[0]?.seatsLeft, 1);
eq("cancelled slot drops", computeOpenSlots({ ...base, cancelled: new Set([t10]) }).length, 1);
eq("validFrom in the future", computeOpenSlots({ ...base, offer: { ...offer, validFrom: "2026-11-20" } }).length, 0);

// Validation
const good = { mode: "open_hours", durationMinutes: 60, timeZone: "America/Toronto", hours: [{ weekday: 1, from: "10:00", to: "12:00" }] };
eq("valid", validateOfferInput(good).ok, true);
eq("request_time forces seller_confirms", (validateOfferInput({ ...good, mode: "request_time", approval: "instant" }) as { value: { approval: string } }).value.approval, "seller_confirms");
eq("no hours", validateOfferInput({ ...good, hours: [] }), { ok: false, error: "Add at least one hours range." });
eq("overlap", validateOfferInput({ ...good, hours: [{ weekday: 1, from: "10:00", to: "12:00" }, { weekday: 1, from: "11:00", to: "13:00" }] }).ok, false);
eq("range shorter than length", validateOfferInput({ ...good, hours: [{ weekday: 1, from: "10:00", to: "10:30" }] }).ok, false);
eq("bad zone", validateOfferInput({ ...good, timeZone: "Mars/Base" }).ok, false);
eq("sessions still refused", validateOfferInput({ ...good, mode: "sessions" }).ok, false);
eq("rsvp still refused", validateOfferInput({ ...good, mode: "rsvp" }).ok, false);
// set_dates (phase 2)
const dated = { mode: "set_dates", durationMinutes: 150, timeZone: "Europe/Paris", hours: [], capacityPerSlot: 8 };
eq("set_dates needs no hours", validateOfferInput(dated).ok, true);
eq("set_dates needs places", validateOfferInput({ ...dated, capacityPerSlot: null }), { ok: false, error: "Set the number of places for each date." });
eq("set_dates forces instant", (validateOfferInput({ ...dated, approval: "seller_confirms" }) as { value: { approval: string } }).value.approval, "instant");
{
  const v = (validateOfferInput({ ...dated, minParty: 1, maxParty: 6, priceUnit: "per_person", minToRun: 4, closeBeforeMinutes: 1440, waitlist: true }) as { value: Record<string, unknown> }).value;
  eq("phase 2 fields pass through", [v.minParty, v.maxParty, v.priceUnit, v.minToRun, v.closeBeforeMinutes, v.waitlist], [1, 6, "per_person", 4, 1440, true]);
}
{
  const v = (validateOfferInput(good) as { value: Record<string, unknown> }).value;
  eq("phase 1 input has no phase 2 keys", ["minParty", "maxParty", "priceUnit", "minToRun", "closeBeforeMinutes", "waitlist"].filter((k) => k in v), []);
}
eq("max below min", validateOfferInput({ ...dated, minParty: 5, maxParty: 2 }).ok, false);
eq("minToRun above places", validateOfferInput({ ...dated, minToRun: 9 }).ok, false);
eq("bad price unit", validateOfferInput({ ...dated, priceUnit: "per_hour" }).ok, false);
eq("minToRun null clears", (validateOfferInput({ ...dated, minToRun: null }) as { value: { minToRun: null } }).value.minToRun, null);
eq("reminder defaults to a day", (validateOfferInput(good) as { value: { reminderMinutesBefore: number } }).value.reminderMinutesBefore, 1440);
eq("reminder off", (validateOfferInput({ ...good, reminderMinutesBefore: null }) as { value: { reminderMinutesBefore: null } }).value.reminderMinutesBefore, null);
eq("reminder too far", validateOfferInput({ ...good, reminderMinutesBefore: 30000 }).ok, false);

// Refund policy
const pol = { cancelFreeUntilMinutes: 1440, cancelRefundPercentAfter: 50 };
const start = "2026-11-20T15:00:00.000Z";
eq("free window", refundShare({ offer: pol, scheduledAt: start, cancelledAt: new Date("2026-11-18T15:00:00Z"), paidMinor: 8000, by: "booker" }), { percent: 100, amountMinor: 8000 });
eq("after window", refundShare({ offer: pol, scheduledAt: start, cancelledAt: new Date("2026-11-20T10:00:00Z"), paidMinor: 8000, by: "booker" }), { percent: 50, amountMinor: 4000 });
eq("host cancels", refundShare({ offer: pol, scheduledAt: start, cancelledAt: new Date("2026-11-20T14:00:00Z"), paidMinor: 8000, by: "seller" }), { percent: 100, amountMinor: 8000 });
eq("no policy", refundShare({ offer: { cancelFreeUntilMinutes: null, cancelRefundPercentAfter: null }, scheduledAt: start, cancelledAt: new Date(), paidMinor: 8000, by: "booker" }), { percent: null, amountMinor: null });
eq("free booking", refundShare({ offer: pol, scheduledAt: start, cancelledAt: new Date(), paidMinor: 0, by: "booker" }), { percent: 0, amountMinor: 0 });
eq("describe", describePolicy({ cancelPolicyText: null, cancelFreeUntilMinutes: 1440, cancelRefundPercentAfter: 0 }), "Cancel up to 1 day before for a full refund; no refund after that.");
eq("describe half", describePolicy({ cancelPolicyText: null, cancelFreeUntilMinutes: 2880, cancelRefundPercentAfter: 50 }), "Cancel up to 2 days before for a full refund; a 50% refund after that.");

// Slot state (ported from the elktours mobile prototype)
{
  const start = "2026-11-21T09:00:00.000Z"; // Sat 21 Nov, 10:00 Paris
  const end = "2026-11-21T11:30:00.000Z";
  const mk = (over: Record<string, unknown>) => ({ startsAt: start, endsAt: end, status: "scheduled" as const, booked: 2, capacity: 8, minToRun: 4, closeBeforeMinutes: 24 * 60, rule: "guide_decides" as const, ...over });
  const before = new Date("2026-11-18T09:00:00Z"); // 3 days out, 2 before close
  const after = new Date("2026-11-20T12:00:00Z"); // past close (Fri 10:00 UTC... close = Fri 09:00Z)
  eq("closesAt", closesAt(start, 1440).toISOString(), "2026-11-20T09:00:00.000Z");
  eq("open short", [slotState(mk({ now: before })).key, slotState(mk({ now: before })).label, slotState(mk({ now: before })).note], ["open", "Booking closes in 2d 0h", "2 short of the minimum"]);
  eq("open reached", slotState(mk({ now: before, booked: 4 })).note, "Minimum reached");
  eq("open full label", slotState(mk({ now: before, booked: 8 })).label, "Full · Booking closes in 2d 0h");
  eq("confirmed after close", slotState(mk({ now: after, booked: 4 })).label, "Confirmed · booking closed");
  eq("full confirmed", slotState(mk({ now: after, booked: 8 })).label, "Full · confirmed");
  eq("below, guide decides", [slotState(mk({ now: after })).key, slotState(mk({ now: after })).label], ["below", "Needs your call · 2 of 4 minimum"]);
  eq("below, run decision", slotState(mk({ now: after, runDecision: "run" })).label, "Running below minimum");
  eq("below, auto cancel", [slotState(mk({ now: after, rule: "auto_cancel" })).key, slotState(mk({ now: after, rule: "auto_cancel" })).label, slotState(mk({ now: after, rule: "auto_cancel" })).auto], ["cancelled", "Auto-cancelled · below minimum", true]);
  eq("cancelled by hand", slotState(mk({ now: before, status: "cancelled" })).label, "Cancelled · guests refunded");
  eq("finished", slotState(mk({ now: new Date("2026-11-22T00:00:00Z") })).label, "Finished");
  eq("null minimum counts as 1", slotState(mk({ now: after, booked: 1, minToRun: null })).key, "confirmed");
  eq("formatLeft", [formatLeft(5 * 60000), formatLeft(125 * 60000), formatLeft(52 * 3600000), formatLeft(10)], ["5 min", "2h 5m", "2d 4h", "1 min"]);
  eq("cutoffLabel", [6, 24, 48, 30].map(cutoffLabel), ["6h", "1 day", "2 days", "1d 6h"]);
  eq("rule guide", bookingRuleText({ rule: "guide_decides", min: 4, guideShort: "Dana" }), "It runs with at least 4 guests. If fewer have booked when booking closes, Dana decides whether it goes ahead; if it is cancelled you are refunded in full.");
  eq("rule auto", bookingRuleText({ rule: "auto_cancel", min: 4, guideShort: "Dana" }), "It runs with at least 4 guests. If fewer have booked when booking closes, it is cancelled automatically and you are refunded in full.");
  eq("min rule guide", minimumRuleText({ rule: "guide_decides", min: 4, max: 10 }), "Runs with 4 or more, holds 10. Below 4 when booking closes, you decide: run it, reopen booking, or cancel.");
  eq("min rule auto", minimumRuleText({ rule: "auto_cancel", min: 4, max: 10 }), "Runs with 4 or more, holds 10. Below 4 when booking closes, the slot cancels itself and guests are refunded.");
}
// Clash and closed-in-past
{
  const ex = [
    { id: "a", guideUserId: "g1", status: "scheduled" as const, startsAt: "2026-11-24T09:00:00Z", endsAt: "2026-11-24T11:30:00Z", label: "Latin Quarter at 10:00" },
    { id: "b", guideUserId: "g1", status: "cancelled" as const, startsAt: "2026-11-25T09:00:00Z", endsAt: "2026-11-25T11:30:00Z" },
    { id: "c", guideUserId: "g2", status: "scheduled" as const, startsAt: "2026-11-26T09:00:00Z", endsAt: "2026-11-26T11:30:00Z" },
  ];
  const cand = (h: number, m: number, g: string | null, day = 24) => ({ startsAt: new Date(Date.UTC(2026, 10, day, h, m)), endsAt: new Date(Date.UTC(2026, 10, day, h + 2, m + 30)), guideUserId: g });
  eq("clash overlapping", findClash(cand(10, 0, "g1"), ex)?.id, "a");
  eq("touching ends do not clash", findClash(cand(11, 30, "g1"), ex)?.id ?? null, null);
  eq("other guide no clash", findClash(cand(9, 0, "g2"), ex)?.id ?? null, null);
  eq("cancelled ignored", findClash(cand(9, 0, "g1", 25), ex)?.id ?? null, null);
  eq("no guide never clashes", findClash(cand(9, 0, null), ex)?.id ?? null, null);
  const now = new Date("2026-11-23T12:00:00Z");
  eq("closed already", [closedAlready("2026-11-24T09:00:00Z", 1440, now), closedAlready("2026-11-24T09:00:00Z", 1200, now)], [true, false]);
  const r1 = checkNewSlot({ candidate: cand(9, 0, "g1"), closeBeforeMinutes: 60, existing: ex, now });
  eq("check clash", [r1.ok, !r1.ok && r1.reason, !r1.ok && r1.message], [false, "clash", "Clashes with Latin Quarter at 10:00"]);
  const r2 = checkNewSlot({ candidate: cand(14, 0, "g1"), closeBeforeMinutes: 1800, existing: ex, now });
  eq("check closed", [!r2.ok && r2.reason, !r2.ok && r2.message], ["closed", "Booking would already be closed. Shorten the cutoff."]);
  eq("check past", (checkNewSlot({ candidate: cand(9, 0, "g1", 20), closeBeforeMinutes: 0, existing: ex, now }) as { reason: string }).reason, "past");
  eq("check ready", checkNewSlot({ candidate: cand(14, 0, "g1"), closeBeforeMinutes: 360, existing: ex, now }).ok, true);
}

// Per-slot settings, reopen, close now
{
  const offerSettings = { minToRun: 4, closeBeforeMinutes: 1440 };
  eq("resolve: slot inherits", resolveSlotSettings(offerSettings), { minToRun: 4, closeBeforeMinutes: 1440, waitlistCap: null, priceMinor: null });
  eq("resolve: slot overrides", resolveSlotSettings(offerSettings, { minToRun: 2, closeBeforeMinutes: 60, waitlistCap: 5, priceMinor: 3000 }), { minToRun: 2, closeBeforeMinutes: 60, waitlistCap: 5, priceMinor: 3000 });
  eq("resolve: null falls back to the offer", resolveSlotSettings(offerSettings, { minToRun: null, closeBeforeMinutes: null }), { minToRun: 4, closeBeforeMinutes: 1440, waitlistCap: null, priceMinor: null });
  eq("resolve: offer without a minimum", resolveSlotSettings({ minToRun: null, closeBeforeMinutes: 0 }).minToRun, null);
  const now = new Date("2026-11-20T10:00:00Z");
  const start = "2026-11-21T10:00:00Z"; // 24h ahead
  eq("reopen 12h", reopenCloseBeforeMinutes(start, 12, now), 720);
  eq("reopen longer than the time left closes at the start", reopenCloseBeforeMinutes(start, 48, now), 0);
  eq("reopen 24h from 24h out", reopenCloseBeforeMinutes(start, 24, now), 0);
  eq("reopen closes `hours` from now", new Date(new Date(start).getTime() - reopenCloseBeforeMinutes(start, 6, now) * 60000).toISOString(), "2026-11-20T16:00:00.000Z");
  eq("close now", new Date(new Date(start).getTime() - closeNowCloseBeforeMinutes(start, now) * 60000).getTime() <= now.getTime(), true);
  eq("close now minutes", closeNowCloseBeforeMinutes(start, now), 1440);
  eq("close now, already started", closeNowCloseBeforeMinutes("2026-11-20T09:00:00Z", now), 0);
  // The cutoff written by reopen/close-now drives slotState.
  const mk = (closeBeforeMinutes: number, at: Date) => slotState({ startsAt: start, endsAt: "2026-11-21T12:00:00Z", status: "scheduled", booked: 1, capacity: 8, minToRun: 4, closeBeforeMinutes, rule: "guide_decides", now: at }).key;
  eq("closed by close-now is below", mk(closeNowCloseBeforeMinutes(start, now), now), "below");
  eq("reopened is open again", mk(reopenCloseBeforeMinutes(start, 12, now), now), "open");
}

// "None" at slot level is a minimum of 1 (B2)
{
  const closed = new Date("2026-11-20T12:00:00Z");
  const base = { startsAt: "2026-11-21T09:00:00.000Z", endsAt: "2026-11-21T11:30:00.000Z", status: "scheduled" as const, capacity: 8, closeBeforeMinutes: 1440, rule: "guide_decides" as const };
  const none = slotState({ ...base, booked: 0, minToRun: 1, now: closed });
  eq("min 1 after close, nobody booked: confirmed, no call needed", [none.key, none.shortBy, none.minimumReached], ["confirmed", 0, true]);
  const open1 = slotState({ ...base, booked: 0, minToRun: 1, now: new Date("2026-11-18T09:00:00Z") });
  eq("min 1 while open: no short note, still open", [open1.key, open1.note, open1.tone], ["open", null, "ok"]);
  eq("min 1 under auto_cancel is never auto-cancelled", slotState({ ...base, rule: "auto_cancel", booked: 0, minToRun: 1, now: closed }).key, "confirmed");
  eq("min 2 is a real minimum", slotState({ ...base, booked: 1, minToRun: 2, now: closed }).key, "below");
  eq("no-minimum rule text", bookingRuleText({ rule: "guide_decides", min: 1, guideShort: "Dana" }), "");
  eq("no-minimum min line", minimumRuleText({ rule: "guide_decides", min: 1, max: 8 }), "No minimum: every slot runs, however many book. Holds 8.");
  eq("resolve: a slot's 1 beats the offer's 4", resolveSlotSettings({ minToRun: 4, closeBeforeMinutes: 60 }, { minToRun: 1 }).minToRun, 1);
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

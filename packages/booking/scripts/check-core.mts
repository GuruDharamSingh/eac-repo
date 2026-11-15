// Checks of @elkdonis/booking/core (pure: no database). Run inside a container:
//   cd packages/booking && <tsx> scripts/check-core.mts
import {
  computeOpenSlots,
  describePolicy,
  refundShare,
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
eq("set_dates refused in phase 1", validateOfferInput({ ...good, mode: "set_dates" }).ok, false);
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

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

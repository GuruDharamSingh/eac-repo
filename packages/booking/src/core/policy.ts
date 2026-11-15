/**
 * Cancellation policy (decision 4): the share of a paid booking that is due
 * back when it is cancelled. Phase 1 records it as `refund_status = 'due'`
 * with the amount; nothing calls Stripe, and the host refunds from the order.
 */

import type { BookingOffer } from "./types";

export interface RefundShare {
  /** 0-100, or null when the offer states no policy (the host decides). */
  percent: number | null;
  /** Minor units, or null when `percent` is null. */
  amountMinor: number | null;
}

export function refundShare(input: {
  offer: Pick<BookingOffer, "cancelFreeUntilMinutes" | "cancelRefundPercentAfter">;
  scheduledAt: string | null;
  cancelledAt: Date;
  paidMinor: number;
  by: "booker" | "seller" | "system";
}): RefundShare {
  const { offer, paidMinor } = input;
  if (paidMinor <= 0) return { percent: 0, amountMinor: 0 };
  // The host or the system cancelling returns everything.
  if (input.by !== "booker") return { percent: 100, amountMinor: paidMinor };
  if (offer.cancelFreeUntilMinutes == null && offer.cancelRefundPercentAfter == null) {
    return { percent: null, amountMinor: null };
  }
  const startMs = input.scheduledAt ? new Date(input.scheduledAt).getTime() : null;
  const minutesBefore = startMs == null ? Infinity : (startMs - input.cancelledAt.getTime()) / 60000;
  const free = offer.cancelFreeUntilMinutes;
  const percent = free != null && minutesBefore >= free ? 100 : offer.cancelRefundPercentAfter ?? 0;
  return { percent, amountMinor: Math.round((paidMinor * percent) / 100) };
}

/** The policy in one sentence, when the host wrote none of their own. */
export function describePolicy(offer: Pick<BookingOffer, "cancelFreeUntilMinutes" | "cancelRefundPercentAfter" | "cancelPolicyText">): string | null {
  if (offer.cancelPolicyText) return offer.cancelPolicyText;
  const free = offer.cancelFreeUntilMinutes;
  const after = offer.cancelRefundPercentAfter;
  if (free == null && after == null) return null;
  const span = free == null ? null : free % 1440 === 0 ? `${free / 1440} ${free === 1440 ? "day" : "days"}` : `${Math.round(free / 60)} ${free === 60 ? "hour" : "hours"}`;
  const tail = after == null || after === 0 ? "no refund after that" : after === 100 ? "a full refund after that" : `a ${after}% refund after that`;
  if (span == null) return after === 100 ? "Cancel any time for a full refund." : `Cancelling gives ${tail.replace(" after that", "")}.`;
  if (free === 0) return "Cancel any time before the start for a full refund.";
  return `Cancel up to ${span} before for a full refund; ${tail}.`;
}

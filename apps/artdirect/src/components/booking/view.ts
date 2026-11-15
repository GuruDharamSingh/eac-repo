import type { BookerBooking, BookingStatus } from "@elkdonis/booking/core";
import { formatWhen, zoneAbbreviation } from "@elkdonis/booking/core";
import type { BookingSchedulerProps } from "@elkdonis/checkout/components";

// Shared wording and shapes for the booking pages (booker and host). A plain
// module, not "use client": server pages import it.

export const STATUS_WORD: Record<BookingStatus, string> = {
  held: "Held",
  awaiting_payment: "Waiting for payment",
  requested: "Requested",
  awaiting_seller: "Waiting for the host",
  awaiting_booker: "Waiting for the booker",
  confirmed: "Confirmed",
  waitlisted: "On the waiting list",
  cancelled: "Cancelled",
  expired: "Lapsed",
  completed: "Done",
  no_show: "Did not come",
};

export function whenText(iso: string | null, zone: string): string | null {
  if (!iso) return null;
  return `${formatWhen(iso, zone)} (${zoneAbbreviation(iso, zone)})`;
}

export function money(minor: number | null, currency: string | null): string | null {
  if (minor == null) return null;
  try {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency: currency || "CAD" }).format(minor / 100);
  } catch {
    return (minor / 100).toFixed(2);
  }
}

/** Whether the booking is in the two-sided time negotiation the scheduler panel draws. */
export function negotiating(b: Pick<BookerBooking, "status">): boolean {
  return b.status === "awaiting_seller" || b.status === "awaiting_booker";
}

export function schedulerBooking(b: BookerBooking): BookingSchedulerProps["booking"] {
  const party = (p: "booker" | "seller" | null) => (p === "booker" ? "buyer" : p);
  return {
    status: b.status === "awaiting_booker" ? "awaiting_buyer" : (b.status as BookingSchedulerProps["booking"]["status"]),
    proposedBy: party(b.proposedBy),
    proposedTimes: b.proposedTimes,
    scheduledAt: b.scheduledAt,
    lastMessage: b.lastMessage,
    lastMessageBy: party(b.lastMessageBy),
    buyerTimeZone: b.bookerTimeZone ?? b.timeZone,
    durationMinutes: b.durationMinutes,
  };
}

export const ACTIVE: BookingStatus[] = ["held", "awaiting_payment", "requested", "awaiting_seller", "awaiting_booker", "confirmed"];

/**
 * Booking module types (docs/open/BOOKING_MODULE_2026-11-14.md, migration 265).
 *
 * Pure: no database or server import, so forms and browser code can use the
 * same shapes the server validates. Durations are integer minutes; the
 * module stores no price (the price stays on the thread).
 */

export type BookingMode = "open_hours" | "set_dates" | "request_time" | "sessions" | "rsvp";
/** The modes phase 1 accepts in a save (set_dates, sessions and rsvp follow in phases 2-3). */
export const PHASE1_MODES = ["open_hours", "request_time"] as const;
export type Phase1Mode = (typeof PHASE1_MODES)[number];

export type BookingApproval = "instant" | "seller_confirms";
export type OfferStatus = "open" | "paused" | "closed";

export type BookingStatus =
  | "held"
  | "awaiting_payment"
  | "requested"
  | "awaiting_seller"
  | "awaiting_booker"
  | "confirmed"
  | "waitlisted"
  | "cancelled"
  | "expired"
  | "completed"
  | "no_show";

/** Statuses that hold or will hold a seat or a time. */
export const ACTIVE_STATUSES: readonly BookingStatus[] = [
  "held",
  "awaiting_payment",
  "requested",
  "awaiting_seller",
  "awaiting_booker",
  "confirmed",
];

export type RefundStatus = "none" | "due" | "issued" | "declined";
export type Party = "booker" | "seller";

export interface IntakeQuestion {
  key: string;
  label: string;
  required: boolean;
}

/** One weekly hours range, wall clock in the offer's time zone. */
export interface HoursRange {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** "HH:MM", 24-hour. */
  from: string;
  to: string;
}

export interface BookingOffer {
  id: string;
  orgId: string;
  threadId: string;
  hostUserId: string | null;
  mode: BookingMode;
  durationMinutes: number | null;
  slotStepMinutes: number | null;
  bufferMinutes: number;
  timeZone: string;
  capacityPerSlot: number | null;
  minParty: number;
  maxParty: number;
  minToRun: number | null;
  leadTimeMinutes: number;
  closeBeforeMinutes: number;
  maxAheadDays: number;
  priceUnit: "per_booking" | "per_person";
  holdMinutes: number;
  approval: BookingApproval;
  cancelFreeUntilMinutes: number | null;
  cancelRefundPercentAfter: number | null;
  cancelPolicyText: string | null;
  waitlist: boolean;
  questions: IntakeQuestion[];
  status: OfferStatus;
  /** Reminder to both sides this long before the start; null = none (migration 267). */
  reminderMinutesBefore: number | null;
  /** Open hours, sorted by weekday then start. */
  hours: HoursRange[];
  /** First day open hours apply ("YYYY-MM-DD"), or null. */
  validFrom: string | null;
}

/**
 * What a form sends: the editable part of an offer. Validated by
 * `validateOfferInput`; the server fills ids, org, thread and host.
 */
export interface BookingOfferInput {
  mode: Phase1Mode;
  durationMinutes: number;
  timeZone: string;
  hours: HoursRange[];
  validFrom?: string | null;
  slotStepMinutes?: number | null;
  bufferMinutes?: number;
  capacityPerSlot?: number | null;
  leadTimeMinutes?: number;
  maxAheadDays?: number;
  approval?: BookingApproval;
  cancelFreeUntilMinutes?: number | null;
  cancelRefundPercentAfter?: number | null;
  cancelPolicyText?: string | null;
  questions?: IntakeQuestion[];
  status?: OfferStatus;
  /** null = no reminder; omitted = one day before. */
  reminderMinutesBefore?: number | null;
}

/** A bookable time computed from open hours. */
export interface OpenSlot {
  startsAt: string;
  endsAt: string;
  capacity: number;
  seatsLeft: number;
}

export interface Booking {
  id: string;
  orgId: string;
  offerId: string;
  slotId: string | null;
  threadId: string;
  threadTitle: string;
  threadSlug: string | null;
  hostUserId: string | null;
  hostName: string | null;
  bookerUserId: string | null;
  bookerEmail: string;
  bookerName: string | null;
  bookerTimeZone: string | null;
  partySize: number;
  status: BookingStatus;
  orderId: string | null;
  orderNumber: string | null;
  orderStatus: string | null;
  holdExpiresAt: string | null;
  proposedBy: Party | null;
  proposedTimes: string[];
  lastMessage: string | null;
  lastMessageBy: Party | null;
  scheduledAt: string | null;
  durationMinutes: number | null;
  notes: string | null;
  answers: Record<string, string>;
  timeZone: string;
  cancelPolicyText: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: "booker" | "seller" | "system" | null;
  cancelReason: string | null;
  refundStatus: RefundStatus;
  refundDueMinor: number | null;
  /** The order's currency, when there is an order. */
  currency: string | null;
  siteUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The booker's view: no host email, no booker account id. The token is never returned. */
export type BookerBooking = Omit<Booking, "bookerUserId">;

/** `{ ok: true }` or a sentence for the person acting. */
export type ActResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

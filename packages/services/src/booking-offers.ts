/**
 * Booking offers, org-checked (booking module decision 8; design §2.4).
 *
 * The data layer is @elkdonis/booking; this file decides who may edit an
 * offer and books free offerings. An offer may be edited by the author of
 * its thread, or by an owner or guide of the thread's org. The actor always
 * comes from the caller's session, never from the request.
 *
 * Paid bookings do not start here: they go through
 * `startBookingCheckout` (@elkdonis/checkout/booking), which creates the
 * hold, the order and the card session in that order.
 */

import { db } from '@elkdonis/db';
import {
  createBooking,
  getOfferByThread,
  listHostBookings,
  offerToInput,
  saveOffer,
  type Booking,
  type BookingOffer,
  type BookingOfferInput,
  type CreateBookingResult,
} from '@elkdonis/booking';
import { getOrgRole } from './org-membership';

type Row = Record<string, unknown>;

async function threadAuthor(orgId: string, threadId: string): Promise<{ authorId: string | null; price: number | null; status: string } | null> {
  const rows = (await db`
    SELECT author_id, price, status FROM threads WHERE id = ${threadId} AND org_id = ${orgId} LIMIT 1
  `) as unknown as Row[];
  if (!rows[0]) return null;
  return {
    authorId: (rows[0].author_id as string | null) ?? null,
    price: rows[0].price == null ? null : Number(rows[0].price),
    status: rows[0].status as string,
  };
}

/** Whether `actorUserId` may edit the booking offer of a thread of `orgId`. */
export async function canEditBookingOffer(orgId: string, actorUserId: string, threadId: string): Promise<boolean> {
  const t = await threadAuthor(orgId, threadId);
  if (!t) return false;
  if (t.authorId === actorUserId) return true;
  const role = await getOrgRole(actorUserId, orgId);
  return role === 'owner' || role === 'guide';
}

/**
 * Save the booking settings of a thread. The host (whose time is booked) is
 * the thread's author, whoever edits. Returns a sentence for the editor on
 * refusal.
 */
export async function saveBookingOffer(
  orgId: string,
  actorUserId: string,
  threadId: string,
  input: unknown
): Promise<{ ok: true; offer: BookingOfferInput } | { ok: false; error: string }> {
  if (!(await canEditBookingOffer(orgId, actorUserId, threadId))) {
    return { ok: false, error: 'You cannot change booking for this offering.' };
  }
  const t = await threadAuthor(orgId, threadId);
  const saved = await saveOffer({ orgId, threadId, hostUserId: t?.authorId ?? null, offer: input });
  if (saved.ok === false) return saved;
  return { ok: true, offer: offerToInput(saved.offer) };
}

/** The booking settings of a thread for its editor, or null when none are saved yet. */
export async function loadBookingOfferForEdit(
  orgId: string,
  actorUserId: string,
  threadId: string
): Promise<BookingOfferInput | null> {
  if (!(await canEditBookingOffer(orgId, actorUserId, threadId))) return null;
  const offer = await getOfferByThread(orgId, threadId);
  return offer ? offerToInput(offer) : null;
}

/** The public offer of a published thread (what a booking panel needs), or null. */
export async function getPublicBookingOffer(orgId: string, threadId: string): Promise<BookingOffer | null> {
  const offer = await getOfferByThread(orgId, threadId);
  if (!offer || offer.status === 'closed') return null;
  return offer;
}

/**
 * Book a free offering (no price on the thread). A priced thread is
 * refused: its booking must go through the card checkout.
 */
export async function bookFreeOffering(input: {
  orgId: string;
  threadId: string;
  startsAt?: string | null;
  proposedTimes?: unknown;
  booker: { userId?: string | null; email: string; name?: string | null; timeZone?: string | null };
  notes?: unknown;
  answers?: unknown;
  siteUrl?: string | null;
}): Promise<CreateBookingResult> {
  const t = await threadAuthor(input.orgId, input.threadId);
  if (!t || t.status !== 'published') return { ok: false, error: 'This is not open for booking.' };
  if ((t.price ?? 0) > 0) return { ok: false, error: 'This has a price; book it with the payment form.' };
  const offer = await getOfferByThread(input.orgId, input.threadId);
  if (!offer) return { ok: false, error: 'This is not open for booking.' };
  return createBooking({
    orgId: input.orgId,
    offerId: offer.id,
    startsAt: input.startsAt,
    proposedTimes: input.proposedTimes,
    booker: input.booker,
    notes: input.notes,
    answers: input.answers,
    paid: false,
    siteUrl: input.siteUrl,
  });
}

/** The signed-in host's bookings in an org. */
export async function listMyHostBookings(orgId: string, actorUserId: string, opts: { includePast?: boolean } = {}): Promise<Booking[]> {
  return listHostBookings(orgId, actorUserId, opts);
}

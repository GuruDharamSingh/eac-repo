"use server";

import { headers } from "next/headers";
import {
  ARTIST_SPACE_ORG_ID,
  getProfileBySlug,
  getServiceOffering,
} from "@elkdonis/services";
import { publicOriginFrom, startServiceCheckout } from "@elkdonis/checkout/booking";
import type { ServiceBookingInput, ServiceBookingResult } from "@elkdonis/checkout/components";
import { getCurrentUser } from "@/lib/session";
import type { BookingPanelInput, BookingPanelResult } from "@elkdonis/checkout/components";
import {
  bookFreeOffering,
  getPublicBookingOffer,
  saveBookingOffer,
} from "@elkdonis/services";
import {
  bookerCancelBooking,
  bookerConfirmTime,
  bookerProposeTimes,
  hostCancelBooking,
  hostConfirmTime,
  hostProposeTimes,
  getHostBookingOrg,
  type BookingOfferInput,
} from "@elkdonis/booking";
import { startBookingCheckout } from "@elkdonis/checkout/booking";
import { revalidatePath } from "next/cache";

// ============================================================================
// Booking a person's own service on ArtDirect (/<slug>/services/<service>).
//
// The service is looked up here, in `oad` and authored by the person the page
// is about, so a form posted with another person's slug books nothing. The
// order and the card session come from @elkdonis/checkout's
// startThreadCheckout, the same call every site uses; the buyer returns
// through /api/checkout/return.
// ============================================================================

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function bookServiceAction(
  personSlug: string,
  serviceSlug: string,
  input: ServiceBookingInput
): Promise<ServiceBookingResult> {
  const name = (input.name ?? "").trim();
  const email = (input.email ?? "").trim();
  const notes = (input.notes ?? "").trim().slice(0, 2000);
  if (!name) return { ok: false, error: "Enter your name." };
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email address." };

  let amountMinor: number | undefined;
  if (input.amount) {
    const major = Number(input.amount);
    if (!Number.isFinite(major) || major <= 0) return { ok: false, error: "Enter a valid amount." };
    amountMinor = Math.round(major * 100);
  }

  const [person, service, viewer] = await Promise.all([
    getProfileBySlug(personSlug),
    getServiceOffering(ARTIST_SPACE_ORG_ID, serviceSlug),
    getCurrentUser(),
  ]);
  if (!person || !service || service.authorId !== person.userId) {
    return { ok: false, error: "This service is no longer available." };
  }

  const path = `/${person.slug ?? personSlug}/services/${service.slug}`;
  try {
    const { url } = await startServiceCheckout({
      orgId: ARTIST_SPACE_ORG_ID,
      threadId: service.id,
      kinds: ["service"],
      itemNoun: "booking",
      customerEmail: email,
      customerName: name,
      customerId: viewer?.id ?? null,
      notes: notes || null,
      amountMinor,
      baseUrl: publicOriginFrom(await headers(), process.env.NEXT_PUBLIC_APP_URL),
      returnPath: path,
      cancelPath: path,
      // One to one: the buyer's proposed times go to the seller to confirm.
      schedule: (service.bookingType ?? "one_on_one") === "one_on_one"
        ? { times: input.proposedTimes, timeZone: input.timeZone }
        : null,
    });
    return { ok: true, url };
  } catch (err) {
    // Commerce's refusals (closed, out of range, no payout account) and
    // Stripe declining the session are all sentences for the buyer.
    console.error(`[artdirect] bookServiceAction(${personSlug}, ${serviceSlug}):`, err);
    return { ok: false, error: err instanceof Error ? err.message : "Could not start the payment." };
  }
}

// ============================================================================
// Booking module (migration 265, 2026-11-15): open hours and ask-for-a-time
// on a person's own service, free or paid, plus both sides' answers.
//
// The offer is found from the service, which is looked up here in `oad` and
// authored by the person in the address, as above. Free bookings are made by
// @elkdonis/services (bookFreeOffering); paid ones by startBookingCheckout
// (hold, then order, then card session). The host is the session user,
// never a request field; the booker acts by the private token.
// ============================================================================


type Act = { ok: true } | { ok: false; error: string };

export async function bookOfferAction(
  personSlug: string,
  serviceSlug: string,
  input: BookingPanelInput
): Promise<BookingPanelResult> {
  const [person, service, viewer] = await Promise.all([
    getProfileBySlug(personSlug),
    getServiceOffering(ARTIST_SPACE_ORG_ID, serviceSlug),
    getCurrentUser(),
  ]);
  if (!person || !service || service.authorId !== person.userId) {
    return { ok: false, error: "This service is no longer available." };
  }
  const offer = await getPublicBookingOffer(ARTIST_SPACE_ORG_ID, service.id);
  if (!offer || offer.status !== "open") return { ok: false, error: "This is not open for booking." };

  const base = publicOriginFrom(await headers(), process.env.NEXT_PUBLIC_APP_URL);
  const path = `/${person.slug ?? personSlug}/services/${service.slug}`;
  const booker = {
    userId: viewer?.id ?? null,
    email: (input.email ?? "").trim(),
    name: (input.name ?? "").trim(),
    timeZone: input.timeZone,
  };

  if (!((service.price ?? 0) > 0)) {
    const r = await bookFreeOffering({
      orgId: ARTIST_SPACE_ORG_ID,
      threadId: service.id,
      startsAt: input.startsAt,
      proposedTimes: input.proposedTimes,
      booker,
      notes: input.notes,
      answers: input.answers,
      siteUrl: base,
    });
    if (r.ok === false) return r;
    return { ok: true, url: `/bookings/${encodeURIComponent(r.token)}?new=1` };
  }

  let amountMinor: number | undefined;
  if (input.amount) {
    const major = Number(input.amount);
    if (!Number.isFinite(major) || major <= 0) return { ok: false, error: "Enter a valid amount." };
    amountMinor = Math.round(major * 100);
  }
  if (!EMAIL.test(booker.email)) return { ok: false, error: "Enter a valid email address." };
  try {
    const { url } = await startBookingCheckout({
      orgId: ARTIST_SPACE_ORG_ID,
      threadId: service.id,
      offerId: offer.id,
      kinds: ["service"],
      itemNoun: "booking",
      customerEmail: booker.email,
      customerName: booker.name,
      customerId: booker.userId,
      notes: (input.notes ?? "").trim().slice(0, 2000) || null,
      amountMinor,
      startsAt: input.startsAt,
      proposedTimes: input.proposedTimes,
      timeZone: input.timeZone,
      answers: input.answers,
      baseUrl: base,
      siteUrl: base,
      cancelPath: path,
      returnPathFor: (token) => `/bookings/${encodeURIComponent(token)}?new=1`,
    });
    return { ok: true, url };
  } catch (err) {
    console.error(`[artdirect] bookOfferAction(${personSlug}, ${serviceSlug}):`, err);
    return { ok: false, error: err instanceof Error ? err.message : "Could not start the payment." };
  }
}

/** The owner saves how their service is booked. */
export async function saveBookingSettingsAction(
  serviceId: string,
  input: BookingOfferInput
): Promise<{ ok: true; offer: BookingOfferInput } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const r = await saveBookingOffer(ARTIST_SPACE_ORG_ID, user.id, serviceId, input).catch((err) => {
    console.error("[artdirect] saveBookingSettingsAction:", err);
    return { ok: false as const, error: "Could not save. Try again." };
  });
  if (r.ok) revalidatePath("/[slug]/services/[service]", "page");
  return r;
}

// ── the booker, by private token ──

export async function bookerCancelAction(token: string, reason: string): Promise<Act> {
  return bookerCancelBooking(token, reason);
}
export async function bookerConfirmAction(token: string, at: string): Promise<Act> {
  return bookerConfirmTime(token, at);
}
export async function bookerProposeAction(token: string, times: string[], message: string): Promise<Act> {
  return bookerProposeTimes(token, times, message);
}

// ── the host, from the session ──

async function host(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}

/** The org the booking lives in: `oad` for ArtDirect's own services, the thread's org for network sales. */
async function hostOrg(me: string, bookingId: string): Promise<string> {
  return (await getHostBookingOrg(me, bookingId)) ?? ARTIST_SPACE_ORG_ID;
}

export async function hostCancelAction(bookingId: string, reason: string): Promise<Act> {
  const me = await host();
  if (!me) return { ok: false, error: "Sign in first." };
  return hostCancelBooking((await hostOrg(me, bookingId)), me, bookingId, reason);
}
export async function hostConfirmAction(bookingId: string, at: string): Promise<Act> {
  const me = await host();
  if (!me) return { ok: false, error: "Sign in first." };
  return hostConfirmTime((await hostOrg(me, bookingId)), me, bookingId, at);
}
export async function hostProposeAction(bookingId: string, times: string[], message: string): Promise<Act> {
  const me = await host();
  if (!me) return { ok: false, error: "Sign in first." };
  return hostProposeTimes((await hostOrg(me, bookingId)), me, bookingId, times, message);
}

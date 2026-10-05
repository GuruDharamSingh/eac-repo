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

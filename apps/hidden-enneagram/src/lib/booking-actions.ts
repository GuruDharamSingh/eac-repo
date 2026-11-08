"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServiceOffering } from "@elkdonis/services";
import { bookingAvailability, publicOriginFrom, startServiceCheckout } from "@elkdonis/checkout/booking";
import { CardCheckoutRefused } from "@elkdonis/checkout/stripe";
import { createServiceBooking, markServiceBookingPaid, parseProposedTimes } from "@elkdonis/commerce/server";
import { getViewer } from "@/lib/auth";
import { bookingAfterPayment } from "@/lib/booking-after";
import { siteConfig } from "@/config/site";

// ============================================================================
// Round 3 (2026-11-07): "Book and pay" goes straight to Stripe, katie's "Buy
// now" shape. No form before paying: Stripe's page asks for the email (unless
// the visitor is signed in) and the card name; the times and a note are asked
// for AFTER payment, on the page Stripe returns to (saveBookingTimes below).
// The payee is still resolved by commerce from the service's author
// (resolveSettlement); nothing here chooses who is paid.
// ============================================================================

/** "Book and pay": one button (plus an amount when the service has a sliding scale). */
export async function bookAndPay(slug: string, formData: FormData): Promise<void> {
  const service = await getServiceOffering(siteConfig.orgId, slug);
  if (!service || service.registrationStatus !== "open" || !service.price) redirect(`/services/${encodeURIComponent(slug)}`);
  const back = `/services/${service.slug}`;

  const availability = await bookingAvailability(service.authorId);
  if (availability.ok === false) redirect(`${back}?card=${availability.reason}`);

  // Sliding scale: the amount chosen on the page, inside the scale.
  let amountMinor: number | undefined;
  const floor = service.priceSlidingMin;
  if (floor != null && floor < service.price) {
    const major = Number(String(formData.get("amount") ?? "").trim());
    if (!Number.isFinite(major) || major < floor || major > service.price) redirect(`${back}?card=amount`);
    amountMinor = Math.round(major * 100);
  }

  const viewer = await getViewer().catch(() => null);
  const email = viewer?.email?.trim() ?? "";
  let url: string;
  try {
    ({ url } = await startServiceCheckout({
      orgId: siteConfig.orgId,
      threadId: service.id,
      kinds: ["service"],
      itemNoun: "booking",
      customerEmail: email,
      customerName: null,
      customerId: viewer?.userId ?? null,
      notes: null,
      amountMinor,
      baseUrl: publicOriginFrom(await headers(), process.env.NEXT_PUBLIC_APP_URL),
      returnPath: back,
      cancelPath: back,
      // Stripe asks for the email when we do not have one.
      collect: { email: !email },
      // Times come after payment (saveBookingTimes).
      schedule: null,
    }));
  } catch (err) {
    console.error("[hidden-enneagram] bookAndPay:", err);
    redirect(`${back}?card=${err instanceof CardCheckoutRefused ? "refused" : "failed"}`);
  }
  redirect(url);
}

export type TimesResult = { ok: true } | { ok: false; error: string } | null;

/**
 * "When would suit you?", after payment: the times and note the old booking
 * form asked for, saved the way that form saved them (a service_bookings row,
 * then opened to the seller with the same two emails). Only for a paid order
 * of this service whose times have not been sent (lib/booking-after.ts).
 */
export async function saveBookingTimes(slug: string, orderId: string, _prev: TimesResult, formData: FormData): Promise<TimesResult> {
  const service = await getServiceOffering(siteConfig.orgId, slug);
  if (!service) return { ok: false, error: "This service is no longer available." };
  const state = await bookingAfterPayment(orderId, service.id);
  if (state.state === "sent") return { ok: false, error: "Your times have already been sent." };
  if (state.state !== "open") return { ok: false, error: "We could not find a paid booking for this page." };

  let times: unknown = [];
  try {
    times = JSON.parse(String(formData.get("times") ?? "[]"));
  } catch {
    return { ok: false, error: "One of the times could not be read." };
  }
  const parsed = parseProposedTimes(times);
  if (parsed.ok === false) return { ok: false, error: parsed.error };
  const timeZone = String(formData.get("timeZone") ?? "").slice(0, 64) || null;
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000) || null;

  try {
    await createServiceBooking({ orderId, buyerTimeZone: timeZone, proposedTimes: parsed.times, message: notes });
    // The order is already paid, so the booking opens to the seller now (both emails go out once).
    await markServiceBookingPaid(orderId);
  } catch (err) {
    console.error("[hidden-enneagram] saveBookingTimes:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Could not save your times." };
  }
  revalidatePath(`/services/${service.slug}`);
  return { ok: true };
}

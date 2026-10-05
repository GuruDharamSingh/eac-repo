"use server";

import { headers } from "next/headers";
import { getServiceOffering } from "@elkdonis/services";
import { publicOriginFrom, startServiceCheckout } from "@elkdonis/checkout/booking";
import type { ServiceBookingInput, ServiceBookingResult } from "@elkdonis/checkout/components";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

// ============================================================================
// Booking one of this site's services by card.
//
// The service is looked up here, in this org, so a form posted with another
// org's slug books nothing. Group and self-paced services only: one-to-one
// services take proposed times that are stored in `service_bookings`
// (migration 174, unapplied on 2026-10-03), and a card session started
// without that table would leave a live Stripe session with no booking row.
// The order and the session come from startServiceCheckout, the same call
// artdirect uses; the buyer returns through /api/checkout/return.
// ============================================================================

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A same-site path only: this goes to Stripe as the return address. */
function safePath(path: string): string {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : "/";
}

export async function bookServiceAction(
  serviceSlug: string,
  returnPath: string,
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

  const [service, viewer] = await Promise.all([
    getServiceOffering(siteConfig.orgId, serviceSlug),
    getViewer().catch(() => null),
  ]);
  if (!service) return { ok: false, error: "This service is no longer available." };
  if (service.bookingType === "one_on_one") {
    return { ok: false, error: "One-to-one sessions are arranged first. Send an enquiry instead." };
  }

  const path = safePath(returnPath);
  try {
    const { url } = await startServiceCheckout({
      orgId: siteConfig.orgId,
      threadId: service.id,
      kinds: ["service"],
      itemNoun: "booking",
      customerEmail: email,
      customerName: name,
      customerId: viewer?.userId ?? null,
      notes: notes || null,
      amountMinor,
      baseUrl: publicOriginFrom(await headers(), process.env.NEXT_PUBLIC_APP_URL),
      returnPath: path,
      cancelPath: path,
      schedule: null,
    });
    return { ok: true, url };
  } catch (err) {
    // Commerce's refusals (closed, out of range, no payout account) and
    // Stripe declining the session are all sentences for the buyer.
    console.error(`[sunjay] bookServiceAction(${serviceSlug}):`, err);
    return { ok: false, error: err instanceof Error ? err.message : "Could not start the payment." };
  }
}

"use server";

import { headers } from "next/headers";
import { getServiceOffering } from "@elkdonis/services";
import { publicOriginFrom, startServiceCheckout } from "@elkdonis/checkout/booking";
import type { ServiceBookingInput, ServiceBookingResult } from "@elkdonis/checkout/components";
import { getViewer } from "@/lib/auth";
import { BASE_PATH } from "@/lib/base-path";
import { siteConfig } from "@/config/site";

/**
 * Book a reading or session and pay by card (2026-09-27). The order and the
 * Stripe session come from @elkdonis/checkout's startThreadCheckout, as on
 * every site. The base URL carries this app's basePath (`/astro` when served
 * inside arts-collective.com), so Stripe's return and cancel URLs land here.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function bookServiceAction(slug: string, input: ServiceBookingInput): Promise<ServiceBookingResult> {
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

  const service = await getServiceOffering(siteConfig.orgId, slug);
  if (!service) return { ok: false, error: "This service is no longer available." };

  const viewer = await getViewer();
  const origin = publicOriginFrom(await headers(), process.env.NEXT_PUBLIC_APP_URL);
  const path = `/services/${service.slug}`;
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
      baseUrl: `${origin}${BASE_PATH}`,
      returnPath: path,
      cancelPath: path,
      // One to one: the buyer's proposed times go to the seller to confirm.
      schedule: (service.bookingType ?? "one_on_one") === "one_on_one"
        ? { times: input.proposedTimes, timeZone: input.timeZone }
        : null,
    });
    return { ok: true, url };
  } catch (err) {
    console.error("[elastrocal] bookServiceAction:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Could not start the payment." };
  }
}

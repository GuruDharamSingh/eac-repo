"use server";

import { z } from "zod";
import { getServiceOffering } from "@elkdonis/services";
import { createServiceOrder } from "@elkdonis/commerce/server";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

const bookingSchema = z.object({
  name: z.string().trim().min(1, "Enter your name"),
  email: z.string().trim().email("Enter a valid email"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  amount: z.string().optional().or(z.literal("")),
});

export interface BookingResult {
  ok: boolean;
  error?: string;
  orderId?: string;
}

export async function createBookingAction(
  slug: string,
  input: { name: string; email: string; notes: string; amount: string }
): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const data = parsed.data;

  const service = await getServiceOffering(siteConfig.orgId, slug);
  if (!service) return { ok: false, error: "This service is no longer available." };

  const viewer = await getViewer();

  let amountMinor: number | undefined;
  if (data.amount) {
    const amountMajor = Number(data.amount);
    if (!Number.isFinite(amountMajor)) return { ok: false, error: "Enter a valid amount" };
    amountMinor = Math.round(amountMajor * 100);
  }

  try {
    const order = await createServiceOrder({
      orgId: siteConfig.orgId,
      threadId: service.id,
      customerEmail: data.email,
      customerName: data.name,
      customerId: viewer?.userId ?? null,
      notes: data.notes || null,
      amountMinor,
      payeeName: siteConfig.payeeName,
      payoutEmail: siteConfig.payoutEmail,
    });
    return { ok: true, orderId: order.id };
  } catch (err) {
    console.error("[hidden-enneagram] createBookingAction:", err);
    const message = err instanceof Error ? err.message : "Could not create this booking.";
    return { ok: false, error: message };
  }
}

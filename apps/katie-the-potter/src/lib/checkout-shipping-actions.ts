"use server";

import { revalidatePath } from "next/cache";
import { getOrderById } from "@elkdonis/commerce/queries";
import { switchOrderToEtransfer } from "@elkdonis/commerce/server";
import { chooseOrderShipping, quoteOrderShipping, type ShippingOption } from "@elkdonis/commerce/shipping";
import type { Address } from "@elkdonis/commerce/types";
import { loadOrderForViewer } from "@/lib/shop";
import { siteConfig } from "@/config/site";

// ============================================================================
// Shipping as part of checkout (2026-11-17): the buyer picks a courier on the
// order page BEFORE paying, or "arrange it with Katie". The engine is the
// shared one (@elkdonis/commerce/shipping, the same as art-auction): it
// re-quotes on choose, so the price shown is the price charged, and it puts
// the amount into the order total that Stripe / the eTransfer instructions
// carry. When the store is in platform mode the label is bought after payment
// (confirmOrderPaid → ensurePlatformLabel).
//
// Access is the order page's rule (loadOrderForViewer): a signed-in buyer's
// order is theirs alone, a guest order is reached by its unguessable id. The
// order id is the only thing taken from the client besides the address.
// ============================================================================

function cleanAddress(a: Address): Address {
  const t = (v: unknown) => String(v ?? "").trim();
  return {
    recipientName: t(a?.recipientName) || null,
    line1: t(a?.line1),
    line2: t(a?.line2) || null,
    city: t(a?.city),
    region: t(a?.region) || null,
    postalCode: t(a?.postalCode).toUpperCase(),
    country: t(a?.country).toUpperCase(),
    phone: t(a?.phone) || null,
  };
}

export async function quoteShippingAction(
  orderId: string,
  address: Address
): Promise<{ ok: boolean; error?: string; options?: ShippingOption[] }> {
  if (!(await loadOrderForViewer(orderId))) return { ok: false, error: "Order not found." };
  const r = await quoteOrderShipping(orderId, cleanAddress(address));
  return r.ok ? { ok: true, options: r.options } : { ok: false, error: r.error };
}

export async function chooseShippingAction(
  orderId: string,
  address: Address,
  optionId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!(await loadOrderForViewer(orderId))) return { ok: false, error: "Order not found." };
  const r = await chooseOrderShipping({ orderId, address: cleanAddress(address), optionId });
  if (!r.ok) return { ok: false, error: r.error };
  // eTransfer instructions carry the amount: rewrite them with the new total.
  const order = await getOrderById(orderId);
  if (order?.paymentMethod === "etransfer" && order.paymentInstructions) {
    await switchOrderToEtransfer({ orderId, dueHours: siteConfig.etransferDueHours }).catch((err) =>
      console.error("[katie-the-potter] eTransfer instructions not rewritten after shipping:", err)
    );
  }
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

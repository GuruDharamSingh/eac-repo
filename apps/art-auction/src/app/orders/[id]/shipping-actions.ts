"use server";

import { revalidatePath } from "next/cache";
import { getOrderById } from "@elkdonis/commerce/queries";
import { canActForOrder, switchOrderToEtransfer } from "@elkdonis/commerce/server";
import {
  chooseOrderShipping,
  quoteOrderShipping,
  type ShippingOption,
} from "@elkdonis/commerce/shipping";
import type { Address } from "@elkdonis/commerce/types";
import { getCurrentUserId, getIsAdmin } from "@/lib/marketplace-auth";
import { siteConfig } from "@/config/site";

/**
 * Same rule as the order page: a signed-in buyer's order is theirs (plus the
 * seller and admins); a guest order's unguessable id is the capability.
 */
async function mayEdit(orderId: string): Promise<boolean> {
  const order = await getOrderById(orderId);
  if (!order) return false;
  if (!order.customerId) return true;
  const userId = await getCurrentUserId();
  if (!userId) return false;
  return userId === order.customerId || (await canActForOrder(userId, orderId)) || (await getIsAdmin());
}

function cleanAddress(a: Address): Address {
  const t = (v: unknown) => String(v ?? "").trim();
  return {
    recipientName: t(a.recipientName) || null,
    line1: t(a.line1),
    line2: t(a.line2) || null,
    city: t(a.city),
    region: t(a.region) || null,
    postalCode: t(a.postalCode).toUpperCase(),
    country: t(a.country).toUpperCase(),
    phone: t(a.phone) || null,
  };
}

export async function quoteShippingAction(
  orderId: string,
  address: Address
): Promise<{ ok: boolean; error?: string; options?: ShippingOption[] }> {
  if (!(await mayEdit(orderId))) return { ok: false, error: "Order not found." };
  const r = await quoteOrderShipping(orderId, cleanAddress(address));
  return r.ok ? { ok: true, options: r.options } : { ok: false, error: r.error };
}

export async function chooseShippingAction(
  orderId: string,
  address: Address,
  optionId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!(await mayEdit(orderId))) return { ok: false, error: "Order not found." };
  const r = await chooseOrderShipping({ orderId, address: cleanAddress(address), optionId });
  if (!r.ok) return { ok: false, error: r.error };
  // eTransfer instructions carry the amount: rewrite them with the new total.
  const order = await getOrderById(orderId);
  if (order?.paymentMethod === "etransfer" && order.paymentInstructions) {
    await switchOrderToEtransfer({ orderId, dueHours: siteConfig.etransferDueHours }).catch((err) =>
      console.error("[shipping] eTransfer instructions not rewritten:", err)
    );
  }
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}
